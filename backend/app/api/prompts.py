"""Prompt optimization API (stateless — no persistence).

Exposes POST /prompts/optimize which delegates to the prompt-optimizer sidecar via the
MCP client and returns optimized text. This endpoint intentionally does NOT touch the
database — recording an optimization run is handled by the management API (27-04).
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.dependencies import require_role
from app.models.user import User
from app.services.prompt_optimizer_client import PromptOptimizerError, optimize_prompt
from app.utils.exceptions import AppException, bad_request

router = APIRouter(prefix="/prompts", tags=["prompts"])

_VALID_MODES = {"system", "user", "iterate"}


class OptimizeRequest(BaseModel):
    prompt: str
    mode: str = "system"
    requirements: str | None = None
    template: str | None = None


class OptimizeResponse(BaseModel):
    optimized_prompt: str


@router.post("/optimize", response_model=OptimizeResponse)
async def optimize(
    data: OptimizeRequest,
    _user: User = Depends(require_role("admin")),
) -> OptimizeResponse:
    """Return an optimized prompt without persisting anything. Admin only."""
    if data.mode not in _VALID_MODES:
        bad_request(f"Invalid mode: {data.mode}")
    if data.mode == "iterate" and not data.requirements:
        bad_request("mode=iterate requires requirements")

    try:
        optimized = await optimize_prompt(
            data.prompt,
            mode=data.mode,
            requirements=data.requirements,
            template=data.template,
        )
    except PromptOptimizerError as exc:
        raise AppException(
            status_code=502,
            code="PROMPT_OPTIMIZER_ERROR",
            message=str(exc),
        ) from exc

    return OptimizeResponse(optimized_prompt=optimized)
