from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    app_name: str = "AI Coach Platform"
    debug: bool = False
    api_prefix: str = "/api/v1"

    # Database
    database_url: str = "sqlite+aiosqlite:///./ai_coach.db"

    # JWT
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # AI Services
    azure_openai_endpoint: str = ""
    azure_openai_api_key: str = ""
    azure_openai_deployment: str = ""
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # Voice / ASR
    azure_speech_key: str = ""
    azure_speech_region: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
