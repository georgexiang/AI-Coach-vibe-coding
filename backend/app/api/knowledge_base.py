"""Knowledge Base API router."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_role
from app.schemas.knowledge_base import (
    ConnectionOut,
    IndexOut,
    KnowledgeConfigCreate,
    KnowledgeConfigOut,
)
from app.services import knowledge_base_service

router = APIRouter(prefix="/knowledge-base", tags=["knowledge-base"])


@router.get("/connections", response_model=list[ConnectionOut])
async def list_connections(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("admin")),
):
    """List available Azure AI Search connections from the Foundry project."""
    return await knowledge_base_service.list_search_connections(db)


@router.get("/indexes", response_model=list[IndexOut])
async def list_project_indexes(
    connection_name: str = "",
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("admin")),
):
    """List search indexes, optionally filtered by connection_name."""
    return await knowledge_base_service.list_indexes(db, connection_name=connection_name)


@router.get("/hcp/{hcp_profile_id}/configs", response_model=list[KnowledgeConfigOut])
async def get_hcp_kb_configs(
    hcp_profile_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("admin")),
):
    """Get all knowledge base configs for an HCP profile."""
    return await knowledge_base_service.get_knowledge_configs(db, hcp_profile_id)


@router.post("/hcp/{hcp_profile_id}/configs", response_model=KnowledgeConfigOut, status_code=201)
async def add_hcp_kb_config(
    hcp_profile_id: str,
    body: KnowledgeConfigCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("admin")),
):
    """Attach a knowledge base to an HCP profile."""
    return await knowledge_base_service.add_knowledge_config(db, hcp_profile_id, body)


@router.delete("/configs/{config_id}", status_code=204)
async def remove_hcp_kb_config(
    config_id: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_role("admin")),
):
    """Remove a knowledge base config."""
    await knowledge_base_service.remove_knowledge_config(db, config_id)
