import hashlib
from contextlib import closing
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.auth import SESSION_COOKIE, hash_password, verify_password
from app.config import Settings
from app.db import connect
from app.main import create_app
from tests.auth_helpers import PASSWORD, sign_up

SIGN_UP = {"name": "Jo Smith", "email": "jo@acme.com", "password": PASSWORD, "acceptedDisclaimer": True}
JO = {"id": 1, "name": "Jo Smith", "email": "jo@acme.com"}


def stored(settings: Settings, sql: str) -> list[tuple]:
    with closing(connect(settings.db_path)) as conn:
        return [tuple(row) for row in conn.execute(sql)]


# Passwords


def test_a_password_matches_its_hash_only():
    stored_hash = hash_password(PASSWORD)
    assert stored_hash.startswith("scrypt$")
    assert PASSWORD not in stored_hash
    assert verify_password(PASSWORD, stored_hash)
    assert not verify_password("wrong horse", stored_hash)


def test_the_same_password_gets_a_different_salt_each_time():
    assert hash_password(PASSWORD) != hash_password(PASSWORD)


@pytest.mark.parametrize("stored_hash", ["", "hash", "bcrypt$1$2$3$4$5", "scrypt$x$8$1$AAAA$AAAA", "scrypt$16384$8$1$!$!"])
def test_a_malformed_hash_matches_nothing(stored_hash: str):
    assert not verify_password(PASSWORD, stored_hash)


# Signing up


def test_signing_up_creates_the_account_and_signs_it_in(client: TestClient):
    response = client.post("/api/auth/signup", json=SIGN_UP)
    assert response.status_code == 201
    assert response.json() == JO
    assert client.get("/api/auth/me").json() == JO


def test_the_sign_in_lasts_until_the_browser_closes_by_default(client: TestClient):
    cookie = client.post("/api/auth/signup", json=SIGN_UP).headers["set-cookie"]
    assert cookie.startswith(f"{SESSION_COOKIE}=")
    attributes = {part.strip().split("=")[0].lower() for part in cookie.split(";")[1:]}
    assert attributes == {"httponly", "path", "samesite"}
    assert "SameSite=lax" in cookie and "Path=/" in cookie


def test_only_hashes_are_stored(client: TestClient, settings: Settings):
    response = client.post("/api/auth/signup", json=SIGN_UP)
    token = response.cookies[SESSION_COOKIE]
    [(password_hash,)] = stored(settings, "SELECT password_hash FROM users")
    [(token_hash, expires_at)] = stored(settings, "SELECT token_hash, expires_at FROM sessions")
    assert verify_password(PASSWORD, password_hash)
    assert token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert expires_at is None


def test_the_email_is_stored_trimmed_and_in_lower_case(client: TestClient):
    response = client.post("/api/auth/signup", json={**SIGN_UP, "email": "  Jo@ACME.com ", "name": " Jo Smith "})
    assert response.json() == JO


def test_an_email_can_only_have_one_account_ignoring_case(client: TestClient):
    sign_up(client)
    response = client.post("/api/auth/signup", json={**SIGN_UP, "email": "JO@acme.com"})
    assert response.status_code == 409
    assert response.json() == {"detail": "An account with this email already exists."}


@pytest.mark.parametrize(
    "change",
    [
        {"name": "  "},
        {"email": "jo"},
        {"email": "jo@acme"},
        {"password": "short"},
        {"password": "x" * 129},
        {"acceptedDisclaimer": False},
        {"acceptedDisclaimer": None},
        {"admin": True},
    ],
)
def test_signing_up_needs_a_name_an_email_a_good_password_and_the_disclaimer(client: TestClient, change: dict):
    response = client.post("/api/auth/signup", json={**SIGN_UP, **change})
    assert response.status_code == 422
    assert client.get("/api/auth/me").status_code == 401


# Signing in and out


def test_signing_in_with_the_right_password(client: TestClient):
    sign_up(client)
    client.cookies.clear()
    response = client.post("/api/auth/signin", json={"email": " JO@acme.com", "password": PASSWORD})
    assert response.status_code == 200
    assert response.json() == JO
    assert client.get("/api/auth/me").json() == JO


@pytest.mark.parametrize("email, password", [("jo@acme.com", "wrong horse"), ("nobody@acme.com", PASSWORD)])
def test_a_wrong_password_and_an_unknown_email_get_the_same_answer(client: TestClient, email: str, password: str):
    sign_up(client)
    client.cookies.clear()
    response = client.post("/api/auth/signin", json={"email": email, "password": password})
    assert response.status_code == 401
    assert response.json() == {"detail": "Incorrect email or password."}
    assert "set-cookie" not in response.headers


def test_signing_out_ends_the_sign_in(client: TestClient, settings: Settings):
    sign_up(client)
    token = client.cookies[SESSION_COOKIE]
    response = client.post("/api/auth/signout")
    assert response.status_code == 204
    assert f'{SESSION_COOKIE}=""' in response.headers["set-cookie"]
    assert stored(settings, "SELECT * FROM sessions") == []
    # Even a copy of the old cookie no longer works.
    client.cookies.set(SESSION_COOKIE, token)
    assert client.get("/api/auth/me").status_code == 401


def test_signing_out_when_signed_out_is_harmless(client: TestClient):
    assert client.post("/api/auth/signout").status_code == 204


def test_each_sign_in_is_separate(client: TestClient, settings: Settings):
    sign_up(client)
    first = client.cookies[SESSION_COOKIE]
    client.cookies.clear()
    client.post("/api/auth/signin", json={"email": "jo@acme.com", "password": PASSWORD})
    client.post("/api/auth/signout")
    client.cookies.set(SESSION_COOKIE, first)
    assert client.get("/api/auth/me").json() == JO


@pytest.mark.parametrize("cookie", [None, "", "made-up"])
def test_me_needs_a_valid_sign_in(client: TestClient, cookie: str | None):
    if cookie is not None:
        client.cookies.set(SESSION_COOKIE, cookie)
    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json() == {"detail": "Please sign in."}


def test_restarting_the_app_ends_every_sign_in(settings: Settings):
    with TestClient(create_app(settings)) as client:
        sign_up(client)
        token = client.cookies[SESSION_COOKIE]
    with TestClient(create_app(settings)) as client:
        client.cookies.set(SESSION_COOKIE, token)
        assert client.get("/api/auth/me").status_code == 401


# Sign-ins that last a number of days


@pytest.fixture
def week_client(settings: Settings):
    with TestClient(create_app(replace(settings, session_days=7))) as client:
        yield client


def test_a_sign_in_can_last_a_number_of_days(week_client: TestClient, settings: Settings):
    cookie = sign_up(week_client).headers["set-cookie"]
    assert "Max-Age=604800" in cookie
    [(expires_at,)] = stored(settings, "SELECT expires_at FROM sessions")
    assert expires_at is not None


def test_an_expired_sign_in_no_longer_works(week_client: TestClient, settings: Settings):
    sign_up(week_client)
    with closing(connect(settings.db_path)) as conn, conn:
        conn.execute("UPDATE sessions SET expires_at = '2000-01-01T00:00:00Z'")
    assert week_client.get("/api/auth/me").status_code == 401


def test_the_auth_routes_are_in_the_api_docs(client: TestClient):
    paths = client.get("/api/openapi.json").json()["paths"]
    assert {"/api/auth/signup", "/api/auth/signin", "/api/auth/signout", "/api/auth/me"} <= set(paths)
