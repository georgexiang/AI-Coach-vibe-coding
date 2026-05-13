"""Scoring Rubric request/response schemas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator, model_validator


class DimensionConfig(BaseModel):
    """Configuration for a single scoring dimension."""

    name: str
    weight: int
    criteria: list[str]
    max_score: float = 100.0

    model_config = ConfigDict(from_attributes=True)


class RubricCreate(BaseModel):
    """Request schema for creating a scoring rubric."""

    name: str
    description: str = ""
    scenario_type: str = "f2f"
    dimensions: list[DimensionConfig]
    is_default: bool = False
    content_weight: int = 60
    voice_weight: int = 40

    @field_validator("dimensions")
    @classmethod
    def validate_weights_sum(cls, v: list[DimensionConfig]) -> list[DimensionConfig]:
        total = sum(d.weight for d in v)
        if total != 100:
            msg = f"Dimension weights must sum to 100, got {total}"
            raise ValueError(msg)
        return v

    @model_validator(mode="after")
    def validate_category_weights(self) -> "RubricCreate":
        if self.content_weight + self.voice_weight != 100:
            raise ValueError("content_weight + voice_weight must equal 100")
        return self

    model_config = ConfigDict(from_attributes=True)


class RubricUpdate(BaseModel):
    """Request schema for updating a scoring rubric."""

    name: str | None = None
    description: str | None = None
    scenario_type: str | None = None
    dimensions: list[DimensionConfig] | None = None
    is_default: bool | None = None
    content_weight: int | None = None
    voice_weight: int | None = None

    @field_validator("dimensions")
    @classmethod
    def validate_weights_sum(
        cls,
        v: list[DimensionConfig] | None,
    ) -> list[DimensionConfig] | None:
        if v is not None:
            total = sum(d.weight for d in v)
            if total != 100:
                msg = f"Dimension weights must sum to 100, got {total}"
                raise ValueError(msg)
        return v

    model_config = ConfigDict(from_attributes=True)


class RubricResponse(BaseModel):
    """Response schema for a scoring rubric."""

    id: str
    name: str
    description: str
    scenario_type: str
    dimensions: list[DimensionConfig]
    is_default: bool
    created_by: str
    content_weight: int = 60
    voice_weight: int = 40
    cu_content_analyzer_id: str | None = None
    cu_voice_analyzer_id: str | None = None
    created_at: datetime
    updated_at: datetime

    @field_validator("dimensions", mode="before")
    @classmethod
    def parse_dimensions_json(cls, v: str | list) -> list:
        if isinstance(v, str):
            import json

            return json.loads(v)
        return v

    model_config = ConfigDict(from_attributes=True)
