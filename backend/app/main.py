from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import (
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

    # Register Azure Speech adapters if credentials are configured
    if settings.azure_speech_key and settings.azure_speech_region:
        from app.services.agents.stt.azure import AzureSTTAdapter
        from app.services.agents.tts.azure import AzureTTSAdapter

        registry.register(
            "stt", AzureSTTAdapter(settings.azure_speech_key, settings.azure_speech_region)
        )
        registry.register(
            "tts", AzureTTSAdapter(settings.azure_speech_key, settings.azure_speech_region)
        )

    # Register Azure Avatar adapter stub (premium option behind feature toggle)
    if settings.azure_avatar_endpoint and settings.azure_avatar_key:
        from app.services.agents.avatar.azure import AzureAvatarAdapter

        registry.register(
            "avatar", AzureAvatarAdapter(settings.azure_avatar_endpoint, settings.azure_avatar_key)
        )

    # Load active configs from DB and register real adapters (overrides mocks)
    from app.api.azure_config import register_adapter_from_config
    from app.database import AsyncSessionLocal
    from app.models.service_config import ServiceConfig
    from app.utils.encryption import decrypt_value

    try:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import select

            result = await session.execute(
                select(ServiceConfig).where(ServiceConfig.is_active == True)  # noqa: E712
            )
            configs = result.scalars().all()
            for cfg in configs:
                api_key = decrypt_value(cfg.api_key_encrypted)
                if api_key:
                    await register_adapter_from_config(
                        cfg.service_name,
                        cfg.endpoint,
                        api_key,
                        cfg.model_or_deployment,
                        cfg.region,
                    )
    except Exception:
        pass  # DB may not have the table yet on first run

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
app.include_router(sessions_router, prefix=settings.api_prefix)
app.include_router(scoring_router, prefix=settings.api_prefix)
app.include_router(rubrics_router, prefix=settings.api_prefix)
app.include_router(azure_config_router, prefix=settings.api_prefix)
app.include_router(materials_router, prefix=settings.api_prefix)
app.include_router(conference_router, prefix=settings.api_prefix)
app.include_router(analytics_router, prefix=settings.api_prefix)
app.include_router(voice_live_router, prefix=settings.api_prefix)
app.include_router(speech_router, prefix=settings.api_prefix)


# Health check
@app.get("/api/health")
async def health():
    return {"status": "healthy", "service": settings.app_name}
