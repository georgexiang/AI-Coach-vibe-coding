from app.api.analytics import router as analytics_router
from app.api.auth import router as auth_router
from app.api.azure_config import router as azure_config_router
from app.api.config import router as config_router
from app.api.hcp_profiles import router as hcp_profiles_router
from app.api.materials import router as materials_router
from app.api.rubrics import router as rubrics_router
from app.api.scenarios import router as scenarios_router
from app.api.scoring import router as scoring_router
from app.api.sessions import router as sessions_router

__all__ = [
    "analytics_router",
    "auth_router",
    "azure_config_router",
    "config_router",
    "hcp_profiles_router",
    "materials_router",
    "rubrics_router",
    "scenarios_router",
    "scoring_router",
    "sessions_router",
]
