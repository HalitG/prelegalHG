import re
import sqlite3
from contextlib import closing
from pathlib import Path

import pytest

from app.db import connect, reset_database


def add_user(db_path: Path, email: str) -> None:
    with closing(connect(db_path)) as conn, conn:
        conn.execute("INSERT INTO users (email, password_hash) VALUES (?, ?)", (email, "hash"))


def count_users(db_path: Path) -> int:
    with closing(connect(db_path)) as conn:
        return conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]


def test_creates_the_users_table(tmp_path: Path):
    db_path = tmp_path / "prelegal.db"
    reset_database(db_path)
    with closing(connect(db_path)) as conn:
        columns = [row["name"] for row in conn.execute("PRAGMA table_info(users)")]
    assert columns == ["id", "email", "password_hash", "created_at"]


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
