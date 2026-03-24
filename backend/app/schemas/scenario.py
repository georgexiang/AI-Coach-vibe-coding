"""Scenario request/response schemas."""

from datetime import datetime
from typing import Self

from pydantic import BaseModel, ConfigDict, model_validator


class ScenarioCreate(BaseModel):
    """Create a new scenario."""

    name: str
    product: str
    hcp_profile_id: str
    created_by: str
    description: str = ""
    therapeutic_area: str = ""
    mode: str = "f2f"
    difficulty: str = "medium"
    status: str = "draft"
    key_messages: list[str] = []
    weight_key_message: int = 30
    weight_objection_handling: int = 25
    weight_communication: int = 20
    weight_product_knowledge: int = 15
    weight_scientific_info: int = 10
    pass_threshold: int = 70

    @model_validator(mode="after")
    def validate_weights_sum(self) -> Self:
        """Validate that all scoring weights sum to 100."""
        total = (
            self.weight_key_message
            + self.weight_objection_handling
            + self.weight_communication
            + self.weight_product_knowledge
            + self.weight_scientific_info
        )
        if total != 100:
            raise ValueError(f"Scoring weights must sum to 100, got {total}")
        return self


class ScenarioUpdate(BaseModel):
    """Update an existing scenario. All fields optional for partial updates."""

    name: str | None = None
    product: str | None = None
    hcp_profile_id: str | None = None
    description: str | None = None
    therapeutic_area: str | None = None
    mode: str | None = None
    difficulty: str | None = None
    status: str | None = None
    key_messages: list[str] | None = None
    weight_key_message: int | None = None
    weight_objection_handling: int | None = None
    weight_communication: int | None = None
    weight_product_knowledge: int | None = None
    weight_scientific_info: int | None = None
    pass_threshold: int | None = None

    @model_validator(mode="after")
    def validate_weights_sum(self) -> Self:
        """Validate that all scoring weights sum to 100 when all are provided."""
        weights = [
            self.weight_key_message,
            self.weight_objection_handling,
            self.weight_communication,
            self.weight_product_knowledge,
            self.weight_scientific_info,
        ]
        if all(w is not None for w in weights):
            total = sum(weights)
            if total != 100:
                raise ValueError(f"Scoring weights must sum to 100, got {total}")
        return self


class ScenarioResponse(BaseModel):
    """Scenario response with all fields."""

    id: str
    name: str
    description: str
    product: str
    therapeutic_area: str
    mode: str
    difficulty: str
    status: str
    hcp_profile_id: str
    key_messages: str  # JSON string from DB
    weight_key_message: int
    weight_objection_handling: int
    weight_communication: int
    weight_product_knowledge: int
    weight_scientific_info: int
    pass_threshold: int
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
