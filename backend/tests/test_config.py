from pathlib import Path

import pytest

from app.config import BACKEND_DIR, REPO_DIR, Settings


def test_defaults_point_at_the_checkout(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.delenv("PRELEGAL_DB_PATH", raising=False)
    monkeypatch.delenv("PRELEGAL_STATIC_DIR", raising=False)
    settings = Settings.from_env()
    assert settings.db_path == BACKEND_DIR / "data" / "prelegal.db"
    assert settings.static_dir == REPO_DIR / "frontend" / "out"


def test_environment_variables_override_the_defaults(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("PRELEGAL_DB_PATH", "/app/data/prelegal.db")
    monkeypatch.setenv("PRELEGAL_STATIC_DIR", "/app/static")
    settings = Settings.from_env()
    assert settings.db_path == Path("/app/data/prelegal.db")
    assert settings.static_dir == Path("/app/static")
