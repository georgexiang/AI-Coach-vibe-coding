"""Pydantic v2 schemas for Azure service configuration CRUD."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ServiceConfigUpdate(BaseModel):
    """Update request for a service configuration."""

    endpoint: str = ""
    api_key: str = ""
    model_or_deployment: str = ""
    region: str = ""


class AIFoundryConfigUpdate(BaseModel):
    """Update request for the master AI Foundry configuration."""

    endpoint: str  # e.g. https://ai-foundary-qiah-east-us2.cognitiveservices.azure.com/
    region: str  # e.g. eastus2
    api_key: str = ""  # master API key (empty string = preserve existing)


class ServiceConfigResponse(BaseModel):
    """Response schema for service configuration (with masked key)."""

    service_name: str
    display_name: str
    endpoint: str
    masked_key: str
    model_or_deployment: str
    region: str
    is_master: bool = False
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
