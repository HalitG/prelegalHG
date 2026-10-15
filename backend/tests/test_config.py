import os
from pathlib import Path

import pytest

from app.config import BACKEND_DIR, REPO_DIR, Settings

VARIABLES = ("PRELEGAL_DB_PATH", "PRELEGAL_STATIC_DIR", "OPENAI_API_KEY")


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch: pytest.MonkeyPatch):
    for name in VARIABLES:
        monkeypatch.delenv(name, raising=False)


def test_defaults_point_at_the_checkout(tmp_path: Path):
    settings = Settings.from_env(env_file=tmp_path / "missing.env")
    assert settings.db_path == BACKEND_DIR / "data" / "prelegal.db"
    assert settings.static_dir == REPO_DIR / "frontend" / "out"
    assert settings.openai_api_key is None
    assert settings.openai_model == "gpt-5.4-mini"


def test_reads_the_env_file_in_the_repo_root_by_default(monkeypatch: pytest.MonkeyPatch):
    seen = []
    monkeypatch.setattr("app.config.dotenv_values", lambda path: seen.append(path) or {})
    Settings.from_env()
    assert seen == [REPO_DIR / ".env"]


def test_environment_variables_override_the_defaults(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    monkeypatch.setenv("PRELEGAL_DB_PATH", "/app/data/prelegal.db")
    monkeypatch.setenv("PRELEGAL_STATIC_DIR", "/app/static")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-from-env")
    settings = Settings.from_env(env_file=tmp_path / "missing.env")
    assert settings.db_path == Path("/app/data/prelegal.db")
    assert settings.static_dir == Path("/app/static")
    assert settings.openai_api_key == "sk-from-env"


def test_the_env_file_fills_in_what_the_environment_does_not_set(monkeypatch: pytest.MonkeyPatch, tmp_path: Path):
    env_file = tmp_path / ".env"
    env_file.write_text("OPENAI_API_KEY=sk-from-file\nPRELEGAL_DB_PATH=/from/file.db\n")
    monkeypatch.setenv("PRELEGAL_DB_PATH", "/from/env.db")
    settings = Settings.from_env(env_file=env_file)
    assert settings.openai_api_key == "sk-from-file"
    assert settings.db_path == Path("/from/env.db")


def test_reading_the_env_file_does_not_change_the_environment(tmp_path: Path):
    env_file = tmp_path / ".env"
    env_file.write_text("OPENAI_API_KEY=sk-from-file\n")
    Settings.from_env(env_file=env_file)
    assert "OPENAI_API_KEY" not in os.environ


@pytest.mark.parametrize("line", ["OPENAI_API_KEY=", "OPENAI_API_KEY"])
def test_an_empty_api_key_counts_as_none(tmp_path: Path, line: str):
    env_file = tmp_path / ".env"
    env_file.write_text(line + "\n")
    assert Settings.from_env(env_file=env_file).openai_api_key is None
