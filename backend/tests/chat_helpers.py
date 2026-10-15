import copy

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
