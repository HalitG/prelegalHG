"""Settings, read from environment variables. The defaults suit running from a checkout of the repo."""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Self

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BACKEND_DIR.parent


@dataclass(frozen=True)
class Settings:
    db_path: Path
    """The SQLite database file. It is replaced with an empty one every time the app starts."""
    static_dir: Path
    """The frontend's static export (`npm run build` in frontend/ writes it to frontend/out)."""

    @classmethod
    def from_env(cls) -> Self:
        return cls(
            db_path=Path(os.environ.get("PRELEGAL_DB_PATH", BACKEND_DIR / "data" / "prelegal.db")),
            static_dir=Path(os.environ.get("PRELEGAL_STATIC_DIR", REPO_DIR / "frontend" / "out")),
        )
