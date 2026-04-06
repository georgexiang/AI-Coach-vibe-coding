import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request

# Configure root logger so all app.* loggers output to stderr.
# Without this, only uvicorn's own logger produces output.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    stream=sys.stderr,
)
# Defer log-level override until settings are available (after imports).
# Avoids circular import: config.py → logging not yet configured.
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import (
    admin_users_router,
    analytics_router,
    auth_router,
    azure_config_router,
    conference_router,
    config_router,
    hcp_profiles_router,
    materials_router,
    rubrics_router,
    scenarios_router,
    scoring_router,
    sessions_router,
    speech_router,
    voice_live_router,
)
from app.api.health import router as health_router
from app.config import get_settings
from app.database import engine
from app.middleware import RequestLoggingMiddleware
from app.startup import init_tables, load_service_configs, register_adapters, run_seed
from app.utils.exceptions import AppException

logger = logging.getLogger(__name__)
settings = get_settings()

# Apply configurable log level (LOG_LEVEL env var → settings.log_level)
logging.getLogger().setLevel(
    getattr(logging, settings.log_level.upper(), logging.INFO)
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting %s", settings.app_name)
    await init_tables()
    register_adapters()
    await run_seed()
    await load_service_configs()
    logger.info("Startup complete")
    yield
    await engine.dispose()
    logger.info("Shutdown complete")


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
)

# Middleware (order matters: CORS first, then logging)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)


# Global exception handler
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "code": exc.code,
            "message": exc.message,
            "details": exc.details,
        },
    )


# Routers
app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(config_router, prefix=settings.api_prefix)
app.include_router(hcp_profiles_router, prefix=settings.api_prefix)
app.include_router(scenarios_router, prefix=settings.api_prefix)
app.include_router(sessions_router, prefix=settings.api_prefix)
app.include_router(scoring_router, prefix=settings.api_prefix)
app.include_router(rubrics_router, prefix=settings.api_prefix)
app.include_router(azure_config_router, prefix=settings.api_prefix)
app.include_router(materials_router, prefix=settings.api_prefix)
app.include_router(conference_router, prefix=settings.api_prefix)
app.include_router(analytics_router, prefix=settings.api_prefix)
app.include_router(voice_live_router, prefix=settings.api_prefix)
app.include_router(speech_router, prefix=settings.api_prefix)
app.include_router(admin_users_router, prefix=settings.api_prefix)

# Health check (standalone router, no api_prefix)
app.include_router(health_router)
