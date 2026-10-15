import pytest
from fastapi.testclient import TestClient

from tests.auth_helpers import sign_up
from tests.chat_helpers import ACME, GLOBEX, GREETING, NO_PARTIES, a_party, complete_nda_values

ID = "0123456789abcdef0123456789abcdef"
OTHER_ID = "fedcba9876543210fedcba9876543210"
CONVERSATION = [GREETING, {"role": "user", "content": "A mutual NDA, please."}]


def draft(document="mutual-nda", values: dict | None = None, parties: list | None = None, messages=None, revision=1):
    return {
        "document": document,
        "values": values or {},
        "parties": parties or NO_PARTIES,
        "messages": CONVERSATION if messages is None else messages,
        "revision": revision,
    }


@pytest.fixture
def other_user(signed_in: TestClient) -> TestClient:
    """A second user of the same app, with their own cookies. Not entered, so the database isn't reset."""
    other = TestClient(signed_in.app)
    sign_up(other, email="sam@globex.com", name="Sam Lee")
    return other


# Saving and reopening


def test_saving_creates_the_agreement_and_reopening_restores_it(signed_in: TestClient):
    body = draft(values={"purpose": "Exploring a deal"}, parties=[ACME, a_party("Globex")])
    response = signed_in.put(f"/api/documents/{ID}", json=body)
    assert response.status_code == 200
    assert response.json()["id"] == ID

    saved = signed_in.get(f"/api/documents/{ID}").json()
    assert saved == {**body, "id": ID, "updatedAt": response.json()["updatedAt"]}


def test_saving_again_replaces_the_agreement(signed_in: TestClient):
    first = signed_in.put(f"/api/documents/{ID}", json=draft()).json()
    longer = [*CONVERSATION, {"role": "assistant", "content": "Who are the parties?"}]
    body = draft(values={"purpose": "A deal"}, messages=longer, revision=2)
    second = signed_in.put(f"/api/documents/{ID}", json=body).json()
    assert second["updatedAt"] > first["updatedAt"]

    saved = signed_in.get(f"/api/documents/{ID}").json()
    assert saved["values"] == {"purpose": "A deal"}
    assert saved["messages"] == longer
    assert len(signed_in.get("/api/documents").json()) == 1


def test_a_save_that_arrives_after_a_later_one_is_ignored(signed_in: TestClient):
    signed_in.put(f"/api/documents/{ID}", json=draft(values={"purpose": "latest"}, revision=3))
    response = signed_in.put(f"/api/documents/{ID}", json=draft(values={"purpose": "older"}, revision=2))
    assert response.status_code == 200
    assert signed_in.get(f"/api/documents/{ID}").json()["values"] == {"purpose": "latest"}
    # The same revision again, e.g. from a second tab, is saved.
    signed_in.put(f"/api/documents/{ID}", json=draft(values={"purpose": "again"}, revision=3))
    assert signed_in.get(f"/api/documents/{ID}").json()["revision"] == 3
    assert signed_in.get(f"/api/documents/{ID}").json()["values"] == {"purpose": "again"}


def test_my_documents_lists_each_agreement_newest_first(signed_in: TestClient):
    signed_in.put(f"/api/documents/{ID}", json=draft(values=complete_nda_values(), parties=[ACME, GLOBEX]))
    signed_in.put(f"/api/documents/{OTHER_ID}", json=draft("csa", parties=[a_party("Initech"), a_party("")]))

    documents = signed_in.get("/api/documents").json()
    assert [document["id"] for document in documents] == [OTHER_ID, ID]
    csa, nda = documents
    assert csa["document"] == "csa"
    assert csa["documentName"] == "Cloud Service Agreement"
    assert csa["companies"] == ["Initech", ""]
    assert csa["missing"] > 0
    assert nda["documentName"] == "Mutual Non-Disclosure Agreement"
    assert nda["companies"] == ["Acme, Inc.", "Globex Corporation"]
    assert nda["missing"] == 0
    assert set(nda) == {"id", "document", "documentName", "companies", "missing", "updatedAt"}


def test_my_documents_is_empty_at_first(signed_in: TestClient):
    assert signed_in.get("/api/documents").json() == []


def test_deleting_an_agreement(signed_in: TestClient):
    signed_in.put(f"/api/documents/{ID}", json=draft())
    assert signed_in.delete(f"/api/documents/{ID}").status_code == 204
    assert signed_in.get(f"/api/documents/{ID}").status_code == 404
    assert signed_in.delete(f"/api/documents/{ID}").status_code == 404
    assert signed_in.get("/api/documents").json() == []


def test_an_unknown_agreement_is_not_found(signed_in: TestClient):
    response = signed_in.get(f"/api/documents/{ID}")
    assert response.status_code == 404
    assert response.json() == {"detail": "Agreement not found."}


# Each user sees only their own agreements


def test_another_users_agreement_is_not_found(signed_in: TestClient, other_user: TestClient):
    signed_in.put(f"/api/documents/{ID}", json=draft(values={"purpose": "Jo's deal"}))

    assert other_user.get("/api/documents").json() == []
    assert other_user.get(f"/api/documents/{ID}").status_code == 404
    assert other_user.put(f"/api/documents/{ID}", json=draft(values={"purpose": "Sam's"})).status_code == 404
    assert other_user.delete(f"/api/documents/{ID}").status_code == 404

    assert signed_in.get(f"/api/documents/{ID}").json()["values"] == {"purpose": "Jo's deal"}


@pytest.mark.parametrize(
    ("method", "path"),
    [("GET", "/api/documents"), ("GET", f"/api/documents/{ID}"), ("PUT", f"/api/documents/{ID}"),
     ("DELETE", f"/api/documents/{ID}")],
)
def test_my_documents_are_only_for_signed_in_users(client: TestClient, method: str, path: str):
    response = client.request(method, path, json=draft() if method == "PUT" else None)
    assert response.status_code == 401


# What can be saved


@pytest.mark.parametrize(
    "body",
    [
        draft(document=None),
        draft(document="employment-contract"),
        draft(values={"notAField": "x"}),
        draft(messages=[]),
        draft(messages=[GREETING] * 101),
        {**draft(), "extra": 1},
        draft(revision=0),
    ],
    ids=["no agreement", "unknown agreement", "unknown field", "no messages", "too many messages", "extra key",
         "no revision"],
)
def test_saving_rejects_what_the_chat_would_reject(signed_in: TestClient, body: dict):
    assert signed_in.put(f"/api/documents/{ID}", json=body).status_code == 422


@pytest.mark.parametrize("document_id", ["1", ID.upper(), ID + "0", "g" * 32])
def test_agreement_ids_are_32_hex_characters(signed_in: TestClient, document_id: str):
    assert signed_in.put(f"/api/documents/{document_id}", json=draft()).status_code == 422
    assert signed_in.get("/api/documents").json() == []
