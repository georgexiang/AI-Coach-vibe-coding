"""Tests for exception hierarchy and raiser functions."""

import pytest

from app.utils.exceptions import (
    AppException,
    ConflictException,
    NotFoundException,
    ValidationException,
    bad_request,
    not_found,
)


class TestAppException:
    def test_app_exception_attributes(self):
        exc = AppException(status_code=500, code="SERVER_ERROR", message="fail", details={"k": 1})
        assert exc.status_code == 500
        assert exc.code == "SERVER_ERROR"
        assert exc.message == "fail"
        assert exc.details == {"k": 1}

    def test_app_exception_default_details(self):
        exc = AppException(status_code=400, code="BAD", message="bad")
        assert exc.details is None


class TestNotFoundException:
    def test_default_message(self):
        exc = NotFoundException()
        assert exc.status_code == 404
        assert exc.code == "NOT_FOUND"
        assert exc.message == "Resource not found"

    def test_custom_message_and_details(self):
        exc = NotFoundException("User missing", details={"id": "abc"})
        assert exc.message == "User missing"
        assert exc.details == {"id": "abc"}


class TestValidationException:
    def test_default_message(self):
        exc = ValidationException()
        assert exc.status_code == 422
        assert exc.code == "VALIDATION_ERROR"

    def test_custom_message(self):
        exc = ValidationException("field invalid", details={"field": "email"})
        assert exc.message == "field invalid"
        assert exc.details == {"field": "email"}


class TestConflictException:
    def test_default_message(self):
        exc = ConflictException()
        assert exc.status_code == 409
        assert exc.code == "CONFLICT"

    def test_custom_message(self):
        exc = ConflictException("duplicate entry", details={"name": "dup"})
        assert exc.message == "duplicate entry"
        assert exc.details == {"name": "dup"}


class TestRaiserFunctions:
    def test_not_found_raises(self):
        with pytest.raises(NotFoundException) as exc_info:
            not_found("gone")
        assert exc_info.value.message == "gone"
        assert exc_info.value.status_code == 404

    def test_not_found_default_message(self):
        with pytest.raises(NotFoundException) as exc_info:
            not_found()
        assert exc_info.value.message == "Resource not found"

    def test_bad_request_raises(self):
        with pytest.raises(ValidationException) as exc_info:
            bad_request("invalid")
        assert exc_info.value.message == "invalid"
        assert exc_info.value.status_code == 422

    def test_bad_request_default_message(self):
        with pytest.raises(ValidationException) as exc_info:
            bad_request()
        assert exc_info.value.message == "Invalid request"
