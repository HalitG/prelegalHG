import re
import sqlite3
from contextlib import closing
from pathlib import Path

import pytest

from app.db import connect, reset_database
from tests.db_helpers import add_user, count_users


@pytest.mark.parametrize(
    ("table", "columns"),
    [
        ("users", ["id", "name", "email", "password_hash", "created_at"]),
        ("sessions", ["token_hash", "user_id", "expires_at"]),
        ("documents", ["id", "user_id", "data", "updated_at"]),
    ],
)
def test_creates_the_tables(tmp_path: Path, table: str, columns: list[str]):
    db_path = tmp_path / "prelegal.db"
    reset_database(db_path)
    with closing(connect(db_path)) as conn:
        assert [row["name"] for row in conn.execute(f"PRAGMA table_info({table})")] == columns


def test_deleting_a_user_deletes_their_sessions_and_documents(tmp_path: Path):
    db_path = tmp_path / "prelegal.db"
    reset_database(db_path)
    user_id = add_user(db_path, "jo@acme.com")
    with closing(connect(db_path)) as conn, conn:
        conn.execute("INSERT INTO sessions (token_hash, user_id) VALUES ('t', ?)", (user_id,))
        conn.execute("INSERT INTO documents (id, user_id, data) VALUES ('d', ?, '{}')", (user_id,))
        conn.execute("DELETE FROM users")
        assert conn.execute("SELECT COUNT(*) FROM sessions").fetchone()[0] == 0
        assert conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0] == 0


def test_creates_missing_folders(tmp_path: Path):
    db_path = tmp_path / "nested" / "data" / "prelegal.db"
    reset_database(db_path)
    assert db_path.is_file()


def test_starts_from_scratch_every_time(tmp_path: Path):
    db_path = tmp_path / "prelegal.db"
    reset_database(db_path)
    add_user(db_path, "jo@acme.com")
    reset_database(db_path)
    assert count_users(db_path) == 0


def test_removes_leftover_journal_files(tmp_path: Path):
    db_path = tmp_path / "prelegal.db"
    for suffix in ("-journal", "-wal", "-shm"):
        Path(f"{db_path}{suffix}").write_bytes(b"stale")
    reset_database(db_path)
    assert sorted(path.name for path in tmp_path.iterdir()) == ["prelegal.db"]


def test_replaces_a_file_that_is_not_a_database(tmp_path: Path):
    db_path = tmp_path / "prelegal.db"
    db_path.write_text("not a database")
    reset_database(db_path)
    assert count_users(db_path) == 0


def test_email_addresses_are_unique_ignoring_case(tmp_path: Path):
    db_path = tmp_path / "prelegal.db"
    reset_database(db_path)
    add_user(db_path, "jo@acme.com")
    with pytest.raises(sqlite3.IntegrityError):
        add_user(db_path, "JO@acme.com")


def test_records_when_a_user_was_created_in_utc(tmp_path: Path):
    db_path = tmp_path / "prelegal.db"
    reset_database(db_path)
    add_user(db_path, "jo@acme.com")
    with closing(connect(db_path)) as conn:
        created_at = conn.execute("SELECT created_at FROM users").fetchone()[0]
    assert re.fullmatch(r"\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ", created_at)
