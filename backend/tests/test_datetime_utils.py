"""Datetime utility tests."""

from datetime import UTC, datetime

from app.utils.datetime import as_utc_aware, as_utc_naive, utc_now_naive


def test_utc_now_naive_returns_naive_datetime():
    value = utc_now_naive()

    assert value.tzinfo is None


def test_as_utc_aware_adds_utc_to_naive_datetime():
    value = datetime(2026, 5, 28, 12, 0, 0)

    result = as_utc_aware(value)

    assert result.tzinfo is UTC
    assert result.hour == 12


def test_as_utc_aware_converts_aware_datetime_to_utc():
    value = datetime(2026, 5, 28, 20, 0, 0, tzinfo=UTC)

    result = as_utc_aware(value)

    assert result.tzinfo is UTC
    assert result.hour == 20


def test_as_utc_naive_converts_aware_datetime_to_naive_utc():
    value = datetime(2026, 5, 28, 20, 0, 0, tzinfo=UTC)

    result = as_utc_naive(value)

    assert result.tzinfo is None
    assert result.hour == 20
