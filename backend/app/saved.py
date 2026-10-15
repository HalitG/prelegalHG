"""The agreements each user has drafted, saved as they work so they can come back to them.

The browser makes each agreement's id, so saving is one idempotent PUT however often it happens. A saved agreement
holds the agreement as the chat sends it (DocumentState) and the conversation, so reopening it restores both. Each
save carries a revision that goes up by one: a save that arrives after a later one (say, the one sent as the tab
closes) is ignored rather than undoing it.
Everything is scoped to the signed-in user: someone else's agreement answers 404, as if it didn't exist.
"""

import sqlite3
from typing import Annotated, Self

from fastapi import APIRouter, HTTPException, Path, status
from pydantic import Field, model_validator

from app.auth import SignedIn
from app.db import Connection
from app.documents import REGISTRY, missing_keys
from app.wire import ChatMessage, DocumentState, Wire


class DocumentDraft(DocumentState):
    """What the browser saves: the agreement and the conversation about it."""

    messages: list[ChatMessage] = Field(min_length=1, max_length=100)
    revision: int = Field(ge=1)
    """Counts the browser's saves of this agreement, starting from the revision it was opened at."""

    @model_validator(mode="after")
    def _has_an_agreement(self) -> Self:
        if self.document is None:
            raise ValueError("choose an agreement before saving")
        return self


class SavedDocument(DocumentDraft):
    id: str
    updated_at: str


class DocumentSummary(Wire):
    """An agreement as "My documents" lists it."""

    id: str
    document: str
    document_name: str
    companies: tuple[str, str]
    missing: int
    """How many fields and party details are still to fill in; 0 means ready to sign."""
    updated_at: str


class SaveReceipt(Wire):
    id: str
    updated_at: str


DocumentId = Annotated[str, Path(pattern=r"^[0-9a-f]{32}$", description="32 hex characters, made by the browser")]

router = APIRouter(prefix="/documents", tags=["documents"])


def _summary(row: sqlite3.Row) -> DocumentSummary:
    draft = DocumentDraft.model_validate_json(row["data"])
    document = REGISTRY.by_id[draft.document]
    parties = [party.model_dump(by_alias=True) for party in draft.parties]
    return DocumentSummary(
        id=row["id"],
        document=document.id,
        document_name=document.name,
        companies=(draft.parties[0].company, draft.parties[1].company),
        missing=len(missing_keys(document, draft.values, parties)),
        updated_at=row["updated_at"],
    )


@router.get("")
def list_documents(user: SignedIn, conn: Connection) -> list[DocumentSummary]:
    """The user's agreements, most recently changed first."""
    rows = conn.execute(
        "SELECT id, data, updated_at FROM documents WHERE user_id = ? ORDER BY updated_at DESC, rowid DESC",
        (user.id,),
    )
    return [_summary(row) for row in rows]


@router.get("/{document_id}")
def get_document(document_id: DocumentId, user: SignedIn, conn: Connection) -> SavedDocument:
    row = conn.execute(
        "SELECT data, updated_at FROM documents WHERE id = ? AND user_id = ?", (document_id, user.id)
    ).fetchone()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Agreement not found.")
    draft = DocumentDraft.model_validate_json(row["data"])
    return SavedDocument(**draft.model_dump(), id=document_id, updated_at=row["updated_at"])


@router.put("/{document_id}")
def save_document(document_id: DocumentId, body: DocumentDraft, user: SignedIn, conn: Connection) -> SaveReceipt:
    """Creates the agreement, or replaces it if the user has saved it before, unless this is an older save."""
    with conn:
        row = conn.execute(
            """INSERT INTO documents (id, user_id, data) VALUES (?, ?, ?)
               ON CONFLICT (id) DO UPDATE
                   SET data = excluded.data, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                   WHERE documents.user_id = excluded.user_id
                     AND excluded.data ->> '$.revision' >= documents.data ->> '$.revision'
               RETURNING updated_at""",
            (document_id, user.id, body.model_dump_json(by_alias=True)),
        ).fetchone()
        # Nothing changed: an older save of the user's agreement, which is ignored, or someone else's agreement,
        # which stays as it is.
        row = row or conn.execute(
            "SELECT updated_at FROM documents WHERE id = ? AND user_id = ?", (document_id, user.id)
        ).fetchone()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Agreement not found.")
    return SaveReceipt(id=document_id, updated_at=row["updated_at"])


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: DocumentId, user: SignedIn, conn: Connection) -> None:
    with conn:
        deleted = conn.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (document_id, user.id))
    if not deleted.rowcount:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Agreement not found.")
