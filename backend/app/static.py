"""Serves the frontend's static export."""

from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope


class FrontendFiles(StaticFiles):
    """Static files with cache headers that suit a Next.js export.

    Files under /_next/static/ have a content hash in their name, so they never change. Everything else, the
    HTML pages in particular, is revalidated on every request: otherwise a browser could keep showing an old
    page that refers to assets a rebuilt container no longer has.
    """

    async def get_response(self, path: str, scope: Scope) -> Response:
        response = await super().get_response(path, scope)
        if scope["path"].startswith("/_next/static/"):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            response.headers["Cache-Control"] = "no-cache"
        return response
