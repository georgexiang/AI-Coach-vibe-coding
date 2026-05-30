"""Dry Run request/response schemas (Pydantic v2)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class DryRunMessageOut(BaseModel):
    """Response schema for a single dry run conversation message."""

    id: str
    dry_run_id: str
    sequence_number: int
    role: str  # "mr" | "hcp"
    content: str
    sop_step_id: str | None
    sop_step_name: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SopStepCoverage(BaseModel):
    """Coverage status for a single SOP step."""

    step_id: str
    step_name: str
    status: str  # "covered" | "partial" | "not_covered"
    matched_message_ids: list[int | str] = []
    details: str = ""


class DryRunIssue(BaseModel):
    """An issue found during dry run simulation."""

    severity: str  # "warning" | "error"
    step_id: str | None = None
    description: str
    suggestion: str = ""


class DryRunListOut(BaseModel):
    """Dry run list item response (without messages or full details)."""

    id: str
    skill_id: str
    run_number: int
    status: str
    executability_score: int | None
    coverage_percent: int | None
    total_sop_steps: int
    covered_sop_steps: int
    issues_count: int
    duration_seconds: int | None
    created_at: datetime

    # Agent audit trail
    mr_agent_id: str = ""
    mr_agent_version: str = ""
    hcp_agent_id: str = ""
    hcp_agent_version: str = ""
    evaluator_agent_id: str = ""
    evaluator_agent_version: str = ""

    model_config = ConfigDict(from_attributes=True)


class DryRunOut(DryRunListOut):
    """Full dry run response with messages and parsed JSON details."""

    partial_sop_steps: int
    sop_coverage: list[SopStepCoverage]
    issues: list[DryRunIssue]
    error_message: str
    messages: list[DryRunMessageOut] = []
    created_by: str
