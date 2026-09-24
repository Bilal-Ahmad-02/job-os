"""Process liveness only, not database or external-service readiness."""

from fastapi import APIRouter, Response

from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health(response: Response) -> HealthResponse:
    response.headers["Cache-Control"] = "no-store"
    return HealthResponse()
