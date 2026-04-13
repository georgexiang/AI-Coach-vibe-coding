"""Meta Skill request/response schemas (Pydantic v2)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MetaSkillRead(BaseModel):
    """Read response for a meta skill configuration."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    display_name: str
    skill_type: str
    agent_id: str
    agent_version: str
    model: str
    template_content: str
    template_language: str
    is_active: bool
    last_synced_at: datetime | None
    created_at: datetime
    updated_at: datetime


class MetaSkillUpdate(BaseModel):
    """Partial update for a meta skill configuration."""

    model: str | None = None
    template_content: str | None = None
    template_language: str | None = None
    is_active: bool | None = None


class MetaSkillSyncResponse(BaseModel):
    """Response after syncing a meta skill agent to Azure."""

    agent_id: str
    agent_version: str
    model: str
    synced_at: datetime


class MetaSkillResourceOut(BaseModel):
    """Read-only resource metadata for a meta-skill bundled file."""

    id: str
    resource_type: str
    filename: str
    content_type: str
    file_size: int
    created_at: datetime
    updated_at: datetime


class SkillCreationRequest(BaseModel):
    """Request to create a skill from materials using the creator agent."""

    material_ids: list[str]
    name: str | None = None
    language: str = "en"


class SkillCreationResult(BaseModel):
    """Response from agent-based skill creation."""

    skill_id: str
    name: str
    status: str
    agent_id: str
    model_used: str
    summary: str = ""
