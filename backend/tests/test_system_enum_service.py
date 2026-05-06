"""Unit tests for system_enum_service: CRUD operations and validation."""

import pytest

from app.models.system_enum import SystemEnum
from app.schemas.system_enum import SystemEnumCreate, SystemEnumUpdate
from app.services.system_enum_service import (
    create_enum,
    delete_enum,
    get_all_categories,
    get_enums_by_category,
    update_enum,
)
from app.utils.exceptions import AppException


async def _seed_enums(session) -> list[SystemEnum]:
    """Helper to seed test enum values."""
    items = [
        SystemEnum(
            category="product", value="drug_a", label_en="Drug A", label_zh="药物A", sort_order=1
        ),
        SystemEnum(
            category="product", value="drug_b", label_en="Drug B", label_zh="药物B", sort_order=2
        ),
        SystemEnum(
            category="product",
            value="drug_c",
            label_en="Drug C",
            label_zh="药物C",
            sort_order=3,
            is_active=False,
        ),
        SystemEnum(
            category="specialty",
            value="oncology",
            label_en="Oncology",
            label_zh="肿瘤科",
            sort_order=1,
        ),
        SystemEnum(
            category="specialty",
            value="cardiology",
            label_en="Cardiology",
            label_zh="心内科",
            sort_order=2,
        ),
    ]
    for item in items:
        session.add(item)
    await session.flush()
    return items


@pytest.mark.asyncio
async def test_get_enums_by_category_active_only(db_session):
    """Should return only active enums for the given category."""
    await _seed_enums(db_session)
    results = await get_enums_by_category(db_session, "product", active_only=True)
    assert len(results) == 2
    assert all(r.is_active for r in results)
    assert results[0].value == "drug_a"
    assert results[1].value == "drug_b"


@pytest.mark.asyncio
async def test_get_enums_by_category_include_inactive(db_session):
    """Should return all enums including inactive when active_only=False."""
    await _seed_enums(db_session)
    results = await get_enums_by_category(db_session, "product", active_only=False)
    assert len(results) == 3


@pytest.mark.asyncio
async def test_get_enums_by_category_ordered(db_session):
    """Should return enums ordered by sort_order then label_en."""
    await _seed_enums(db_session)
    results = await get_enums_by_category(db_session, "specialty")
    assert results[0].value == "cardiology" or results[0].value == "oncology"
    # Both have sort_order 1, 2 respectively
    assert results[0].sort_order <= results[1].sort_order


@pytest.mark.asyncio
async def test_get_enums_empty_category(db_session):
    """Should return empty list for non-existent category."""
    results = await get_enums_by_category(db_session, "nonexistent")
    assert results == []


@pytest.mark.asyncio
async def test_get_all_categories(db_session):
    """Should return all distinct categories sorted."""
    await _seed_enums(db_session)
    categories = await get_all_categories(db_session)
    assert categories == ["product", "specialty"]


@pytest.mark.asyncio
async def test_create_enum_success(db_session):
    """Should create a new enum value."""
    data = SystemEnumCreate(
        category="difficulty",
        value="easy",
        label_en="Easy",
        label_zh="简单",
        sort_order=1,
    )
    result = await create_enum(db_session, data)
    assert result.id is not None
    assert result.category == "difficulty"
    assert result.value == "easy"
    assert result.label_en == "Easy"
    assert result.label_zh == "简单"
    assert result.is_active is True


@pytest.mark.asyncio
async def test_create_enum_duplicate_fails(db_session):
    """Should reject duplicate category+value combination."""
    data = SystemEnumCreate(category="product", value="drug_x", label_en="Drug X")
    await create_enum(db_session, data)

    with pytest.raises(AppException) as exc_info:
        await create_enum(db_session, data)
    assert exc_info.value.status_code == 422


@pytest.mark.asyncio
async def test_update_enum_success(db_session):
    """Should update enum fields."""
    await _seed_enums(db_session)
    enums = await get_enums_by_category(db_session, "product", active_only=False)
    target = enums[0]

    data = SystemEnumUpdate(label_en="Updated Drug", sort_order=99)
    result = await update_enum(db_session, target.id, data)
    assert result.label_en == "Updated Drug"
    assert result.sort_order == 99
    # Unchanged fields remain
    assert result.label_zh == target.label_zh


@pytest.mark.asyncio
async def test_update_enum_not_found(db_session):
    """Should raise 404 for non-existent enum."""
    data = SystemEnumUpdate(label_en="X")
    with pytest.raises(AppException) as exc_info:
        await update_enum(db_session, "nonexistent-id", data)
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_delete_enum_success(db_session):
    """Should delete an enum value."""
    await _seed_enums(db_session)
    enums = await get_enums_by_category(db_session, "product", active_only=False)
    target = enums[0]
    await delete_enum(db_session, target.id)
    remaining = await get_enums_by_category(db_session, "product", active_only=False)
    assert len(remaining) == 2


@pytest.mark.asyncio
async def test_delete_enum_not_found(db_session):
    """Should raise 404 for non-existent enum."""
    with pytest.raises(AppException) as exc_info:
        await delete_enum(db_session, "nonexistent-id")
    assert exc_info.value.status_code == 404
