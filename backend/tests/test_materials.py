"""Integration tests for Training Material API endpoints and prompt builder material context."""

import io

from app.models.user import User
from app.services.auth import create_access_token, get_password_hash
from tests.conftest import TestSessionLocal


async def _create_admin_and_token() -> tuple[str, str]:
    """Create an admin user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username="admin_mat",
            email="admin_mat@test.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Admin Materials",
            role="admin",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


async def _create_user_and_token() -> tuple[str, str]:
    """Create a regular (non-admin) user and return (user_id, bearer_token)."""
    async with TestSessionLocal() as session:
        user = User(
            username="user_mat",
            email="user_mat@test.com",
            hashed_password=get_password_hash("pass123"),
            full_name="Regular User",
            role="user",
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        token = create_access_token(data={"sub": user.id})
        return user.id, token


def _make_pdf_bytes(pages: list[str]) -> bytes:
    """Build a raw PDF with actual text content for testing."""
    obj_num = 1
    catalog_num = obj_num
    obj_num += 1
    pages_num = obj_num
    obj_num += 1
    font_num = obj_num
    obj_num += 1

    page_objs = []
    content_objs = []
    for text in pages:
        page_num = obj_num
        obj_num += 1
        content_num = obj_num
        obj_num += 1
        page_objs.append((page_num, content_num))
        content_objs.append((content_num, text))

    body_parts = []
    offsets = {}

    def add_obj(num, content):
        offsets[num] = 0  # placeholder
        data = f"{num} 0 obj\n{content}\nendobj\n"
        body_parts.append(data.encode("latin-1"))

    add_obj(catalog_num, f"<< /Type /Catalog /Pages {pages_num} 0 R >>")
    kids = " ".join(f"{p[0]} 0 R" for p in page_objs)
    add_obj(pages_num, f"<< /Type /Pages /Kids [{kids}] /Count {len(page_objs)} >>")
    add_obj(font_num, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    for page_num, content_num in page_objs:
        add_obj(
            page_num,
            f"<< /Type /Page /Parent {pages_num} 0 R "
            f"/MediaBox [0 0 612 792] "
            f"/Contents {content_num} 0 R "
            f"/Resources << /Font << /F1 {font_num} 0 R >> >> >>",
        )
    for content_num, text in content_objs:
        safe_text = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = f"BT /F1 12 Tf 72 720 Td ({safe_text}) Tj ET"
        add_obj(content_num, f"<< /Length {len(stream)} >>\nstream\n{stream}\nendstream")

    header = b"%PDF-1.4\n"
    ordered_offsets = {}
    current_pos = len(header)
    obj_keys = list(offsets.keys())
    for i, part in enumerate(body_parts):
        ordered_offsets[obj_keys[i]] = current_pos
        current_pos += len(part)

    body = b"".join(body_parts)
    xref_offset = len(header) + len(body)
    xref_lines = [f"xref\n0 {obj_num}\n", "0000000000 65535 f \n"]
    for i in range(1, obj_num):
        offset = ordered_offsets.get(i, 0)
        xref_lines.append(f"{offset:010d} 00000 n \n")

    xref = "".join(xref_lines).encode("latin-1")
    trailer = (
        f"trailer\n<< /Size {obj_num} /Root {catalog_num} 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n"
    ).encode("latin-1")
    return header + body + xref + trailer


async def _upload_material(client, token, name="Test Material", product="Brukinsa", pages=None):
    """Helper to upload a material and return the response JSON."""
    if pages is None:
        pages = ["zanubrutinib clinical trial data for Brukinsa product"]
    pdf_bytes = _make_pdf_bytes(pages)
    response = await client.post(
        "/api/v1/materials",
        files={"file": ("test.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
        data={"name": name, "product": product},
        headers={"Authorization": f"Bearer {token}"},
    )
    return response


class TestUploadMaterial:
    """Tests for POST /api/v1/materials/."""

    async def test_upload_material(self, client):
        """Upload valid PDF returns 201 with material data."""
        _, token = await _create_admin_and_token()
        response = await _upload_material(client, token)
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["name"] == "Test Material"
        assert data["product"] == "Brukinsa"
        assert data["current_version"] == 1
        assert len(data["versions"]) == 1

    async def test_upload_material_invalid_extension(self, client):
        """Upload with disallowed extension returns 400."""
        _, token = await _create_admin_and_token()
        response = await client.post(
            "/api/v1/materials",
            files={"file": ("test.txt", io.BytesIO(b"plain text"), "text/plain")},
            data={"name": "Bad File", "product": "Drug"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422  # ValidationException

    async def test_upload_material_oversize(self, client, monkeypatch):
        """Upload exceeding max size returns 400."""
        import app.api.materials as mat_module

        # Temporarily reduce MAX_FILE_SIZE
        monkeypatch.setattr(mat_module, "MAX_FILE_SIZE", 100)

        _, token = await _create_admin_and_token()
        pdf_bytes = _make_pdf_bytes(["Some content that exceeds our tiny limit"])
        response = await client.post(
            "/api/v1/materials",
            files={"file": ("big.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
            data={"name": "Big File", "product": "Drug"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 422  # ValidationException for bad_request

    async def test_upload_new_version(self, client):
        """Upload with existing material_id creates version 2."""
        _, token = await _create_admin_and_token()
        # Create first version
        resp1 = await _upload_material(client, token)
        material_id = resp1.json()["id"]

        # Upload second version
        pdf_bytes = _make_pdf_bytes(["Updated content for version 2"])
        resp2 = await client.post(
            "/api/v1/materials",
            files={"file": ("updated.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
            data={"name": "Test Material", "product": "Brukinsa", "material_id": material_id},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp2.status_code == 201
        data = resp2.json()
        assert data["current_version"] == 2
        assert len(data["versions"]) == 2


class TestListMaterials:
    """Tests for GET /api/v1/materials/."""

    async def test_list_materials(self, client):
        """List returns paginated materials."""
        _, token = await _create_admin_and_token()
        await _upload_material(client, token, name="Material A")
        await _upload_material(client, token, name="Material B")

        response = await client.get(
            "/api/v1/materials",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 2
        assert len(data["items"]) >= 2
        assert "page" in data
        assert "total_pages" in data

    async def test_list_materials_filter_product(self, client):
        """Filter by product returns only matching materials."""
        _, token = await _create_admin_and_token()
        await _upload_material(client, token, name="Drug A Material", product="DrugA")
        await _upload_material(client, token, name="Drug B Material", product="DrugB")

        response = await client.get(
            "/api/v1/materials?product=DrugA",
            headers={"Authorization": f"Bearer {token}"},
        )
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["product"] == "DrugA"

    async def test_list_materials_search(self, client):
        """Search by name is case-insensitive."""
        _, token = await _create_admin_and_token()
        await _upload_material(client, token, name="Zanubrutinib Study Guide")
        await _upload_material(client, token, name="Other Document")

        response = await client.get(
            "/api/v1/materials?search=zanubrutinib",
            headers={"Authorization": f"Bearer {token}"},
        )
        data = response.json()
        assert data["total"] == 1
        assert "Zanubrutinib" in data["items"][0]["name"]

    async def test_list_excludes_archived_by_default(self, client):
        """Archived materials are excluded unless include_archived=true."""
        _, token = await _create_admin_and_token()
        resp = await _upload_material(client, token, name="Will Archive")
        material_id = resp.json()["id"]

        # Archive it
        await client.delete(
            f"/api/v1/materials/{material_id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        # List without include_archived
        response = await client.get(
            "/api/v1/materials",
            headers={"Authorization": f"Bearer {token}"},
        )
        ids = [item["id"] for item in response.json()["items"]]
        assert material_id not in ids

        # List with include_archived=true
        response = await client.get(
            "/api/v1/materials?include_archived=true",
            headers={"Authorization": f"Bearer {token}"},
        )
        ids = [item["id"] for item in response.json()["items"]]
        assert material_id in ids


class TestGetMaterialDetail:
    """Tests for GET /api/v1/materials/{id}."""

    async def test_get_material_detail(self, client):
        """Get material by ID returns detail with versions."""
        _, token = await _create_admin_and_token()
        resp = await _upload_material(client, token)
        material_id = resp.json()["id"]

        response = await client.get(
            f"/api/v1/materials/{material_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == material_id
        assert "versions" in data
        assert len(data["versions"]) >= 1

    async def test_get_nonexistent_returns_404(self, client):
        """Get non-existent material returns 404."""
        _, token = await _create_admin_and_token()
        response = await client.get(
            "/api/v1/materials/nonexistent-id",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 404


class TestUpdateMaterial:
    """Tests for PUT /api/v1/materials/{id}."""

    async def test_update_material(self, client):
        """Update material metadata."""
        _, token = await _create_admin_and_token()
        resp = await _upload_material(client, token, name="Original Name")
        material_id = resp.json()["id"]

        response = await client.put(
            f"/api/v1/materials/{material_id}",
            json={"name": "Updated Name", "product": "NewDrug"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["product"] == "NewDrug"


class TestArchiveRestoreMaterial:
    """Tests for DELETE and POST /restore endpoints."""

    async def test_archive_material(self, client):
        """DELETE sets is_archived=True and returns 204."""
        _, token = await _create_admin_and_token()
        resp = await _upload_material(client, token)
        material_id = resp.json()["id"]

        response = await client.delete(
            f"/api/v1/materials/{material_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 204

        # Verify archived
        get_resp = await client.get(
            f"/api/v1/materials/{material_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert get_resp.json()["is_archived"] is True

    async def test_restore_material(self, client):
        """Restore archived material sets is_archived=False."""
        _, token = await _create_admin_and_token()
        resp = await _upload_material(client, token)
        material_id = resp.json()["id"]

        # Archive
        await client.delete(
            f"/api/v1/materials/{material_id}",
            headers={"Authorization": f"Bearer {token}"},
        )

        # Restore
        response = await client.post(
            f"/api/v1/materials/{material_id}/restore",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        assert response.json()["is_archived"] is False


class TestVersions:
    """Tests for version-related endpoints."""

    async def test_get_versions(self, client):
        """GET /materials/{id}/versions returns version list."""
        _, token = await _create_admin_and_token()
        resp = await _upload_material(client, token)
        material_id = resp.json()["id"]

        # Upload second version
        pdf_bytes = _make_pdf_bytes(["Version 2 content"])
        await client.post(
            "/api/v1/materials",
            files={"file": ("v2.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
            data={"name": "Test", "product": "Brukinsa", "material_id": material_id},
            headers={"Authorization": f"Bearer {token}"},
        )

        response = await client.get(
            f"/api/v1/materials/{material_id}/versions",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 200
        versions = response.json()
        assert len(versions) == 2

class TestAuthGuard:
    """Tests for admin-only access control."""

    async def test_unauthorized_user_gets_403(self, client):
        """Regular user gets 403 on POST /materials."""
        _, token = await _create_user_and_token()
        pdf_bytes = _make_pdf_bytes(["test"])
        response = await client.post(
            "/api/v1/materials",
            files={"file": ("test.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
            data={"name": "Nope", "product": "Drug"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert response.status_code == 403

    async def test_no_auth_returns_401(self, client):
        """Request without auth token returns 401."""
        response = await client.get("/api/v1/materials")
        assert response.status_code == 401


