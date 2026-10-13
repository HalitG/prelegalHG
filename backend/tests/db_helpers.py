from contextlib import closing
from pathlib import Path

from app.db import connect


def add_user(db_path: Path, email: str) -> None:
    with closing(connect(db_path)) as conn, conn:
        conn.execute("INSERT INTO users (email, password_hash) VALUES (?, ?)", (email, "hash"))


def count_users(db_path: Path) -> int:
    with closing(connect(db_path)) as conn:
        return conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
