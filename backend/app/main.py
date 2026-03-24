from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import auth_router, config_router, hcp_profiles_router, scenarios_router
from app.config import get_settings
from app.database import engine
from app.models.base import Base
from app.utils.exceptions import AppException

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Register mock adapters (always available, no Azure credentials needed)
    from app.services.agents.adapters.mock import MockCoachingAdapter
    from app.services.agents.avatar.mock import MockAvatarAdapter
    from app.services.agents.registry import registry
    from app.services.agents.stt.mock import MockSTTAdapter
    from app.services.agents.tts.mock import MockTTSAdapter

    registry.register("llm", MockCoachingAdapter())
    registry.register("stt", MockSTTAdapter())
    registry.register("tts", MockTTSAdapter())
    registry.register("avatar", MockAvatarAdapter())

    yield
    # Shutdown: dispose engine
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


# Health check
@app.get("/api/health")
async def health():
    return {"status": "healthy", "service": settings.app_name}
