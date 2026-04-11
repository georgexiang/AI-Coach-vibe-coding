"""
Skill Manager — Core module for loading and composing Agent Skills.

Follows the agentskills.io specification (https://agentskills.io/specification).
Supports loading skills from: local directories, git repos, ClawHub API, and URLs.
"""

import io
import logging
import os
import re
import subprocess
import zipfile
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

import frontmatter
import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CLAWHUB_API_URL = "https://wry-manatee-359.convex.site/api/v1/download"
SKILLS_CACHE_DIR = "/tmp/skills_cache"
MAX_DOWNLOAD_BYTES = 1_048_576  # 1 MB
GIT_CLONE_TIMEOUT = 60
HTTP_TIMEOUT = 30

_SLUG_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]*$")
_GIT_URL_RE = re.compile(
    r"^(git@[\w.\-]+:[\w.\-/]+\.git|https?://[\w.\-/]+\.git)$"
)


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------


class SkillLoadError(Exception):
    """Raised when a skill cannot be loaded."""


@dataclass
class Skill:
    """A single Agent Skill parsed from a SKILL.md file."""

    name: str
    description: str
    content: str
    source: str  # "local" | "git" | "clawhub" | "url"
    token_estimate: int
    license: str = ""
    compatibility: str = ""
    metadata: dict = field(default_factory=dict)
    allowed_tools: str = ""
    skill_dir: str = ""


# ---------------------------------------------------------------------------
# Manager
# ---------------------------------------------------------------------------


class SkillManager:
    """Load, parse, and compose Agent Skills from multiple sources."""

    # ---- parsing ----------------------------------------------------------

    @staticmethod
    def parse_skill_file(
        raw: str, source: str = "local", skill_dir: str = ""
    ) -> Skill:
        """Parse a SKILL.md file (YAML frontmatter + Markdown body).

        Handles files with or without frontmatter gracefully.
        """
        post = frontmatter.loads(raw)
        fm = post.metadata  # dict (empty if no frontmatter)
        body = post.content.strip()

        return Skill(
            name=fm.get("name", "unnamed"),
            description=fm.get("description", ""),
            content=body,
            source=source,
            token_estimate=len(body) // 4,
            license=fm.get("license", ""),
            compatibility=fm.get("compatibility", ""),
            metadata=fm.get("metadata") or {},
            allowed_tools=fm.get("allowed-tools", ""),
            skill_dir=skill_dir,
        )

    # ---- local directory --------------------------------------------------

    def load_from_directory(self, path: str) -> list[Skill]:
        """Load skills from a local directory.

        Primary: scan ``path/*/SKILL.md`` (agentskills.io subdirectory layout).
        Fallback: scan ``path/*.md`` flat files.
        """
        root = Path(path)
        skills: list[Skill] = []

        # Primary: subdirectory structure  skill-name/SKILL.md
        subdirs = sorted(
            p for p in root.iterdir() if p.is_dir() and (p / "SKILL.md").exists()
        )
        if subdirs:
            for sub in subdirs:
                try:
                    raw = (sub / "SKILL.md").read_text(encoding="utf-8")
                    skill = self.parse_skill_file(
                        raw, source="local", skill_dir=str(sub)
                    )
                    skills.append(skill)
                    logger.info("Loaded skill '%s' from %s", skill.name, sub)
                except Exception:
                    logger.warning("Skipped unparseable skill in %s", sub, exc_info=True)
            return skills

        # Fallback: flat *.md files
        for md in sorted(root.glob("*.md")):
            try:
                raw = md.read_text(encoding="utf-8")
                skill = self.parse_skill_file(raw, source="local", skill_dir=str(root))
                if skill.name == "unnamed":
                    skill.name = md.stem
                skills.append(skill)
                logger.info("Loaded skill '%s' from %s", skill.name, md)
            except Exception:
                logger.warning("Skipped unparseable file %s", md, exc_info=True)

        return skills

    # ---- git repo ---------------------------------------------------------

    def load_from_git(
        self, repo_url: str, skill_names: list[str] | None = None
    ) -> list[Skill]:
        """Clone a git repository and load skills from it.

        Args:
            repo_url: ``git@host:owner/repo.git`` or ``https://host/owner/repo.git``
            skill_names: If provided, only load skills whose directory name is
                in this list.  Otherwise load all discovered skills.
        """
        if not _GIT_URL_RE.match(repo_url):
            raise SkillLoadError(f"Invalid git URL: {repo_url}")

        repo_name = self._repo_name_from_url(repo_url)
        target_dir = os.path.join(SKILLS_CACHE_DIR, "git", repo_name)

        if os.path.isdir(os.path.join(target_dir, ".git")):
            logger.info("Updating cached repo %s", target_dir)
            subprocess.run(
                ["git", "-C", target_dir, "pull", "--ff-only"],
                capture_output=True,
                timeout=30,
                check=False,
            )
        else:
            os.makedirs(os.path.dirname(target_dir), exist_ok=True)
            logger.info("Cloning %s → %s", repo_url, target_dir)
            result = subprocess.run(
                ["git", "clone", "--depth", "1", repo_url, target_dir],
                capture_output=True,
                timeout=GIT_CLONE_TIMEOUT,
                check=False,
            )
            if result.returncode != 0:
                raise SkillLoadError(
                    f"git clone failed ({result.returncode}): "
                    f"{result.stderr.decode(errors='replace').strip()}"
                )

        # Discover skills inside the cloned repo
        skills_root = Path(target_dir)
        if (skills_root / "skills").is_dir():
            skills_root = skills_root / "skills"

        all_skills = self.load_from_directory(str(skills_root))
        for s in all_skills:
            s.source = "git"

        if skill_names:
            names_set = set(skill_names)
            all_skills = [s for s in all_skills if s.name in names_set]

        return all_skills

    # ---- ClawHub API ------------------------------------------------------

    def load_from_clawhub(self, slug: str) -> Skill:
        """Download a skill from the ClawHub marketplace."""
        if not _SLUG_RE.match(slug):
            raise SkillLoadError(f"Invalid ClawHub slug: {slug!r}")

        cache_dir = os.path.join(SKILLS_CACHE_DIR, "clawhub", slug)
        cache_file = os.path.join(cache_dir, "SKILL.md")

        if os.path.isfile(cache_file):
            logger.info("Using cached ClawHub skill '%s'", slug)
            raw = Path(cache_file).read_text(encoding="utf-8")
            return self.parse_skill_file(raw, source="clawhub", skill_dir=cache_dir)

        url = f"{CLAWHUB_API_URL}?slug={slug}"
        logger.info("Downloading ClawHub skill '%s'", slug)
        resp = httpx.get(url, timeout=HTTP_TIMEOUT, follow_redirects=True)
        resp.raise_for_status()

        if len(resp.content) > MAX_DOWNLOAD_BYTES:
            raise SkillLoadError(
                f"ClawHub response too large ({len(resp.content)} bytes)"
            )

        # Extract SKILL.md from ZIP
        try:
            with zipfile.ZipFile(io.BytesIO(resp.content)) as zf:
                skill_md_names = [
                    n for n in zf.namelist() if n.endswith("SKILL.md")
                ]
                if not skill_md_names:
                    raise SkillLoadError("No SKILL.md found in ClawHub ZIP")
                raw = zf.read(skill_md_names[0]).decode("utf-8")
        except zipfile.BadZipFile as exc:
            raise SkillLoadError(f"ClawHub response is not a valid ZIP: {exc}") from exc

        # Cache
        os.makedirs(cache_dir, exist_ok=True)
        Path(cache_file).write_text(raw, encoding="utf-8")

        return self.parse_skill_file(raw, source="clawhub", skill_dir=cache_dir)

    # ---- URL --------------------------------------------------------------

    def load_from_url(self, url: str) -> Skill:
        """Download a SKILL.md from a direct URL."""
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            raise SkillLoadError(f"Unsupported URL scheme: {parsed.scheme}")

        logger.info("Downloading skill from %s", url)
        resp = httpx.get(url, timeout=HTTP_TIMEOUT, follow_redirects=True)
        resp.raise_for_status()

        if len(resp.content) > MAX_DOWNLOAD_BYTES:
            raise SkillLoadError(
                f"URL response too large ({len(resp.content)} bytes)"
            )

        return self.parse_skill_file(resp.text, source="url")

    # ---- unified loader ---------------------------------------------------

    def load_skills(self, skill_specs: list[str]) -> list[Skill]:
        """Load skills from a list of ``source:identifier`` specs.

        Supported formats::

            local:travel-advisor
            git:git@github.com:kepano/obsidian-skills.git
            git:git@github.com:kepano/obsidian-skills.git#obsidian-markdown
            git:git@github.com:kepano/obsidian-skills.git#obsidian-markdown,defuddle
            clawhub:couple-coach
            url:https://example.com/SKILL.md
        """
        skills: list[Skill] = []

        for spec in skill_specs:
            try:
                source, _, identifier = spec.partition(":")
                if not identifier:
                    logger.error("Invalid skill spec (missing ':'): %s", spec)
                    continue

                if source == "local":
                    skills_dir = os.path.join(
                        os.path.dirname(os.path.abspath(__file__)), "skills"
                    )
                    dir_skills = self.load_from_directory(skills_dir)
                    matched = [s for s in dir_skills if s.name == identifier]
                    if matched:
                        skills.extend(matched)
                    else:
                        logger.warning("Local skill '%s' not found", identifier)

                elif source == "git":
                    repo_url, _, fragment = identifier.partition("#")
                    skill_names = (
                        [n.strip() for n in fragment.split(",") if n.strip()]
                        if fragment
                        else None
                    )
                    skills.extend(self.load_from_git(repo_url, skill_names))

                elif source == "clawhub":
                    skills.append(self.load_from_clawhub(identifier))

                elif source == "url":
                    skills.append(self.load_from_url(identifier))

                else:
                    logger.error("Unknown skill source: %s", source)

            except Exception:
                logger.error("Failed to load skill spec '%s'", spec, exc_info=True)

        return skills

    # ---- instruction composition ------------------------------------------

    def compose_instructions(
        self,
        base: str,
        skills: list[Skill],
        max_tokens: int = 4000,
    ) -> str:
        """Compose agent instructions from a base prompt and loaded skills.

        Returns the combined string.  Logs a warning if estimated total
        tokens exceed *max_tokens*.
        """
        parts = [base]
        total_tokens = len(base) // 4

        for skill in skills:
            header = f"== Skill: {skill.name} =="
            desc_line = skill.description
            section = f"\n\n{header}\n{desc_line}\n\n{skill.content}"
            parts.append(section)
            total_tokens += skill.token_estimate

        logger.info(
            "Composed instructions: %d skills, ~%d tokens", len(skills), total_tokens
        )
        if total_tokens > max_tokens:
            logger.warning(
                "Total token estimate (%d) exceeds max_tokens (%d). "
                "Consider reducing the number of active skills.",
                total_tokens,
                max_tokens,
            )

        return "".join(parts)

    # ---- helpers ----------------------------------------------------------

    @staticmethod
    def _repo_name_from_url(url: str) -> str:
        """Extract a filesystem-safe repo name from a git URL."""
        # git@github.com:owner/repo.git  ->  owner-repo
        # https://github.com/owner/repo.git  ->  owner-repo
        name = url.rstrip("/")
        if name.endswith(".git"):
            name = name[:-4]
        if ":" in name and name.startswith("git@"):
            name = name.split(":", 1)[1]
        else:
            parsed = urlparse(name)
            name = parsed.path.lstrip("/")
        return name.replace("/", "-")
