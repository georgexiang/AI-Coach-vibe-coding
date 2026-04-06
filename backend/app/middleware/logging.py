"""Structured request logging middleware."""

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("app.access")


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Log every HTTP request with structured fields.

    Emits: request_id, method, path, status, duration_ms, user_id (if JWT).
    Skips health check endpoints to reduce noise.
    """

    SKIP_PATHS = {"/api/health", "/api/health/deep"}

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path in self.SKIP_PATHS:
            return await call_next(request)

        request_id = str(uuid.uuid4())[:8]
        start = time.monotonic()

        response = await call_next(request)

        duration_ms = round((time.monotonic() - start) * 1000, 1)
        user_id = getattr(request.state, "user_id", "-")

        logger.info(
            "rid=%s %s %s %d %.1fms user=%s",
            request_id,
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            user_id,
        )

        response.headers["X-Request-ID"] = request_id
        return response
