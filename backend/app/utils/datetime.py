"""Datetime helpers for database-compatible UTC timestamps."""

from datetime import UTC, datetime


def utc_now_naive() -> datetime:
    """Return current UTC time without tzinfo for DateTime columns."""
    return datetime.now(UTC).replace(tzinfo=None)


def as_utc_aware(value: datetime) -> datetime:
    """Return a datetime as timezone-aware UTC for calculations."""
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)
