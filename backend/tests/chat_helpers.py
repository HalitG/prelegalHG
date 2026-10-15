import copy

from app.documents import REGISTRY

EMPTY_PARTY = {"company": "", "name": "", "title": "", "noticeAddress": ""}
NO_PARTIES = [EMPTY_PARTY, EMPTY_PARTY]

GREETING = {"role": "assistant", "content": "Hi! What agreement do you need?"}


def chat_body(
    *messages: str, document: str | None = None, values: dict | None = None, parties: list | None = None
) -> dict:
    """A /api/chat request body: the greeting, then the user's `messages`. Safe to change in place."""
    return copy.deepcopy(
        {
            "messages": [GREETING, *({"role": "user", "content": text} for text in messages)],
            "document": document,
            "values": values or {},
            "parties": parties or NO_PARTIES,
            "today": "2026-10-15",
        }
    )


def a_party(company: str, name: str = "", title: str = "", notice_address: str = "") -> dict:
    return {"company": company, "name": name, "title": title, "noticeAddress": notice_address}


ACME = a_party("Acme, Inc.", "Jo Smith", "CEO", "jo@acme.com")
GLOBEX = a_party("Globex Corporation", "Sam Lee", "COO", "sam@globex.com")


def complete_nda_values(**changes: str) -> dict:
    values = {field.key: "x" for field in REGISTRY.by_id["mutual-nda"].fields}
    return {**values, "effectiveDate": "2026-11-01", "mndaTerm": "expires", "mndaTermYears": "1",
            "confidentialityTerm": "perpetual", "confidentialityYears": "", **changes}
