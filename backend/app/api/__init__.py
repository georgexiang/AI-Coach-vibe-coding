from app.api.auth import router as auth_router
from app.api.config import router as config_router
from app.api.hcp_profiles import router as hcp_profiles_router
from app.api.scenarios import router as scenarios_router
from app.api.scoring import router as scoring_router
from app.api.sessions import router as sessions_router

__all__ = [
    "auth_router",
    "config_router",
    "hcp_profiles_router",
    "scenarios_router",
    "scoring_router",
    "sessions_router",
]
