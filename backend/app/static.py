"""Serves the frontend's static export."""

from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope


class FrontendFiles(StaticFiles):
    """The Next.js export, mounted at the root of the site after the API.

    Paths under /api never belong to the frontend, so an unknown API path gets FastAPI's JSON 404 instead of the
    frontend's HTML 404 page, whatever the request method.

    Files under /_next/static/ have a content hash in their name, so they never change and can be cached for
    good. Everything else, the HTML pages in particular, is revalidated on every request: otherwise a browser
    could keep showing an old page that refers to assets a rebuilt container no longer has.
    """

    async def get_response(self, path: str, scope: Scope) -> Response:
        if scope["path"] == "/api" or scope["path"].startswith("/api/"):
            raise HTTPException(status_code=404)
        response = await super().get_response(path, scope)
        if scope["path"].startswith("/_next/static/") and response.status_code in (200, 304):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            response.headers["Cache-Control"] = "no-cache"
        return response
