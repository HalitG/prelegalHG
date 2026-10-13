"""The prelegal web app: the JSON API under /api, and the static frontend for every other path.

Run it with `uv run uvicorn app.main:create_app --factory`. Use a single worker: each worker would reset the
database when it starts.
"""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

from app.api import router as api_router
from app.config import Settings
from app.db import reset_database
from app.static import FrontendFiles

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        reset_database(settings.db_path)
        yield

    app = FastAPI(
        title="prelegal",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    app.include_router(api_router, prefix="/api")

    # Unknown API paths get a JSON 404 instead of the frontend's HTML 404 page. Keep this after every API
    # router and before the frontend, which matches every path.
    @app.api_route(
        "/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE"], include_in_schema=False
    )
    def api_not_found(path: str) -> None:
        raise HTTPException(status_code=404)

    if settings.static_dir.is_dir():
        app.mount("/", FrontendFiles(directory=settings.static_dir, html=True), name="frontend")
    else:
        logger.warning(
            "No frontend build at %s, so only the API is served. Run `npm run build` in frontend/.",
            settings.static_dir,
        )

    return app
