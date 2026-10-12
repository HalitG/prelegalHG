import { describe, expect, it } from "vitest";
import { buildCoverPage, countMissing, formatDate, formatYears, pdfFileName, type Piece } from "./coverPage";
import { defaultFormData, type NdaFormData } from "./types";

const filledForm: NdaFormData = {
  ...defaultFormData,
  effectiveDate: "2026-03-01",
  governingLaw: "Delaware",
  jurisdiction: "courts located in New Castle, DE",
  parties: [
    { company: "Acme, Inc.", name: "Ada Lovelace", title: "CEO", noticeAddress: "ada@acme.test" },
    { company: "Globex", name: "Hank Scorpio", title: "Founder", noticeAddress: "1 Main St, Springfield" },
  ],
};

/** Flattens a paragraph to the text a reader would see. */
const text = (pieces: Piece[]) =>
  pieces.map((piece) => (typeof piece === "string" ? piece : piece.value || `[${piece.placeholder}]`)).join("");

const section = (form: NdaFormData, title: string) =>
  buildCoverPage(form, "2026-10-12").sections.find((s) => s.title === title)!.paragraphs.map(text);

describe("formatDate", () => {
  it("formats ISO dates without shifting the day", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
  });

  it("returns an empty string for missing or malformed dates", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("01/01/2026")).toBe("");
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

describe("buildCoverPage", () => {
  it("falls back to today's date until the user picks one", () => {
    expect(section({ ...filledForm, effectiveDate: null }, "Effective Date")).toEqual(["October 12, 2026"]);
    expect(section(filledForm, "Effective Date")).toEqual(["March 1, 2026"]);
  });

  it("words each MNDA term option like the template", () => {
    expect(section({ ...filledForm, mndaTermYears: "2" }, "MNDA Term")).toEqual([
      "Expires 2 years from Effective Date.",
    ]);
    expect(section({ ...filledForm, mndaTerm: "until-terminated" }, "MNDA Term")).toEqual([
      "Continues until terminated in accordance with the terms of the MNDA.",
    ]);
  });

  it("words each confidentiality option like the template", () => {
    expect(section(filledForm, "Term of Confidentiality")[0]).toMatch(/^1 year from Effective Date, but in the case/);
    expect(section({ ...filledForm, confidentialityTerm: "perpetual" }, "Term of Confidentiality")).toEqual([
      "In perpetuity.",
    ]);
  });

  it("states 'None.' when there are no modifications", () => {
    expect(section(filledForm, "MNDA Modifications")).toEqual(["None."]);
    expect(section({ ...filledForm, modifications: "Section 6 excludes backups." }, "MNDA Modifications")).toEqual([
      "Section 6 excludes backups.",
    ]);
  });

  it("dates both signature columns with the Effective Date, or leaves them blank", () => {
    const dateRow = (form: NdaFormData) =>
      buildCoverPage(form, "").signatureRows.find((row) => row.label === "Date")!.cells.map((cell) => text([cell]));
    expect(dateRow(filledForm)).toEqual(["March 1, 2026", "March 1, 2026"]);
    expect(dateRow({ ...filledForm, effectiveDate: "" })).toEqual(["", ""]);
  });

  it("puts each party in its own signature column", () => {
    const company = buildCoverPage(filledForm, "").signatureRows.find((row) => row.label === "Company")!;
    expect(company.cells.map((cell) => text([cell]))).toEqual(["Acme, Inc.", "Globex"]);
  });
});

describe("countMissing", () => {
  it("is zero for a complete form", () => {
    expect(countMissing(buildCoverPage(filledForm, ""))).toBe(0);
  });

  it("counts every blank user field, including invalid years and whitespace-only values", () => {
    const form: NdaFormData = { ...filledForm, governingLaw: "  ", mndaTermYears: "0" };
    expect(countMissing(buildCoverPage(form, ""))).toBe(2);
    // 2 shared terms (law, jurisdiction) + 4 fields per party; purpose, terms and date have defaults.
    expect(countMissing(buildCoverPage(defaultFormData, "2026-10-12"))).toBe(10);
  });
});

describe("pdfFileName", () => {
  it("names the file after both companies", () => {
    expect(pdfFileName(filledForm.parties)).toBe("Mutual-NDA_Acme-Inc_Globex.pdf");
  });

  it("falls back to a generic name", () => {
    expect(pdfFileName(defaultFormData.parties)).toBe("Mutual-NDA.pdf");
  });
});
