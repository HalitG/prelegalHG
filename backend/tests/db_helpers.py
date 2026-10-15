from contextlib import closing
from pathlib import Path

from app.db import connect


def add_user(db_path: Path, email: str, name: str = "Jo Smith") -> int:
    with closing(connect(db_path)) as conn, conn:
        return conn.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)", (name, email, "hash")
        ).lastrowid


def count_users(db_path: Path) -> int:
    with closing(connect(db_path)) as conn:
        return conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
