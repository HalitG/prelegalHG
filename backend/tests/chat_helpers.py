import copy

EMPTY_PARTY = {"company": "", "name": "", "title": "", "noticeAddress": ""}

# The frontend's defaultFormData.
DEFAULT_FIELDS = {
    "purpose": "Evaluating whether to enter into a business relationship with the other party.",
    "effectiveDate": None,
    "mndaTerm": "expires",
    "mndaTermYears": "1",
    "confidentialityTerm": "years",
    "confidentialityYears": "1",
    "governingLaw": "",
    "jurisdiction": "",
    "modifications": "",
    "parties": [EMPTY_PARTY, EMPTY_PARTY],
}

GREETING = {"role": "assistant", "content": "Hi! Who are the two parties?"}


def chat_body(*messages: str, fields: dict | None = None) -> dict:
    """A /api/chat request body: the greeting, then the user's `messages`. Safe to change in place."""
    return copy.deepcopy(
        {
            "messages": [GREETING, *({"role": "user", "content": text} for text in messages)],
            "fields": fields or DEFAULT_FIELDS,
            "today": "2026-10-15",
        }
    )
