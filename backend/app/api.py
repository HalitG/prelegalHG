"""The JSON API, served under /api."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    """Used by the Docker health check. The app only starts once its database exists, so this is enough."""
    return {"status": "ok"}
