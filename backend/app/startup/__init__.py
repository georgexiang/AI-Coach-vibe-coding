"""Startup modules for FastAPI lifespan decomposition.

Each module handles one responsibility during application startup.
"""

from app.startup.adapters import register_adapters
from app.startup.config_loader import load_service_configs
from app.startup.database import init_tables
from app.startup.seed import run_seed

__all__ = [
    "init_tables",
    "register_adapters",
    "run_seed",
    "load_service_configs",
]
