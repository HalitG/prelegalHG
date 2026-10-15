import logging
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from tests.db_helpers import add_user, count_users

# Startup


def test_startup_creates_the_database(client: TestClient, settings: Settings):
    assert count_users(settings.db_path) == 0


def test_every_startup_begins_with_an_empty_database(settings: Settings):
    with TestClient(create_app(settings)):
        add_user(settings.db_path, "jo@acme.com")
        assert count_users(settings.db_path) == 1

    with TestClient(create_app(settings)):
        assert count_users(settings.db_path) == 0


# API


def test_health_reports_ok(client: TestClient):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert client.head("/api/health").status_code == 200


@pytest.mark.parametrize("method", ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
def test_unknown_api_paths_get_a_json_404(client: TestClient, method: str):
    for path in ("/api", "/api/does-not-exist", "/api/nested/does-not-exist"):
        response = client.request(method, path)
        assert response.status_code == 404
        assert response.headers["content-type"] == "application/json"
        if method != "HEAD":
            assert response.json() == {"detail": "Not Found"}


def test_api_docs_live_under_api(client: TestClient):
    assert client.get("/api/docs").status_code == 200
    assert client.get("/api/docs/oauth2-redirect").status_code == 200
    assert "/api/health" in client.get("/api/openapi.json").json()["paths"]
    for path in ("/docs", "/docs/oauth2-redirect"):
        assert client.get(path).text == "<h1>Page not found</h1>"


def test_api_routes_win_over_frontend_files(static_dir: Path, client: TestClient):
    (static_dir / "api").mkdir()
    (static_dir / "api" / "health").write_text("a static file")
    assert client.get("/api/health").json() == {"status": "ok"}


# Frontend


def test_serves_the_frontend_at_the_root(client: TestClient):
    response = client.get("/")
    assert response.status_code == 200
    assert response.text == "<h1>Platform</h1>"


def test_serves_a_route_from_its_folder(client: TestClient):
    response = client.get("/login/")
    assert response.status_code == 200
    assert response.text == "<h1>Sign in</h1>"


def test_adds_the_trailing_slash_to_a_route(client: TestClient):
    response = client.get("/login", follow_redirects=False)
    assert response.status_code == 307
    assert response.headers["location"] == "http://testserver/login/"


def test_unknown_pages_get_the_frontend_404_page(client: TestClient):
    response = client.get("/does-not-exist/")
    assert response.status_code == 404
    assert response.text == "<h1>Page not found</h1>"


def test_serves_the_pdf_fonts_from_the_root(client: TestClient):
    assert client.get("/fonts/SourceSerif4-Regular.ttf").text == "font"


def test_pages_are_revalidated_but_hashed_assets_are_cached(client: TestClient):
    assert client.get("/").headers["cache-control"] == "no-cache"
    assert client.get("/does-not-exist/").headers["cache-control"] == "no-cache"
    asset = client.get("/_next/static/chunks/app.js")
    assert asset.headers["cache-control"] == "public, max-age=31536000, immutable"
    unchanged = client.get("/_next/static/chunks/app.js", headers={"if-none-match": asset.headers["etag"]})
    assert unchanged.status_code == 304
    assert unchanged.headers["cache-control"] == "public, max-age=31536000, immutable"


def test_a_missing_hashed_asset_is_not_cached(client: TestClient):
    # A later build can bring back a file with the same hash, so its 404 must not stick in the browser.
    response = client.get("/_next/static/chunks/missing.js")
    assert response.status_code == 404
    assert response.headers["cache-control"] == "no-cache"


def test_serves_the_api_without_a_frontend_build(tmp_path: Path, caplog: pytest.LogCaptureFixture):
    settings = Settings(db_path=tmp_path / "prelegal.db", static_dir=tmp_path / "missing")
    with caplog.at_level(logging.WARNING), TestClient(create_app(settings)) as client:
        assert client.get("/api/health").status_code == 200
        assert client.get("/").status_code == 404
    assert "No frontend build" in caplog.text
