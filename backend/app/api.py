"""The JSON API, served under /api."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

from app.chat import ChatError, ChatRequest, ChatResponse, ChatService

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
@router.head("/health", include_in_schema=False)
def health() -> dict[str, str]:
    """Used by the Docker health check. The app only starts once its database exists, so this is enough."""
    return {"status": "ok"}


def get_chat_service(request: Request) -> ChatService:
    """The service behind /api/chat. Tests replace it with app.dependency_overrides."""
    service: ChatService | None = request.app.state.chat_service
    if service is None:
        raise HTTPException(503, "The AI chat isn't set up: add OPENAI_API_KEY to .env and restart the app.")
    return service


@router.post("/chat")
def chat(body: ChatRequest, service: Annotated[ChatService, Depends(get_chat_service)]) -> ChatResponse:
    """One turn of the AI chat that fills in the Mutual NDA."""
    try:
        return service.respond(body)
    except ChatError:
        logger.exception("The AI chat failed")
        raise HTTPException(502, "The AI assistant couldn't answer. Please try again.") from None
