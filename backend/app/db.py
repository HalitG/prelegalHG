"""The SQLite database. It is temporary: every start of the app replaces it with an empty one."""

import sqlite3
from contextlib import closing
from pathlib import Path

SCHEMA = """
CREATE TABLE users (
    id            INTEGER PRIMARY KEY,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);
"""


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def reset_database(db_path: Path) -> None:
    """Delete the database, if there is one, and create an empty one with the current schema."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    # Leftover journal files go too, so SQLite can't replay one into the new database.
    for suffix in ("", "-journal", "-wal", "-shm"):
        Path(f"{db_path}{suffix}").unlink(missing_ok=True)
    with closing(connect(db_path)) as conn:
        conn.executescript(SCHEMA)
