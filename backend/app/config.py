"""Settings, read from environment variables. The defaults suit running from a checkout of the repo."""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Self

from dotenv import dotenv_values

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BACKEND_DIR.parent


@dataclass(frozen=True)
class Settings:
    db_path: Path
    """The SQLite database file. It is replaced with an empty one every time the app starts."""
    static_dir: Path
    """The frontend's static export (`npm run build` in frontend/ writes it to frontend/out)."""
    openai_api_key: str | None = None
    """Enables the AI chat. Without it the app still runs, and /api/chat answers 503."""
    openai_model: str = "gpt-5.4-mini"
    """The OpenAI model behind the AI chat."""

    @classmethod
    def from_env(cls, env_file: Path = REPO_DIR / ".env") -> Self:
        """Reads the environment, falling back to `env_file` for variables it doesn't set.

        Docker passes .env to the container as environment variables; the file is for running from a checkout.
        """
        from_file = {key: value for key, value in dotenv_values(env_file).items() if value is not None}
        env = {**from_file, **os.environ}
        return cls(
            db_path=Path(env.get("PRELEGAL_DB_PATH", BACKEND_DIR / "data" / "prelegal.db")),
            static_dir=Path(env.get("PRELEGAL_STATIC_DIR", REPO_DIR / "frontend" / "out")),
            openai_api_key=env.get("OPENAI_API_KEY") or None,
        )
