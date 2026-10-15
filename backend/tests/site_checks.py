"""What a correctly served prelegal site looks like, checked against the real frontend build."""

import re

import httpx2

ASSET_URL = re.compile(r'(?:src|href)="(/_next/static/[^"]+)"')


def assert_site_is_served(client: httpx2.Client) -> None:
    """Works with FastAPI's TestClient and with an httpx2 client pointed at a running container."""
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok"}

    pages = {path: client.get(path) for path in ("/", "/login/")}
    for page in pages.values():
        assert page.status_code == 200
        assert page.headers["content-type"].startswith("text/html")
    assert "<title>Sign in · prelegal</title>" in pages["/login/"].text

    assets = {url for page in pages.values() for url in ASSET_URL.findall(page.text)}
    assert assets, "the pages should load the app's JavaScript and CSS"
    for url in assets:
        assert client.get(url).status_code == 200, url

    redirect = client.get("/login", follow_redirects=False)
    assert redirect.status_code == 307
    assert redirect.headers["location"].endswith("/login/")

    # The PDF renderer loads its fonts from /fonts in the browser.
    assert client.get("/fonts/SourceSerif4-Regular.ttf").status_code == 200

    missing_api = client.get("/api/does-not-exist")
    assert missing_api.status_code == 404
    assert missing_api.json() == {"detail": "Not Found"}

    missing_page = client.get("/does-not-exist/")
    assert missing_page.status_code == 404
    assert missing_page.headers["content-type"].startswith("text/html")
