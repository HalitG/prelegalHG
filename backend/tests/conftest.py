from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


@pytest.fixture
def static_dir(tmp_path: Path) -> Path:
    """A small stand-in for the frontend's static export."""
    site = tmp_path / "site"
    files = {
        "index.html": "<h1>Platform</h1>",
        "404.html": "<h1>Page not found</h1>",
        "login/index.html": "<h1>Sign in</h1>",
        "_next/static/chunks/app.js": "console.log('app')",
        "fonts/SourceSerif4-Regular.ttf": "font",
    }
    for name, content in files.items():
        (site / name).parent.mkdir(parents=True, exist_ok=True)
        (site / name).write_text(content)
    return site


@pytest.fixture
def settings(tmp_path: Path, static_dir: Path) -> Settings:
    return Settings(db_path=tmp_path / "data" / "prelegal.db", static_dir=static_dir)


@pytest.fixture
def client(settings: Settings):
    # Entering the client runs the app's startup, which creates the database.
    with TestClient(create_app(settings)) as client:
        yield client
