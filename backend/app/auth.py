"""Accounts: sign up, sign in, sign out, and the signed-in user for the other routes.

Passwords are hashed with scrypt. A sign-in is a random token in an HttpOnly cookie; the database keeps only the
token's SHA-256, so a copy of the database can't be used to sign in. The cookie lasts until the browser is closed,
unless `Settings.session_days` says otherwise. Every sign-in ends when the app restarts, because the database is
recreated.
"""

import base64
import hashlib
import hmac
import secrets
import sqlite3
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from pydantic import Field, StringConstraints

from app.config import Settings
from app.db import Connection
from app.wire import User, Wire

SESSION_COOKIE = "prelegal_session"
MIN_PASSWORD = 8
MAX_PASSWORD = 128
"""Bounds the work of hashing a password."""

# Hashing


_SCRYPT = {"n": 2**14, "r": 8, "p": 1}


def hash_password(password: str) -> str:
    """The password's scrypt hash, with its salt and parameters, as one string."""
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, **_SCRYPT)
    return f"scrypt${_SCRYPT['n']}${_SCRYPT['r']}${_SCRYPT['p']}${_b64(salt)}${_b64(digest)}"


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, n, r, p, salt, digest = stored.split("$")
        if scheme != "scrypt":
            return False
        expected = base64.b64decode(digest)
        actual = hashlib.scrypt(password.encode(), salt=base64.b64decode(salt), n=int(n), r=int(r), p=int(p))
    except ValueError:
        return False
    return hmac.compare_digest(actual, expected)


# Checked when the email is unknown, so that signing in takes as long as for a real account.
_DUMMY_HASH = hash_password(secrets.token_urlsafe())


# Sessions


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _timestamp(moment: datetime) -> str:
    """As sessions.expires_at stores it, so that the two compare as strings."""
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def _start_session(conn: sqlite3.Connection, user_id: int, settings: Settings, response: Response) -> None:
    token = secrets.token_urlsafe(32)
    days = settings.session_days
    expires_at = _timestamp(datetime.now(UTC) + timedelta(days=days)) if days else None
    with conn:
        conn.execute(
            "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
            (_token_hash(token), user_id, expires_at),
        )
    # Not Secure: the app is served over plain http://localhost. SameSite=Lax keeps other sites' forms from
    # sending it, and the API only takes JSON.
    response.set_cookie(
        SESSION_COOKIE,
        token,
        max_age=days * 24 * 60 * 60 if days else None,
        path="/",
        httponly=True,
        samesite="lax",
    )


def current_user(conn: Connection, token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None) -> User:
    """The signed-in user. Routes that need one depend on this, and answer 401 to everyone else."""
    row = token and conn.execute(
        """SELECT users.id, users.name, users.email FROM sessions JOIN users ON users.id = sessions.user_id
           WHERE sessions.token_hash = ? AND (sessions.expires_at IS NULL OR sessions.expires_at > ?)""",
        (_token_hash(token), _timestamp(datetime.now(UTC))),
    ).fetchone()
    if not row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in.")
    return User(**row)


SignedIn = Annotated[User, Depends(current_user)]
"""A route parameter of this type gets the signed-in user, and the route answers 401 to everyone else."""

# Routes

Email = Annotated[str, StringConstraints(strip_whitespace=True, to_lower=True, max_length=254)]
"""Compared ignoring case, as the users table does."""


class SignUp(Wire):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    email: Annotated[Email, StringConstraints(pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    password: str = Field(min_length=MIN_PASSWORD, max_length=MAX_PASSWORD)
    accepted_disclaimer: Literal[True]
    """The user has accepted that the documents are drafts, subject to legal review."""


class SignIn(Wire):
    email: Email
    password: str = Field(max_length=MAX_PASSWORD)


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def sign_up(body: SignUp, request: Request, response: Response, conn: Connection) -> User:
    """Creates an account and signs it in."""
    try:
        with conn:
            user_id = conn.execute(
                "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
                (body.name, body.email, hash_password(body.password)),
            ).lastrowid
    except sqlite3.IntegrityError:
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists.") from None
    _start_session(conn, user_id, request.app.state.settings, response)
    return User(id=user_id, name=body.name, email=body.email)


@router.post("/signin")
def sign_in(body: SignIn, request: Request, response: Response, conn: Connection) -> User:
    row = conn.execute("SELECT id, name, email, password_hash FROM users WHERE email = ?", (body.email,)).fetchone()
    # The same answer, and about the same time, whether the email is unknown or the password is wrong.
    if not verify_password(body.password, row["password_hash"] if row else _DUMMY_HASH) or not row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    _start_session(conn, row["id"], request.app.state.settings, response)
    return User(id=row["id"], name=row["name"], email=row["email"])


@router.post("/signout", status_code=status.HTTP_204_NO_CONTENT)
def sign_out(
    response: Response, conn: Connection, token: Annotated[str | None, Cookie(alias=SESSION_COOKIE)] = None
) -> None:
    """Ends the sign-in, if there is one."""
    if token:
        with conn:
            conn.execute("DELETE FROM sessions WHERE token_hash = ?", (_token_hash(token),))
    response.delete_cookie(SESSION_COOKIE, path="/", httponly=True, samesite="lax")


@router.get("/me")
def me(user: SignedIn) -> User:
    """The signed-in user, or 401. The page asks this when it loads."""
    return user
