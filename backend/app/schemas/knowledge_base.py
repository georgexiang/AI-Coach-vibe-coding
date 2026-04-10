"""Knowledge base configuration schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ConnectionOut(BaseModel):
    """Azure AI Search connection summary."""

    name: str
    target: str
    is_default: bool


class IndexOut(BaseModel):
    """Azure AI Search index summary."""

    name: str
    version: str | None = None
    type: str | None = None
    description: str | None = None


class KnowledgeConfigCreate(BaseModel):
    """Request body to attach a knowledge base to an HCP profile."""

    connection_name: str
    connection_target: str = ""
    index_name: str


class KnowledgeConfigOut(BaseModel):
    """Read-only representation of an HCP knowledge config row."""

    id: str
    hcp_profile_id: str
    connection_name: str
    connection_target: str
    index_name: str
    server_label: str
    is_enabled: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
