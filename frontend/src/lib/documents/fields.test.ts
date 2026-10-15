import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fieldText, formatDate, formatYears, missingKeys, pdfFileName } from "./fields";
import { loadDocuments } from "./registry";
import { emptyParty, emptyState, type DocState, type Party } from "./types";

const documents = loadDocuments();
const byId = (id: string) => documents.find((document) => document.id === id)!;
const nda = byId("mutual-nda");
const field = (key: string) => nda.fields.find((candidate) => candidate.key === key)!;

const acme: Party = { company: "Acme, Inc.", name: "Ada Lovelace", title: "CEO", noticeAddress: "ada@acme.test" };
const globex: Party = { company: "Globex", name: "Hank Scorpio", title: "Founder", noticeAddress: "1 Main St" };

describe("loadDocuments", () => {
  it("loads every agreement with its name and description from the catalog", () => {
    expect(documents).toHaveLength(11);
    expect(nda.name).toBe("Mutual Non-Disclosure Agreement");
    expect(byId("csa").description).toMatch(/^Common Paper standard Cloud Service Agreement/);
  });
});

describe("formatDate", () => {
  it("formats ISO dates without shifting the day", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
  });

  it("returns an empty string for missing, malformed or impossible dates", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("01/01/2026")).toBe("");
    expect(formatDate("2026-02-30")).toBe("");
  });
});

describe("formatYears", () => {
  it("pluralises whole years", () => {
    expect(formatYears("1")).toBe("1 year");
    expect(formatYears(" 3 ")).toBe("3 years");
  });

  it("rejects values that aren't whole numbers from 1 to 999", () => {
    for (const value of ["", "0", "-1", "1.5", "abc", "1000", "99999999999999999999"]) {
      expect(formatYears(value)).toBe("");
    }
  });
});

describe("fieldText", () => {
  it("shows each kind of field as the agreement words it", () => {
    expect(fieldText(field("purpose"), "  Exploring a deal ")).toBe("Exploring a deal");
    expect(fieldText(field("effectiveDate"), "2026-03-01")).toBe("March 1, 2026");
    expect(fieldText(field("mndaTermYears"), "2")).toBe("2 years");
    expect(fieldText(field("mndaTerm"), "until-terminated")).toBe("Until terminated");
    expect(fieldText(field("mndaTerm"), "forever")).toBe("");
    expect(fieldText(field("purpose"), undefined)).toBe("");
  });
});

describe("usable values", () => {
  // backend/tests/test_documents.py runs the same cases against the chat's rules.
  const { cases } = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "..", "testdata", "field-values.json"), "utf-8"),
  ) as { cases: { document: string; key: string; value: string; usable: boolean }[] };

  it.each(cases)("$key = $value is usable: $usable", ({ document, key, value, usable }) => {
    const definition = byId(document).fields.find((candidate) => candidate.key === key)!;
    expect(fieldText(definition, value) !== "").toBe(usable);
  });
});

describe("missingKeys", () => {
  it("lists the blank party fields, then the fields that apply and are blank or unusable", () => {
    const state: DocState = {
      document: "mutual-nda",
      values: { purpose: "x", mndaTerm: "until-terminated", confidentialityTerm: "years", confidentialityYears: "0" },
      parties: [acme, { ...globex, title: " " }],
    };
    expect(missingKeys(nda, state)).toEqual([
      "party2.title",
      "effectiveDate",
      "confidentialityYears",
      "governingLaw",
      "chosenCourts",
      "modifications",
    ]);
  });

  it("counts everything as missing at first, apart from fields that don't apply yet", () => {
    // 4 fields per party, and every NDA field except the two numbers of years.
    expect(missingKeys(nda, { ...emptyState, document: "mutual-nda" })).toHaveLength(8 + 7);
  });
});

describe("pdfFileName", () => {
  it("names the file after the agreement and both companies", () => {
    expect(pdfFileName(nda, [acme, globex])).toBe("Mutual-Non-Disclosure-Agreement_Acme-Inc_Globex.pdf");
  });

  it("leaves out companies that aren't known yet", () => {
    expect(pdfFileName(byId("csa"), [emptyParty, emptyParty])).toBe("Cloud-Service-Agreement.pdf");
  });
});
