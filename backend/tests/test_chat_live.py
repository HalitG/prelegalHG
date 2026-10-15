"""Checks the AI chat against the real OpenAI API. Run with `uv run pytest -m live`; it needs OPENAI_API_KEY."""

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from tests.chat_helpers import DEFAULT_FIELDS, chat_body

pytestmark = pytest.mark.live

API_KEY = Settings.from_env().openai_api_key


@pytest.fixture
def live_client(settings: Settings):
    if not API_KEY:
        pytest.skip("OPENAI_API_KEY is not set")
    with TestClient(create_app(replace(settings, openai_api_key=API_KEY))) as client:
        yield client


def test_the_assistant_fills_in_what_the_user_says(live_client: TestClient):
    body = chat_body(
        "Party 1 is Acme Inc., signed by Jo Smith, CEO, jo@acme.com. "
        "The MNDA should be governed by Delaware law, and continue until terminated."
    )
    response = live_client.post("/api/chat", json=body)
    assert response.status_code == 200, response.text
    data = response.json()
    fields = data["fields"]
    assert data["reply"].strip()
    assert "Acme" in fields["parties"][0]["company"]
    assert fields["parties"][0]["name"] == "Jo Smith"
    assert fields["parties"][0]["noticeAddress"] == "jo@acme.com"
    assert "Delaware" in fields["governingLaw"]
    assert fields["mndaTerm"] == "until-terminated"
    # It must not make up the other party.
    assert fields["parties"][1]["company"] == ""


def test_the_assistant_keeps_values_the_user_edited(live_client: TestClient):
    fields = {**DEFAULT_FIELDS, "jurisdiction": "courts located in Austin, TX", "confidentialityYears": "3"}
    body = chat_body("The purpose is to explore a reseller deal.", fields=fields)
    response = live_client.post("/api/chat", json=body)
    assert response.status_code == 200, response.text
    updated = response.json()["fields"]
    assert updated["jurisdiction"] == "courts located in Austin, TX"
    assert updated["confidentialityYears"] == "3"
    assert "resell" in updated["purpose"].lower()

