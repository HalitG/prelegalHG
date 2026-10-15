from datetime import date
from types import SimpleNamespace

import httpx2
import pytest
from fastapi.testclient import TestClient
from openai import APIConnectionError

from app.api import get_chat_service
from app.chat import (
    ChatError,
    ChatRequest,
    ChatResponse,
    NdaFields,
    NdaTurn,
    OpenAIChatService,
    Party,
    TurnParty,
    apply_turn,
    turn_fields,
)
from app.config import Settings
from app.main import create_app
from tests.chat_helpers import DEFAULT_FIELDS, EMPTY_PARTY, GREETING, chat_body

def a_turn(**changes) -> NdaTurn:
    """The model's answer when it changes nothing but `changes`."""
    current = turn_fields(NdaFields.model_validate(DEFAULT_FIELDS))
    return NdaTurn.model_validate({**current, "reply": "Thanks!", **changes})


class FakeChatService:
    def __init__(self, response: ChatResponse | None = None, error: Exception | None = None):
        self.response = response
        self.error = error
        self.requests: list[ChatRequest] = []

    def respond(self, request: ChatRequest) -> ChatResponse:
        self.requests.append(request)
        if self.error:
            raise self.error
        return self.response


@pytest.fixture
def fake_service() -> FakeChatService:
    fields = NdaFields.model_validate({**DEFAULT_FIELDS, "governingLaw": "Delaware"})
    return FakeChatService(ChatResponse(reply="Got it: Delaware law.", fields=fields))


@pytest.fixture
def chat_client(settings: Settings, fake_service: FakeChatService):
    app = create_app(settings)
    app.dependency_overrides[get_chat_service] = lambda: fake_service
    with TestClient(app) as client:
        yield client


# The /api/chat route


def test_chat_returns_the_reply_and_the_updated_fields(chat_client: TestClient):
    response = chat_client.post("/api/chat", json=chat_body("We use Delaware law."))
    assert response.status_code == 200
    assert response.json() == {
        "reply": "Got it: Delaware law.",
        "fields": {**DEFAULT_FIELDS, "governingLaw": "Delaware"},
    }


def test_chat_passes_the_conversation_fields_and_date_to_the_service(
    chat_client: TestClient, fake_service: FakeChatService
):
    acme = {**EMPTY_PARTY, "company": "Acme"}
    fields = {**DEFAULT_FIELDS, "effectiveDate": "2026-11-01", "parties": [acme, EMPTY_PARTY]}
    chat_client.post("/api/chat", json=chat_body("Hello", "Acme and Globex", fields=fields))
    [request] = fake_service.requests
    assert [(m.role, m.content) for m in request.messages] == [
        ("assistant", GREETING["content"]),
        ("user", "Hello"),
        ("user", "Acme and Globex"),
    ]
    assert request.fields.effective_date == "2026-11-01"
    assert request.fields.parties[0].company == "Acme"
    assert request.today == date(2026, 10, 15)


def test_chat_without_an_api_key_is_unavailable_but_the_app_still_runs(client: TestClient):
    response = client.post("/api/chat", json=chat_body("Hello"))
    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]
    assert client.get("/api/health").status_code == 200


def test_an_api_key_enables_the_openai_service(settings: Settings):
    app = create_app(Settings(db_path=settings.db_path, static_dir=settings.static_dir, openai_api_key="sk-test"))
    assert isinstance(app.state.chat_service, OpenAIChatService)


def test_chat_reports_a_failed_ai_service_as_a_bad_gateway(chat_client: TestClient, fake_service: FakeChatService):
    fake_service.error = ChatError("boom")
    response = chat_client.post("/api/chat", json=chat_body("Hello"))
    assert response.status_code == 502
    assert response.json() == {"detail": "The AI assistant couldn't answer. Please try again."}


@pytest.mark.parametrize(
    "change",
    [
        pytest.param(lambda body: body.update(messages=[]), id="no messages"),
        pytest.param(lambda body: body["messages"].pop(), id="ends with the assistant"),
        pytest.param(lambda body: body["messages"].append({"role": "system", "content": "x"}), id="system role"),
        pytest.param(lambda body: body["messages"].append({"role": "user", "content": ""}), id="empty message"),
        pytest.param(
            lambda body: body["messages"].append({"role": "user", "content": "x" * 4001}), id="long message"
        ),
        pytest.param(lambda body: body["messages"].extend([{"role": "user", "content": "x"}] * 100), id="too many"),
        pytest.param(lambda body: body["fields"].update(mndaTerm="forever"), id="unknown term"),
        pytest.param(lambda body: body["fields"].update(parties=[EMPTY_PARTY]), id="one party"),
        pytest.param(lambda body: body["fields"].update(extra="x"), id="unknown field"),
        pytest.param(lambda body: body.update(today="soon"), id="bad date"),
    ],
)
def test_chat_rejects_a_malformed_request(chat_client: TestClient, fake_service: FakeChatService, change):
    body = chat_body("Hello")
    change(body)
    assert chat_client.post("/api/chat", json=body).status_code == 422
    assert fake_service.requests == []


def test_chat_only_answers_post(chat_client: TestClient, fake_service: FakeChatService):
    # Other methods fall through to the frontend, which answers every /api path with a JSON 404.
    response = chat_client.get("/api/chat")
    assert response.status_code == 404
    assert response.json() == {"detail": "Not Found"}
    assert fake_service.requests == []


def test_chat_is_in_the_api_docs(chat_client: TestClient):
    assert "/api/chat" in chat_client.get("/api/openapi.json").json()["paths"]


# Mapping the model's answer onto the fields


def test_turn_fields_names_the_fields_as_the_model_does():
    party = {**EMPTY_PARTY, "noticeAddress": "a@b.co"}
    fields = NdaFields.model_validate({**DEFAULT_FIELDS, "parties": [party, EMPTY_PARTY]})
    data = turn_fields(fields)
    assert data["effective_date"] == ""
    assert data["party_1"]["notice_address"] == "a@b.co"
    assert "parties" not in data
    NdaTurn.model_validate({**data, "reply": ""})


def test_apply_turn_keeps_the_answer():
    party = {"company": "Acme", "name": "Jo", "title": "CEO", "notice_address": "jo@acme.com"}
    turn = a_turn(effective_date="2026-11-01", mnda_term_years=" 3 ", party_1=party, governing_law="Delaware")
    fields = apply_turn(turn, NdaFields.model_validate(DEFAULT_FIELDS))
    assert fields.effective_date == "2026-11-01"
    assert fields.mnda_term_years == "3"
    assert fields.governing_law == "Delaware"
    assert fields.parties[0].model_dump(by_alias=True) == {
        "company": "Acme",
        "name": "Jo",
        "title": "CEO",
        "noticeAddress": "jo@acme.com",
    }


def test_apply_turn_maps_an_empty_effective_date_to_today():
    previous = NdaFields.model_validate({**DEFAULT_FIELDS, "effectiveDate": "2026-11-01"})
    assert apply_turn(a_turn(effective_date=""), previous).effective_date is None


@pytest.mark.parametrize("years", ["", "0", "1000", "two", "1.5", "-1", "٣"])
def test_apply_turn_keeps_the_previous_years_when_the_answer_is_unusable(years: str):
    previous = NdaFields.model_validate({**DEFAULT_FIELDS, "mndaTermYears": "2", "confidentialityYears": "5"})
    fields = apply_turn(a_turn(mnda_term_years=years, confidentiality_years=years), previous)
    assert (fields.mnda_term_years, fields.confidentiality_years) == ("2", "5")


@pytest.mark.parametrize(
    "effective_date", ["tomorrow", "2026-13-01", "2026-02-30", "11/01/2026", "٢٠٢٦-11-01"]
)
def test_apply_turn_keeps_the_previous_date_when_the_answer_is_unusable(effective_date: str):
    previous = NdaFields.model_validate({**DEFAULT_FIELDS, "effectiveDate": "2026-11-01"})
    assert apply_turn(a_turn(effective_date=effective_date), previous).effective_date == "2026-11-01"


def test_the_answer_has_the_same_fields_as_the_agreement():
    # apply_turn and turn_fields map between the two by name, so they must not drift apart.
    agreement = set(NdaFields.model_fields) - {"parties"} | {"party_1", "party_2"}
    assert set(NdaTurn.model_fields) - {"reply"} == agreement
    assert set(TurnParty.model_fields) == set(Party.model_fields)


def test_the_answer_schema_suits_openai_strict_mode():
    # Strict mode needs every property required and no additional properties, on every object.
    schema = NdaTurn.model_json_schema()
    objects = [schema, *schema.get("$defs", {}).values()]
    for obj in objects:
        assert obj["additionalProperties"] is False
        assert set(obj["required"]) == set(obj["properties"])


# The OpenAI service, with a stand-in for the OpenAI client


class StubOpenAI:
    def __init__(self, parsed: NdaTurn | None = None, error: Exception | None = None):
        self.parsed = parsed
        self.error = error
        self.calls: list[dict] = []
        self.responses = SimpleNamespace(parse=self._parse)

    def _parse(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return SimpleNamespace(output_parsed=self.parsed)


def a_request(*messages: str, fields: dict | None = None) -> ChatRequest:
    return ChatRequest.model_validate(chat_body(*messages, fields=fields))


def test_openai_service_sends_the_instructions_and_the_conversation():
    stub = StubOpenAI(parsed=a_turn(governing_law="Delaware", reply="Delaware it is."))
    fields = {**DEFAULT_FIELDS, "jurisdiction": "courts located in New Castle, DE"}
    response = OpenAIChatService(stub, "gpt-5.4-mini").respond(a_request("Delaware law, please.", fields=fields))

    [call] = stub.calls
    assert call["model"] == "gpt-5.4-mini"
    assert call["text_format"] is NdaTurn
    assert call["store"] is False
    assert call["input"] == [GREETING, {"role": "user", "content": "Delaware law, please."}]
    assert "Mutual Non-Disclosure Agreement" in call["instructions"]
    assert "Today is 2026-10-15." in call["instructions"]
    assert '"jurisdiction": "courts located in New Castle, DE"' in call["instructions"]

    assert response.reply == "Delaware it is."
    assert response.fields.governing_law == "Delaware"


def test_openai_service_wraps_a_failed_request():
    request = httpx2.Request("POST", "https://api.openai.com/v1/responses")
    stub = StubOpenAI(error=APIConnectionError(request=request))
    with pytest.raises(ChatError):
        OpenAIChatService(stub, "gpt-5.4-mini").respond(a_request("Hello"))


def test_openai_service_treats_a_refusal_as_a_failure():
    with pytest.raises(ChatError):
        OpenAIChatService(StubOpenAI(parsed=None), "gpt-5.4-mini").respond(a_request("Hello"))


def test_openai_service_rejects_an_answer_that_does_not_fit_the_agreement():
    stub = StubOpenAI(parsed=a_turn(governing_law="x" * 501))
    with pytest.raises(ChatError):
        OpenAIChatService(stub, "gpt-5.4-mini").respond(a_request("Hello"))

