import httpx2

PASSWORD = "correct horse"


def sign_up(client: httpx2.Client, email: str = "jo@acme.com", name: str = "Jo Smith", password: str = PASSWORD):
    """Creates an account through the API. The client keeps the session cookie, so it is signed in afterwards."""
    response = client.post(
        "/api/auth/signup", json={"name": name, "email": email, "password": password, "acceptedDisclaimer": True}
    )
    assert response.status_code == 201, response.text
    return response
