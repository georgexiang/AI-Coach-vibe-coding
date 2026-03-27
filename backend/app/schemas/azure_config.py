"""Pydantic v2 schemas for Azure service configuration CRUD."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ServiceConfigUpdate(BaseModel):
    """Update request for a service configuration."""

    endpoint: str = ""
    api_key: str = ""
    model_or_deployment: str = ""
    region: str = ""


class ServiceConfigResponse(BaseModel):
    """Response schema for service configuration (with masked key)."""

    service_name: str
    display_name: str
    endpoint: str
    masked_key: str
    model_or_deployment: str
    region: str
    is_active: bool
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ConnectionTestResult(BaseModel):
    """Result of a service connection test."""

    service_name: str
    success: bool
    message: str


class RegionServiceAvailability(BaseModel):
    """Availability info for a single service in a region."""

    available: bool
    note: str = ""


class RegionCapabilitiesResponse(BaseModel):
    """Region capability lookup result."""

    region: str
    services: dict[str, RegionServiceAvailability]
