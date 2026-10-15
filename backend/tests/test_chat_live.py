"""Checks the AI chat against the real OpenAI API. Run with `uv run pytest -m live`; it needs OPENAI_API_KEY."""

from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from tests.chat_helpers import EMPTY_PARTY, a_party, chat_body

pytestmark = pytest.mark.live

API_KEY = Settings.from_env().openai_api_key
ACME = a_party("Acme, Inc.", "Jo Smith", "CEO", "jo@acme.com")
GLOBEX = a_party("Globex Corporation", "Sam Lee", "COO", "sam@globex.com")


@pytest.fixture
def live_client(settings: Settings):
    if not API_KEY:
        pytest.skip("OPENAI_API_KEY is not set")
    with TestClient(create_app(replace(settings, openai_api_key=API_KEY))) as client:
        yield client


def chat(client: TestClient, body: dict) -> dict:
    response = client.post("/api/chat", json=body)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["reply"].strip()
    return data


def test_the_assistant_picks_the_agreement_and_fills_in_what_the_user_says(live_client: TestClient):
    data = chat(live_client, chat_body(
        "I need an NDA. Party 1 is Acme Inc., signed by Jo Smith, CEO, jo@acme.com. "
        "It should be governed by Delaware law, and continue until terminated."
    ))
    assert data["document"] == "mutual-nda"
    party1, party2 = data["parties"]
    assert "Acme" in party1["company"]
    assert party1["name"] == "Jo Smith"
    assert party1["noticeAddress"] == "jo@acme.com"
    assert "Delaware" in data["values"]["governingLaw"]
    assert data["values"]["mndaTerm"] == "until-terminated"
    # It must not make up the other party, and it asks for what is still missing.
    assert party2["company"] == ""
    assert data["nextQuestion"].strip().endswith("?")


def test_the_assistant_offers_the_closest_agreement_for_one_it_cant_prepare(live_client: TestClient):
    data = chat(live_client, chat_body("I need an employment contract for a new engineer."))
    # It doesn't pick an agreement until the user agrees to the suggestion.
    assert data["document"] is None
    assert data["nextQuestion"].strip().endswith("?")


def test_the_assistant_switches_agreements_and_keeps_the_shared_details(live_client: TestClient):
    body = chat_body(
        "Actually, Globex will be paying for our hosted software, so we need a Cloud Service Agreement instead.",
        document="pilot",
        values={"governingLaw": "Delaware", "pilotPeriod": "90 days"},
        parties=[ACME, GLOBEX],
    )
    data = chat(live_client, body)
    assert data["document"] == "csa"
    assert data["values"]["governingLaw"] == "Delaware"
    assert data["parties"] == [ACME, GLOBEX]
    assert data["nextQuestion"].strip()


def test_the_assistant_always_asks_a_follow_on_question_while_fields_are_missing(live_client: TestClient):
    body = chat_body("The pilot lasts 60 days.", document="pilot", parties=[ACME, EMPTY_PARTY])
    data = chat(live_client, body)
    assert "60" in data["values"]["pilotPeriod"]
    assert data["nextQuestion"].strip().endswith("?")


def test_the_assistant_keeps_values_the_user_edited(live_client: TestClient):
    values = {"chosenCourts": "courts located in Austin, TX", "confidentialityYears": "3"}
    data = chat(live_client, chat_body("The purpose is to explore a reseller deal.", document="mutual-nda", values=values))
    assert data["values"]["chosenCourts"] == "courts located in Austin, TX"
    assert data["values"]["confidentialityYears"] == "3"
    assert "resell" in data["values"]["purpose"].lower()
