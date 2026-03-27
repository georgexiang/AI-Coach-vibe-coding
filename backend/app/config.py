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

    # Feature Toggles (ARCH-02)
    feature_avatar_enabled: bool = False
    feature_voice_enabled: bool = False
    feature_realtime_voice_enabled: bool = False
    feature_conference_enabled: bool = False
    feature_voice_live_enabled: bool = False

    # Voice Mode (PLAT-05): "text_only" | "stt_tts" | "realtime" | "voice_live"
    default_voice_mode: str = "text_only"

    # Region (PLAT-04): "global" | "china" | "eu"
    region: str = "global"

    # Azure Avatar (optional premium) (ARCH-05)
    azure_avatar_endpoint: str = ""
    azure_avatar_key: str = ""

    # Azure Content Understanding (ARCH-05)
    azure_content_endpoint: str = ""
    azure_content_key: str = ""

    # Training Material Management
    material_storage_path: str = "./storage/materials"
    material_max_size_mb: int = 50
    material_retention_days: int = 365

    # Encryption (for API key storage)
    encryption_key: str = ""  # Set via ENCRYPTION_KEY env var; generated at runtime if empty

    # Default AI provider per category
    default_llm_provider: str = "mock"
    default_stt_provider: str = "mock"
    default_tts_provider: str = "mock"
    default_avatar_provider: str = "mock"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
