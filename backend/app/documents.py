"""The agreements prelegal can draft, and the fields that complete each one's cover page.

documents.json at the repo root defines each agreement's parties and fields, and catalog.json names and describes it.
The frontend reads the same two files, so both sides agree on the fields. Every value is a string, and "" means the
user hasn't given it yet: a suggested default only goes in once the user agrees to it.
"""

import json
import re
from datetime import date
from functools import cached_property
from pathlib import Path
from typing import Literal, Self

from pydantic import BaseModel, ConfigDict, model_validator
from pydantic.alias_generators import to_camel

from app.config import DOCUMENTS_DIR

# The frontend has the same rules (frontend/src/lib/documents/fields.ts); testdata/field-values.json checks
# that both sides agree on which values are usable.
MAX_YEARS = 999
MAX_TEXT = 500
MAX_LONG_TEXT = 5000

PARTY_LABELS = {
    "company": "legal company name",
    "name": "signer's name",
    "title": "signer's title",
    "noticeAddress": "notice address",
}
PARTY_KEYS = {f"party{index + 1}.{name}": (index, name) for index in (0, 1) for name in PARTY_LABELS}
"""The model's keys for the parties' fields, e.g. "party1.company", with the party's index and the field's name
on the wire."""


class _Definition(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, validate_by_name=True, extra="forbid", frozen=True)


class Option(_Definition):
    value: str
    label: str


class ShowIf(_Definition):
    field: str
    equals: str


class FieldDef(_Definition):
    key: str
    label: str
    kind: Literal["text", "longText", "date", "choice", "years"]
    description: str
    default: str = ""
    """A value the assistant suggests. It is only filled in once the user agrees."""
    placeholder: str = ""
    options: tuple[Option, ...] = ()
    show_if: ShowIf | None = None
    """The field only applies, and only counts as missing, when another field has this value."""
    section: str | None = None

    @model_validator(mode="after")
    def _check(self) -> Self:
        if (self.kind == "choice") != bool(self.options):
            raise ValueError(f"{self.key}: choice fields, and only they, have options")
        if self.default and sanitise(self, self.default) != self.default:
            raise ValueError(f"{self.key}: the default {self.default!r} isn't a valid value")
        return self


class DocumentDef(_Definition):
    id: str
    file: str
    cover_file: str | None = None
    roles: tuple[str, str]
    sections: tuple[str, ...] = ()
    fields: tuple[FieldDef, ...]
    name: str = ""
    """From catalog.json."""
    description: str = ""
    """From catalog.json."""

    @cached_property
    def by_key(self) -> dict[str, FieldDef]:
        return {field.key: field for field in self.fields}

    @model_validator(mode="after")
    def _check(self) -> Self:
        if len(self.by_key) != len(self.fields):
            raise ValueError(f"{self.id}: field keys must be unique")
        for field in self.fields:
            if field.section not in (self.sections or (None,)):
                raise ValueError(f"{self.id}.{field.key}: section {field.section!r} isn't one of {self.sections}")
            if field.show_if:
                target = self.by_key.get(field.show_if.field)
                if not target or field.show_if.equals not in {option.value for option in target.options}:
                    raise ValueError(f"{self.id}.{field.key}: showIf must name a choice field and one of its values")
        return self


class Registry(_Definition):
    shared_fields: tuple[str, ...]
    """Kept when the assistant switches to another agreement that has them. The parties are always kept."""
    documents: tuple[DocumentDef, ...]

    @cached_property
    def by_id(self) -> dict[str, DocumentDef]:
        return {document.id: document for document in self.documents}

    @cached_property
    def field_keys(self) -> tuple[str, ...]:
        """Every key the model may update, across all agreements, in a stable order."""
        keys = dict.fromkeys(field.key for document in self.documents for field in document.fields)
        return (*PARTY_KEYS, *keys)


def load_registry(directory: Path) -> Registry:
    """Reads documents.json and catalog.json from `directory`."""
    registry = Registry.model_validate_json((directory / "documents.json").read_text(encoding="utf-8"))
    catalog = {entry["filename"]: entry for entry in json.loads((directory / "catalog.json").read_text("utf-8"))}
    documents = []
    for document in registry.documents:
        entry = catalog.get(document.file)
        if entry is None:
            raise ValueError(f"{document.id}: {document.file} isn't in catalog.json")
        documents.append(document.model_copy(update={"name": entry["name"], "description": entry["description"]}))
    if len({document.id for document in documents}) != len(documents):
        raise ValueError("document ids must be unique")
    return registry.model_copy(update={"documents": tuple(documents)})


def sanitise(field: FieldDef, value: str) -> str | None:
    """`value` as the field stores it, or None if the field can't use it. "" (not given yet) always fits."""
    value = value.strip()
    if not value:
        return ""
    match field.kind:
        case "text" | "longText":
            usable = len(value) <= (MAX_LONG_TEXT if field.kind == "longText" else MAX_TEXT)
        case "years":
            usable = re.fullmatch(r"[0-9]+", value) is not None and 1 <= int(value) <= MAX_YEARS
        case "date":
            try:
                usable = re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value) is not None and bool(date.fromisoformat(value))
            except ValueError:
                usable = False
        case "choice":
            # The model sometimes answers with an option's label rather than its value.
            for option in field.options:
                if value.casefold() in (option.value.casefold(), option.label.casefold()):
                    return option.value
            usable = False
    return value if usable else None


def applies(field: FieldDef, values: dict[str, str]) -> bool:
    return field.show_if is None or values.get(field.show_if.field) == field.show_if.equals


def missing_keys(document: DocumentDef, values: dict[str, str], parties: list[dict[str, str]]) -> list[str]:
    """The keys still to fill in, in the order the assistant asks for them: the parties, then the fields. `parties`
    are as on the wire, e.g. {"company": "Acme", ..., "noticeAddress": "..."}."""
    missing = [key for key, (index, name) in PARTY_KEYS.items() if not parties[index][name].strip()]
    # A value the field can't use, e.g. "0" years typed into the form, is as good as missing (as in the preview).
    missing += [
        field.key for field in document.fields if applies(field, values) and not sanitise(field, values.get(field.key, ""))
    ]
    return missing


def describe_key(document: DocumentDef, key: str) -> str:
    """A key as the user would name it, e.g. "Customer's signer's name" or "Governing Law"."""
    if key in PARTY_KEYS:
        index, name = PARTY_KEYS[key]
        return f"{document.roles[index]}'s {PARTY_LABELS[name]}"
    return document.by_key[key].label


def switch_document(values: dict[str, str], new: DocumentDef) -> dict[str, str]:
    """The values a switch to `new` keeps: the shared fields that `new` also has."""
    return {key: values[key] for key in REGISTRY.shared_fields if key in new.by_key and values.get(key)}


REGISTRY = load_registry(DOCUMENTS_DIR)
"""Loaded once at import: the model's answer schema is built from it."""
