"""System enums API router: admin management of configurable enum values."""

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_role
from app.models.user import User
from app.schemas.system_enum import SystemEnumCreate, SystemEnumResponse, SystemEnumUpdate
from app.services import system_enum_service

router = APIRouter(prefix="/system-enums", tags=["system-enums"])


@router.get("", response_model=list[SystemEnumResponse])
async def list_enums(
    category: str | None = Query(None),
    active_only: bool = Query(True),
    db: AsyncSession = Depends(get_db),
):
    """List system enums, optionally filtered by category. Public for dropdown consumption."""
    if category:
        items = await system_enum_service.get_enums_by_category(db, category, active_only)
    else:
        items = await system_enum_service.get_all_enums(db, active_only)
    return items


@router.post("", response_model=SystemEnumResponse, status_code=201)
async def create_enum(
    data: SystemEnumCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Create a new enum value. Admin only."""
    enum = await system_enum_service.create_enum(db, data)
    return enum


@router.put("/{enum_id}", response_model=SystemEnumResponse)
async def update_enum(
    enum_id: str,
    data: SystemEnumUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Update an enum value. Admin only."""
    enum = await system_enum_service.update_enum(db, enum_id, data)
    return enum


@router.delete("/{enum_id}", status_code=204)
async def delete_enum(
    enum_id: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("admin")),
):
    """Delete an enum value. Admin only."""
    await system_enum_service.delete_enum(db, enum_id)
    return Response(status_code=204)
