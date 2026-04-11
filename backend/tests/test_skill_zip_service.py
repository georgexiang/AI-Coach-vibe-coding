"""ZIP import/export security hardening tests."""

import io
import zipfile

import pytest
import yaml

from app.models.skill import SkillResource
from app.schemas.skill import SkillCreate
from app.services.skill_zip_service import (
    MAX_PATH_DEPTH,
    MAX_ZIP_ENTRIES,
    export_skill_zip,
    import_skill_zip,
    validate_zip_security,
)
from app.utils.exceptions import ConflictException, ValidationException
from tests.conftest import TestSessionLocal

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_zip(entries: dict[str, str]) -> bytes:
    """Create a ZIP from filename->content dict."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode="w") as zf:
        for name, content in entries.items():
            zf.writestr(name, content)
    return buf.getvalue()


def make_valid_skill_zip(
    name: str = "Test Import Skill",
    content: str = "## Step 1\nTest step content",
) -> bytes:
    """Create a valid Skill ZIP with SKILL.md + sample resources."""
    frontmatter = yaml.dump(
        {"name": name, "description": "Imported skill", "product": "TestProduct"},
        allow_unicode=True,
    )
    skill_md = f"---\n{frontmatter}---\n\n{content}"
    return make_zip(
        {
            "SKILL.md": skill_md,
            "references/guide.txt": "Reference material content",
            "scripts/helper.py": "# Helper script\nprint('hello')",
            "assets/logo.png": "fake-png-bytes",
        }
    )


async def _seed_user() -> str:
    """Create a test admin user and return the user_id."""
    from app.models.user import User
    from app.services.auth import get_password_hash

    async with TestSessionLocal() as session:
        user = User(
            username="zip_test_admin",
            email="zip_admin@test.com",
            hashed_password=get_password_hash("pass"),
            full_name="Zip Admin",
            role="admin",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user.id


# ---------------------------------------------------------------------------
# Security validation tests
# ---------------------------------------------------------------------------


class TestValidateZipSecurity:
    """Test ZIP security validation."""

    def test_valid_zip_passes(self):
        zip_bytes = make_valid_skill_zip()
        errors = validate_zip_security(zip_bytes)
        assert errors == []

    def test_reject_path_traversal(self):
        zip_bytes = make_zip({"../../../etc/passwd": "malicious"})
        errors = validate_zip_security(zip_bytes)
        assert any("path traversal" in e.lower() or ".." in e for e in errors)

    def test_reject_absolute_path(self):
        zip_bytes = make_zip({"/etc/passwd": "malicious"})
        errors = validate_zip_security(zip_bytes)
        assert any("absolute" in e.lower() for e in errors)

    def test_reject_symlink(self):
        """ZIP entry with symlink external_attr should be rejected."""
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, mode="w") as zf:
            info = zipfile.ZipInfo("symlink.txt")
            # Set symlink flag in external_attr (upper nibble 0xA)
            info.external_attr = 0xA0000000
            zf.writestr(info, "target")
        errors = validate_zip_security(buf.getvalue())
        assert any("symlink" in e.lower() for e in errors)

    def test_reject_excessive_entries(self):
        entries = {f"references/file_{i}.txt": f"content {i}" for i in range(MAX_ZIP_ENTRIES + 1)}
        zip_bytes = make_zip(entries)
        errors = validate_zip_security(zip_bytes)
        assert any("entries" in e.lower() for e in errors)

    def test_reject_deep_nesting(self):
        # Create a path with depth > MAX_PATH_DEPTH
        deep_path = "/".join(["dir"] * (MAX_PATH_DEPTH + 1)) + "/file.txt"
        zip_bytes = make_zip({deep_path: "deep content"})
        errors = validate_zip_security(zip_bytes)
        assert any("deep" in e.lower() or "depth" in e.lower() for e in errors)

    def test_reject_disallowed_extension(self):
        zip_bytes = make_zip({"scripts/hack.exe": "malware"})
        errors = validate_zip_security(zip_bytes)
        assert any(".exe" in e for e in errors)

    def test_reject_zip_bomb(self):
        """ZIP with total uncompressed size > limit should be rejected."""
        # Create entries that together exceed MAX_UNCOMPRESSED_SIZE_BYTES
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
            # Each entry claims huge uncompressed size via manipulated info
            # Use a few large entries to exceed total
            chunk = b"A" * (10 * 1024 * 1024)  # 10MB per entry
            for i in range(12):  # 120MB total > 100MB limit
                zf.writestr(f"references/big_{i}.txt", chunk.decode())
        errors = validate_zip_security(buf.getvalue())
        assert any("uncompressed" in e.lower() or "bomb" in e.lower() for e in errors)

    def test_reject_disallowed_directory(self):
        zip_bytes = make_zip({"malicious_dir/payload.txt": "bad"})
        errors = validate_zip_security(zip_bytes)
        assert any("disallowed directory" in e.lower() for e in errors)

    def test_invalid_zip_format(self):
        errors = validate_zip_security(b"not a zip file")
        assert any("invalid" in e.lower() for e in errors)


# ---------------------------------------------------------------------------
# Export tests
# ---------------------------------------------------------------------------


class TestExportSkillZip:
    """Test Skill ZIP export."""

    async def test_export_creates_valid_zip(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        data = SkillCreate(name="Export Skill", content="Test SOP content", product="ExportProd")
        skill = await skill_service.create_skill(db_session, data, user_id)
        await db_session.commit()

        zip_bytes = await export_skill_zip(db_session, skill.id)

        # Verify it's a valid ZIP with SKILL.md
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
        assert "SKILL.md" in zf.namelist()

        # Verify SKILL.md has frontmatter
        skill_md = zf.read("SKILL.md").decode("utf-8")
        assert "---" in skill_md
        assert "Export Skill" in skill_md
        zf.close()

    async def test_export_includes_resources(self, db_session):
        from app.services import skill_service

        user_id = await _seed_user()
        data = SkillCreate(name="Resource Export", content="SOP", product="P")
        skill = await skill_service.create_skill(db_session, data, user_id)

        # Add resources of each type
        for rtype, fname, content in [
            ("reference", "doc.txt", "Reference content"),
            ("script", "run.py", "print('test')"),
            ("asset", "img.png", "fake-png"),
        ]:
            resource = SkillResource(
                skill_id=skill.id,
                resource_type=rtype,
                filename=fname,
                storage_path=f"skills/{skill.id}/{rtype}s/{fname}",
                text_content=content,
            )
            db_session.add(resource)
        await db_session.flush()
        await db_session.commit()

        zip_bytes = await export_skill_zip(db_session, skill.id)
        zf = zipfile.ZipFile(io.BytesIO(zip_bytes))
        names = zf.namelist()

        assert "references/doc.txt" in names
        assert "scripts/run.py" in names
        assert "assets/img.png" in names
        zf.close()


# ---------------------------------------------------------------------------
# Import tests
# ---------------------------------------------------------------------------


class TestImportSkillZip:
    """Test Skill ZIP import."""

    async def test_import_creates_skill(self, db_session):
        user_id = await _seed_user()
        zip_bytes = make_valid_skill_zip(name="Imported Skill", content="## Step 1\nDo stuff")
        skill = await import_skill_zip(db_session, zip_bytes, created_by=user_id)
        await db_session.commit()

        assert skill.name == "Imported Skill"
        assert "Step 1" in skill.content

    async def test_import_reject_duplicate_name(self, db_session):
        user_id = await _seed_user()
        zip_bytes = make_valid_skill_zip(name="Duplicate Skill")

        # First import succeeds
        await import_skill_zip(db_session, zip_bytes, created_by=user_id)
        await db_session.commit()

        # Second import with same name should fail
        with pytest.raises(ConflictException):
            await import_skill_zip(db_session, zip_bytes, created_by=user_id)

    async def test_import_scripts_inert(self, db_session):
        """Imported scripts are stored as text_content, never executed."""
        from sqlalchemy import select

        user_id = await _seed_user()
        zip_bytes = make_valid_skill_zip(name="Script Skill")
        skill = await import_skill_zip(db_session, zip_bytes, created_by=user_id)
        await db_session.flush()

        # Check that script resource exists with text_content
        result = await db_session.execute(
            select(SkillResource).where(
                SkillResource.skill_id == skill.id,
                SkillResource.resource_type == "script",
            )
        )
        script_resources = list(result.scalars().all())
        assert len(script_resources) == 1
        assert script_resources[0].filename == "helper.py"
        assert "print" in script_resources[0].text_content

    async def test_import_no_skill_md_raises(self, db_session):
        """ZIP without SKILL.md should raise."""
        zip_bytes = make_zip({"references/doc.txt": "content"})
        with pytest.raises(ValidationException):
            await import_skill_zip(db_session, zip_bytes)

    async def test_import_imports_all_resource_types(self, db_session):
        """Import creates resources for references, scripts, and assets."""
        from sqlalchemy import select

        user_id = await _seed_user()
        zip_bytes = make_valid_skill_zip(name="All Types Skill")
        skill = await import_skill_zip(db_session, zip_bytes, created_by=user_id)
        await db_session.flush()

        result = await db_session.execute(
            select(SkillResource).where(SkillResource.skill_id == skill.id)
        )
        resources = list(result.scalars().all())
        types = {r.resource_type for r in resources}
        assert "reference" in types
        assert "script" in types
        assert "asset" in types
