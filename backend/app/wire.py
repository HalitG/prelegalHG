"""The JSON shapes shared by the API's modules: camelCase on the wire, snake_case in Python."""

from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator
from pydantic.alias_generators import to_camel

from app.documents import MAX_LONG_TEXT, MAX_TEXT, REGISTRY

MAX_NOTICE_ADDRESS = 1000


class Wire(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True, extra="forbid")


class Party(Wire):
    company: str = Field(max_length=MAX_TEXT)
    name: str = Field(max_length=MAX_TEXT)
    title: str = Field(max_length=MAX_TEXT)
    notice_address: str = Field(max_length=MAX_NOTICE_ADDRESS)


class ChatMessage(Wire):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class DocumentState(Wire):
    document: str | None
    """The chosen agreement's id from documents.json, or None until one is chosen."""
    values: dict[str, str] = Field(max_length=100)
    """The chosen agreement's field values by key. "" or a missing key means not given yet."""
    parties: tuple[Party, Party]

    @model_validator(mode="after")
    def _fits_the_document(self) -> Self:
        if self.document is None:
            if self.values:
                raise ValueError("there are no values until an agreement is chosen")
            return self
        document = REGISTRY.by_id.get(self.document)
        if document is None:
            raise ValueError(f"unknown agreement {self.document!r}")
        for key, value in self.values.items():
            if key not in document.by_key:
                raise ValueError(f"{self.document} has no field {key!r}")
            if len(value) > MAX_LONG_TEXT:
                raise ValueError(f"{key} is too long")
        return self


class User(Wire):
    """A signed-in user, as the API returns them. The password hash never leaves the database."""

    id: int
    name: str
    email: str
