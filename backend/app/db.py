"""The SQLite database. It is temporary: every start of the app replaces it with an empty one."""

import sqlite3
from collections.abc import Iterator
from contextlib import closing
from pathlib import Path
from typing import Annotated

from fastapi import Depends, Request

SCHEMA = """
CREATE TABLE users (
    id            INTEGER PRIMARY KEY,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- A sign-in. The browser holds the token in a cookie; only its SHA-256 is stored.
CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    expires_at TEXT -- as '%Y-%m-%dT%H:%M:%SZ' in UTC; NULL: until the user signs out or the app restarts
);

-- An agreement a user is drafting: the agreement, its values and parties, and the chat, as JSON.
CREATE TABLE documents (
    id         TEXT PRIMARY KEY, -- made by the browser, so saving is the same request every time
    user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    data       TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX documents_by_user ON documents (user_id, updated_at);
"""


def connect(db_path: Path) -> sqlite3.Connection:
    # FastAPI may run a request's dependencies and its handler on different threads. Each connection still
    # serves one request at a time.
    conn = sqlite3.connect(db_path, check_same_thread=False)
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


def get_db(request: Request) -> Iterator[sqlite3.Connection]:
    """A connection for one request. Use `with conn:` around changes to commit them."""
    with closing(connect(request.app.state.settings.db_path)) as conn:
        yield conn


Connection = Annotated[sqlite3.Connection, Depends(get_db)]
"""A route parameter of this type gets the request's connection."""
