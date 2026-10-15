"""What a correctly served prelegal site looks like, checked against the real frontend build."""

import re
import secrets

import httpx2

ASSET_URL = re.compile(r'(?:src|href)="(/_next/static/[^"]+)"')


def assert_site_is_served(client: httpx2.Client) -> None:
    """Works with FastAPI's TestClient and with an httpx2 client pointed at a running container."""
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok"}

    pages = {path: client.get(path) for path in ("/", "/login/", "/signup/", "/documents/")}
    for page in pages.values():
        assert page.status_code == 200
        assert page.headers["content-type"].startswith("text/html")
    assert "<title>Sign in · prelegal</title>" in pages["/login/"].text
    assert "<title>Create your account · prelegal</title>" in pages["/signup/"].text
    assert "<title>My documents · prelegal</title>" in pages["/documents/"].text

    assets = {url for page in pages.values() for url in ASSET_URL.findall(page.text)}
    assert assets, "the pages should load the app's JavaScript and CSS"
    for url in assets:
        assert client.get(url).status_code == 200, url

    redirect = client.get("/login", follow_redirects=False)
    assert redirect.status_code == 307
    assert redirect.headers["location"].endswith("/login/")

    # The PDF renderer loads its fonts from /fonts in the browser.
    assert client.get("/fonts/SourceSerif4-Regular.ttf").status_code == 200

    # The page loads each agreement's text once the chat has chosen it.
    text = client.get("/documents/csa.json")
    assert text.status_code == 200
    assert text.headers["content-type"].startswith("application/json")
    assert text.json()["terms"][0] == {"type": "heading", "level": 1, "text": "Cloud Service Agreement"}

    missing_api = client.get("/api/does-not-exist")
    assert missing_api.status_code == 404
    assert missing_api.json() == {"detail": "Not Found"}

    missing_page = client.get("/does-not-exist/")
    assert missing_page.status_code == 404
    assert missing_page.headers["content-type"].startswith("text/html")


def assert_accounts_work(client: httpx2.Client) -> None:
    """Signs up a new user, saves an agreement, finds it again, deletes it and signs out."""
    email = f"smoke-{secrets.token_hex(4)}@example.com"
    signup = {"name": "Smoke Test", "email": email, "password": "correct horse", "acceptedDisclaimer": True}
    assert client.post("/api/auth/signup", json=signup).status_code == 201
    assert client.get("/api/auth/me").json()["email"] == email

    document_id = secrets.token_hex(16)
    empty = {"company": "", "name": "", "title": "", "noticeAddress": ""}
    draft = {
        "document": "mutual-nda",
        "values": {"purpose": "Testing"},
        "parties": [{**empty, "company": "Acme"}, empty],
        "messages": [{"role": "user", "content": "An NDA"}],
        "revision": 1,
    }
    assert client.put(f"/api/documents/{document_id}", json=draft).status_code == 200
    [summary] = client.get("/api/documents").json()
    assert summary["id"] == document_id
    assert summary["companies"] == ["Acme", ""]
    assert client.get(f"/api/documents/{document_id}").json()["values"] == {"purpose": "Testing"}
    assert client.delete(f"/api/documents/{document_id}").status_code == 204

    assert client.post("/api/auth/signout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    assert client.get("/api/documents").status_code == 401
