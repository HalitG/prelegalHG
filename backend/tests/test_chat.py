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
    FieldUpdate,
    OpenAIChatService,
    Turn,
    apply_turn,
    build_instructions,
)
from app.config import Settings
from app.documents import REGISTRY
from app.main import create_app
from tests.auth_helpers import sign_up
from tests.chat_helpers import ACME, EMPTY_PARTY, GLOBEX, GREETING, NO_PARTIES, a_party, chat_body, complete_nda_values

def a_turn(document: str = "", reply: str = "Thanks!", next_question: str = "What next?", **updates: str) -> Turn:
    """The model's answer. Keyword arguments are field updates; use party1_company for "party1.company"."""
    return Turn(
        document=document,
        updates=[FieldUpdate(key=key.replace("_", "."), value=value) for key, value in updates.items()],
        reply=reply,
        next_question=next_question,
    )


def a_request(*messages: str, **state) -> ChatRequest:
    return ChatRequest.model_validate(chat_body(*messages, **state))


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
    return FakeChatService(apply_turn(a_turn("csa", "A Cloud Service Agreement it is.", governingLaw="Delaware"),
                                      a_request("We need a SaaS contract under Delaware law.")))


@pytest.fixture
def chat_client(settings: Settings, fake_service: FakeChatService):
    app = create_app(settings)
    app.dependency_overrides[get_chat_service] = lambda: fake_service
    with TestClient(app) as client:
        sign_up(client)
        yield client


# The /api/chat route


def test_chat_returns_the_reply_the_question_and_the_updated_agreement(chat_client: TestClient):
    response = chat_client.post("/api/chat", json=chat_body("We need a SaaS contract under Delaware law."))
    assert response.status_code == 200
    data = response.json()
    assert data["reply"] == "A Cloud Service Agreement it is."
    assert data["nextQuestion"] == "What next?"
    assert data["document"] == "csa"
    assert data["values"]["governingLaw"] == "Delaware"
    assert set(data["values"]) == set(REGISTRY.by_id["csa"].by_key)
    assert data["parties"] == NO_PARTIES


def test_chat_passes_the_conversation_agreement_and_date_to_the_service(
    chat_client: TestClient, fake_service: FakeChatService
):
    body = chat_body("Hello", "Acme and Globex", document="pilot", values={"pilotPeriod": "90 days"},
                     parties=[ACME, EMPTY_PARTY])
    chat_client.post("/api/chat", json=body)
    [request] = fake_service.requests
    assert [(m.role, m.content) for m in request.messages] == [
        ("assistant", GREETING["content"]),
        ("user", "Hello"),
        ("user", "Acme and Globex"),
    ]
    assert request.document == "pilot"
    assert request.values == {"pilotPeriod": "90 days"}
    assert request.parties[0].notice_address == "jo@acme.com"
    assert request.today == date(2026, 10, 15)


def test_chat_without_an_api_key_is_unavailable_but_the_app_still_runs(signed_in: TestClient):
    response = signed_in.post("/api/chat", json=chat_body("Hello"))
    assert response.status_code == 503
    assert "OPENAI_API_KEY" in response.json()["detail"]
    assert signed_in.get("/api/health").status_code == 200


def test_chat_is_only_for_signed_in_users(settings: Settings, fake_service: FakeChatService):
    app = create_app(settings)
    app.dependency_overrides[get_chat_service] = lambda: fake_service
    with TestClient(app) as client:
        response = client.post("/api/chat", json=chat_body("Hello"))
    assert response.status_code == 401
    assert response.json() == {"detail": "Please sign in."}
    assert fake_service.requests == []


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
        pytest.param(lambda body: body.update(document="lease"), id="unknown agreement"),
        pytest.param(lambda body: body.update(values={"fees": "x"}), id="values without an agreement"),
        pytest.param(lambda body: body.update(document="pilot", values={"purpose": "x"}), id="another agreement's field"),
        pytest.param(lambda body: body.update(document="pilot", values={"fees": "x" * 5001}), id="long value"),
        pytest.param(lambda body: body.update(parties=[EMPTY_PARTY]), id="one party"),
        pytest.param(lambda body: body.update(extra="x"), id="unknown property"),
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


# Applying the model's answer


def test_choosing_an_agreement_starts_its_fields_blank():
    response = apply_turn(a_turn("pilot", party1_company="Acme, Inc."), a_request("A pilot with Acme"))
    assert response.document == "pilot"
    assert response.values == dict.fromkeys(REGISTRY.by_id["pilot"].by_key, "")
    assert response.parties[0].company == "Acme, Inc."


def test_updates_fill_in_fields_and_leave_the_others_as_they_are():
    request = a_request("Delaware", document="pilot", values={"pilotPeriod": "90 days", "fees": "None"},
                        parties=[ACME, EMPTY_PARTY])
    response = apply_turn(a_turn("pilot", governingLaw=" Delaware ", party2_name="Sam Lee"), request)
    assert response.values["governingLaw"] == "Delaware"
    assert response.values["pilotPeriod"] == "90 days"
    assert response.values["fees"] == "None"
    assert response.parties[0].model_dump(by_alias=True) == ACME
    assert response.parties[1].name == "Sam Lee"


def test_updates_the_agreement_cant_use_keep_the_previous_value():
    request = a_request("x", document="mutual-nda", values={"mndaTermYears": "2", "effectiveDate": "2026-11-01"})
    turn = a_turn("mutual-nda", mndaTermYears="two", effectiveDate="2026-02-30", mndaTerm="forever",
                  governingLaw="x" * 501, party1_company="x" * 501)
    response = apply_turn(turn, request)
    assert response.values["mndaTermYears"] == "2"
    assert response.values["effectiveDate"] == "2026-11-01"
    assert response.values["mndaTerm"] == ""
    assert response.values["governingLaw"] == ""
    assert response.parties[0].company == ""


def test_a_choice_given_by_its_label_is_stored_as_its_value():
    response = apply_turn(a_turn("mutual-nda", mndaTerm="Until terminated"), a_request("x", document="mutual-nda"))
    assert response.values["mndaTerm"] == "until-terminated"


def test_updates_to_another_agreements_fields_are_ignored():
    response = apply_turn(a_turn("pilot", purpose="Evaluation"), a_request("x", document="pilot"))
    assert "purpose" not in response.values
    # Before an agreement is chosen there are no fields to fill in, only the parties.
    response = apply_turn(a_turn("", governingLaw="Delaware", party1_company="Acme"), a_request("x"))
    assert (response.document, response.values, response.parties[0].company) == (None, {}, "Acme")


def test_an_empty_document_keeps_the_agreement_already_chosen():
    response = apply_turn(a_turn(""), a_request("x", document="pilot", values={"fees": "None"}))
    assert response.document == "pilot"
    assert response.values["fees"] == "None"


def test_switching_agreements_keeps_the_parties_and_shared_fields_only():
    values = complete_nda_values(governingLaw="Delaware", chosenCourts="New Castle, DE")
    request = a_request("Make it a CSA", document="mutual-nda", values=values, parties=[ACME, GLOBEX])
    response = apply_turn(a_turn("csa", subscriptionPeriod="1 year"), request)
    assert response.document == "csa"
    assert response.parties[1].model_dump(by_alias=True) == GLOBEX
    kept = {key: value for key, value in response.values.items() if value}
    assert kept == {"effectiveDate": "2026-11-01", "governingLaw": "Delaware", "chosenCourts": "New Castle, DE",
                    "subscriptionPeriod": "1 year"}


def test_the_server_asks_about_the_first_missing_field_when_the_model_asks_nothing():
    response = apply_turn(a_turn("pilot", next_question="  "), a_request("x", document="pilot", parties=[ACME, GLOBEX]))
    assert response.next_question == "What should the Product be?"
    response = apply_turn(a_turn("csa", next_question=""), a_request("x", document="csa"))
    assert response.next_question == "What should the Provider's legal company name be?"


def test_the_server_asks_which_agreement_while_none_is_chosen():
    assert apply_turn(a_turn("", next_question=""), a_request("Hi")).next_question == (
        "Which agreement would you like to prepare?"
    )
    assert apply_turn(a_turn("", next_question="A lease? How about a CSA?"), a_request("Hi")).next_question == (
        "A lease? How about a CSA?"
    )


def test_there_is_no_next_question_once_the_agreement_is_complete():
    request = a_request("x", document="mutual-nda", values=complete_nda_values(modifications=""), parties=[ACME, GLOBEX])
    response = apply_turn(a_turn("mutual-nda", reply="All done.", next_question="Anything else?", modifications="None"),
                          request)
    assert response.next_question == ""
    assert response.reply == "All done."


def test_the_answer_schema_suits_openai_strict_mode():
    # Strict mode needs every property required and no additional properties, on every object.
    schema = Turn.model_json_schema()
    objects = [schema, *schema.get("$defs", {}).values()]
    for obj in objects:
        assert obj["additionalProperties"] is False
        assert set(obj["required"]) == set(obj["properties"])
    keys = schema["$defs"]["FieldUpdate"]["properties"]["key"]["enum"]
    assert {"party1.company", "party2.noticeAddress", "purpose", "subscriptionPeriod"} <= set(keys)
    assert schema["properties"]["document"]["enum"] == ["", *REGISTRY.by_id]


# The instructions


def test_the_instructions_list_every_agreement_and_say_what_is_missing():
    instructions = build_instructions(a_request("x", document="pilot", values={"fees": "None"}, parties=[ACME, GLOBEX]))
    for document in REGISTRY.documents:
        assert f"- {document.id}: {document.name}." in instructions
    assert "Today is 2026-10-15." in instructions
    assert "The agreement being prepared: Pilot Agreement (id pilot)." in instructions
    assert "party1 is the Provider, party2 is the Customer" in instructions
    assert '"fees": "None"' in instructions
    assert "Still missing: product (Product); effectiveDate (Effective Date); pilotPeriod" in instructions


def test_the_instructions_describe_choices_and_suggested_defaults():
    instructions = build_instructions(a_request("x", document="mutual-nda"))
    assert '- mndaTerm: MNDA Term (choice: "expires" (Fixed term), "until-terminated" (Until terminated))' in instructions
    # The catalog gives a choice's values too, for the turn on which the agreement is picked.
    assert 'mndaTerm ("expires" or "until-terminated")' in instructions
    assert 'Only applies when mndaTerm is "expires".' in instructions
    assert 'Suggested default: "None".' in instructions


def test_before_an_agreement_is_chosen_the_instructions_say_so():
    instructions = build_instructions(a_request("Hi", parties=[ACME, EMPTY_PARTY]))
    assert "No agreement has been chosen yet." in instructions
    assert '"party1.company": "Acme, Inc."' in instructions
    assert "Still missing:" not in instructions


# The OpenAI service, with a stand-in for the OpenAI client


class StubOpenAI:
    def __init__(self, parsed: Turn | None = None, error: Exception | None = None):
        self.parsed = parsed
        self.error = error
        self.calls: list[dict] = []
        self.responses = SimpleNamespace(parse=self._parse)

    def _parse(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        return SimpleNamespace(output_parsed=self.parsed)


def test_openai_service_sends_the_instructions_and_the_conversation():
    stub = StubOpenAI(parsed=a_turn("mutual-nda", "An NDA it is.", "Who are the parties?"))
    request = a_request("I need an NDA.")
    response = OpenAIChatService(stub, "gpt-5.4-mini").respond(request)

    [call] = stub.calls
    assert call["model"] == "gpt-5.4-mini"
    assert call["text_format"] is Turn
    assert call["store"] is False
    assert call["input"] == [GREETING, {"role": "user", "content": "I need an NDA."}]
    assert call["instructions"] == build_instructions(request)

    assert response.reply == "An NDA it is."
    assert response.next_question == "Who are the parties?"
    assert response.document == "mutual-nda"


def test_openai_service_wraps_a_failed_request():
    request = httpx2.Request("POST", "https://api.openai.com/v1/responses")
    stub = StubOpenAI(error=APIConnectionError(request=request))
    with pytest.raises(ChatError):
        OpenAIChatService(stub, "gpt-5.4-mini").respond(a_request("Hello"))


def test_openai_service_treats_a_refusal_as_a_failure():
    with pytest.raises(ChatError):
        OpenAIChatService(StubOpenAI(parsed=None), "gpt-5.4-mini").respond(a_request("Hello"))
