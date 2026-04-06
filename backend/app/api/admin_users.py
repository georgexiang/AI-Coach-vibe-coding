"""Admin user management endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db, require_role
from app.models.user import User
from app.schemas.user import AdminUserResponse, UserUpdate
from app.utils.exceptions import not_found
from app.utils.pagination import PaginatedResponse

router = APIRouter(prefix="/users", tags=["admin-users"])


@router.get("", response_model=PaginatedResponse[AdminUserResponse])
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    role: str | None = None,
    is_active: bool | None = None,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    """List all users with search and filters (admin only)."""
    query = select(User)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                User.full_name.ilike(pattern),
                User.username.ilike(pattern),
                User.email.ilike(pattern),
            )
        )
    if role:
        query = query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.is_active == is_active)

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Paginate
    query = query.order_by(User.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return PaginatedResponse.create(
        [AdminUserResponse.model_validate(u) for u in items], total, page, page_size
    )


@router.get("/{user_id}", response_model=AdminUserResponse)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    """Get a single user by ID (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        not_found("User not found")
    return user


@router.patch("/{user_id}", response_model=AdminUserResponse)
async def update_user(
    user_id: str,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_role("admin")),
):
    """Update user fields (admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        not_found("User not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    await db.flush()
    await db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role("admin")),
):
    """Deactivate (soft-delete) a user (admin only). Cannot delete yourself."""
    if user_id == admin.id:
        from app.utils.exceptions import AppException

        raise AppException(
            status_code=400,
            code="CANNOT_DELETE_SELF",
            message="Cannot delete your own account",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        not_found("User not found")

    user.is_active = False
    await db.flush()
