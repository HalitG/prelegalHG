import json
import re
from pathlib import Path

import pytest

from app.config import REPO_DIR
from app.documents import (
    REGISTRY,
    describe_key,
    load_registry,
    missing_keys,
    sanitise,
    switch_document,
)

CATALOG = json.loads((REPO_DIR / "catalog.json").read_text(encoding="utf-8"))
EMPTY = {"company": "", "name": "", "title": "", "noticeAddress": ""}
FILLED = {"company": "Acme", "name": "Jo", "title": "CEO", "noticeAddress": "jo@acme.com"}

nda = REGISTRY.by_id["mutual-nda"]
csa = REGISTRY.by_id["csa"]


def field(document_id: str, key: str):
    return REGISTRY.by_id[document_id].by_key[key]


# documents.json against the catalog and the templates


def test_every_catalog_entry_is_an_agreement_or_its_cover_page():
    files = {document.file for document in REGISTRY.documents}
    cover_files = {document.cover_file for document in REGISTRY.documents if document.cover_file}
    assert {entry["filename"] for entry in CATALOG} == files | cover_files
    assert len(REGISTRY.documents) == 11


def test_agreements_take_their_name_and_description_from_the_catalog():
    assert nda.name == "Mutual Non-Disclosure Agreement"
    assert csa.description.startswith("Common Paper standard Cloud Service Agreement")


def _normalise(term: str) -> str:
    """ "Customer’s" → "customer", "Subscription Periods" → "subscription period"."""
    term = re.sub(r"['’]s$", "", term.strip()).casefold()
    return term.removesuffix("s")


@pytest.mark.parametrize("document", REGISTRY.documents, ids=lambda document: document.id)
def test_every_term_the_standard_terms_leave_to_the_cover_page_has_a_field(document):
    template = (REPO_DIR / "templates" / document.file).read_text(encoding="utf-8")
    terms = {_normalise(term) for term in re.findall(r'<span class="\w+_link"[^>]*>([^<]+)</span>', template)}
    # The parties' roles are their company names, and each party's notice address is in the signature block.
    covered = {_normalise(name) for name in (*document.roles, "Notice Address", *(f.label for f in document.fields))}
    assert terms - covered == set()


def test_shared_fields_mean_the_same_in_every_agreement():
    for key in REGISTRY.shared_fields:
        kinds = {document.by_key[key].kind for document in REGISTRY.documents if key in document.by_key}
        assert len(kinds) == 1, key


def _write_registry(tmp_path: Path, change) -> Path:
    data = json.loads((REPO_DIR / "documents.json").read_text(encoding="utf-8"))
    change(data["documents"][0])
    (tmp_path / "documents.json").write_text(json.dumps(data), encoding="utf-8")
    (tmp_path / "catalog.json").write_text(json.dumps(CATALOG), encoding="utf-8")
    return tmp_path


def test_load_registry_reads_the_real_files(tmp_path: Path):
    assert load_registry(_write_registry(tmp_path, lambda document: None)) == REGISTRY


@pytest.mark.parametrize(
    "change",
    [
        pytest.param(lambda d: d["fields"].append(d["fields"][0]), id="duplicate key"),
        pytest.param(lambda d: d.update(file="Lease.md"), id="not in the catalog"),
        pytest.param(lambda d: d["fields"][0].update(kind="years"), id="default doesn't fit"),
        pytest.param(lambda d: d["fields"][0].update(section="Order Form"), id="unknown section"),
        pytest.param(lambda d: d["fields"][2].update(options=[]), id="choice without options"),
        pytest.param(lambda d: d["fields"][3].update(showIf={"field": "purpose", "equals": "x"}), id="bad showIf"),
        pytest.param(lambda d: d["fields"][0].update(colour="red"), id="unknown property"),
    ],
)
def test_load_registry_rejects_a_broken_definition(tmp_path: Path, change):
    with pytest.raises(ValueError):
        load_registry(_write_registry(tmp_path, change))


# Values


@pytest.mark.parametrize(
    ("document_id", "key", "value", "expected"),
    [
        ("mutual-nda", "purpose", "  Exploring a deal  ", "Exploring a deal"),
        ("mutual-nda", "purpose", "", ""),
        ("mutual-nda", "governingLaw", "x" * 501, None),
        ("mutual-nda", "purpose", "x" * 5000, "x" * 5000),
        ("mutual-nda", "mndaTermYears", " 3 ", "3"),
        ("mutual-nda", "mndaTermYears", "999", "999"),
        ("mutual-nda", "effectiveDate", "2026-11-01", "2026-11-01"),
        ("mutual-nda", "mndaTerm", "until-terminated", "until-terminated"),
        ("mutual-nda", "mndaTerm", "Until terminated", "until-terminated"),
        ("mutual-nda", "mndaTerm", "forever", None),
    ],
)
def test_sanitise_keeps_values_the_field_can_use(document_id, key, value, expected):
    assert sanitise(field(document_id, key), value) == expected


@pytest.mark.parametrize("years", ["0", "1000", "two", "1.5", "-1", "٣"])
def test_sanitise_rejects_unusable_years(years: str):
    assert sanitise(field("mutual-nda", "mndaTermYears"), years) is None


@pytest.mark.parametrize("value", ["tomorrow", "2026-13-01", "2026-02-30", "11/01/2026", "٢٠٢٦-11-01"])
def test_sanitise_rejects_unusable_dates(value: str):
    assert sanitise(field("mutual-nda", "effectiveDate"), value) is None


def test_missing_keys_lists_the_parties_then_the_fields_that_apply():
    values = {"purpose": "x", "mndaTerm": "until-terminated", "confidentialityTerm": "years", "confidentialityYears": "0"}
    missing = missing_keys(nda, values, [FILLED, {**FILLED, "title": ""}])
    # mndaTermYears doesn't apply to an MNDA that continues until terminated, and 0 years is no use.
    assert missing == ["party2.title", "effectiveDate", "confidentialityYears", "governingLaw", "chosenCourts", "modifications"]


def test_missing_keys_is_empty_when_everything_is_filled_in():
    values = {f.key: "1" if f.kind == "years" else "x" for f in nda.fields}
    values |= {"effectiveDate": "2026-11-01", "mndaTerm": "expires", "confidentialityTerm": "perpetual"}
    assert missing_keys(nda, values, [FILLED] * 2) == []
    assert len(missing_keys(nda, {}, [EMPTY, EMPTY])) == 8 + 7


def test_describe_key_names_parties_by_their_role():
    assert describe_key(csa, "party2.name") == "Customer's signer's name"
    assert describe_key(csa, "party1.company") == "Provider's legal company name"
    assert describe_key(nda, "chosenCourts") == "Jurisdiction"


def test_switching_keeps_only_the_shared_fields_the_new_agreement_has():
    values = {"purpose": "x", "effectiveDate": "2026-11-01", "governingLaw": "Delaware", "chosenCourts": ""}
    assert switch_document(values, csa) == {"effectiveDate": "2026-11-01", "governingLaw": "Delaware"}
    # The DPA has no effective date, governing law or courts of its own.
    assert switch_document(values, REGISTRY.by_id["dpa"]) == {}


FIELD_VALUES = json.loads((REPO_DIR / "testdata" / "field-values.json").read_text(encoding="utf-8"))["cases"]


@pytest.mark.parametrize("case", FIELD_VALUES, ids=lambda case: f"{case['key']}={case['value']!r}")
def test_the_frontend_and_backend_agree_on_which_values_are_usable(case):
    # frontend/src/lib/documents/fields.test.ts runs the same cases against the preview's rules.
    assert (sanitise(field(case["document"], case["key"]), case["value"]) not in (None, "")) == case["usable"]
