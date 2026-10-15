import { describe, expect, it } from "vitest";
import { buildCoverPage, type CoverPageModel, type Piece } from "./coverPage";
import { loadDocuments } from "./registry";
import { emptyState, type DocState } from "./types";

const documents = loadDocuments();
const byId = (id: string) => documents.find((document) => document.id === id)!;

const parties: DocState["parties"] = [
  { company: "Acme, Inc.", name: "Ada Lovelace", title: "CEO", noticeAddress: "ada@acme.test" },
  { company: "Globex", name: "Hank Scorpio", title: "Founder", noticeAddress: "1 Main St, Springfield" },
];

const filledNda: DocState = {
  document: "mutual-nda",
  values: {
    purpose: "Evaluating a partnership.",
    effectiveDate: "2026-03-01",
    mndaTerm: "expires",
    mndaTermYears: "1",
    confidentialityTerm: "years",
    confidentialityYears: "1",
    governingLaw: "Delaware",
    chosenCourts: "courts located in New Castle, DE",
    modifications: "None",
  },
  parties,
};

/** Flattens a paragraph to the text a reader would see. */
const text = (pieces: Piece[]) =>
  pieces.map((piece) => (typeof piece === "string" ? piece : piece.value || `[${piece.placeholder}]`)).join("");

const sections = (model: CoverPageModel) => model.groups.flatMap((group) => group.sections);

const ndaSection = (values: Record<string, string>, title: string) =>
  sections(buildCoverPage(byId("mutual-nda"), { ...filledNda, values: { ...filledNda.values, ...values } }))
    .find((section) => section.title === title)!
    .paragraphs.map(text);

const row = (model: CoverPageModel, label: string) =>
  model.signatureRows.find((candidate) => candidate.label === label)!.cells.map((cell) => text([cell]));

describe("the Mutual NDA cover page", () => {
  it("shows the Effective Date, or a placeholder until it is known", () => {
    expect(ndaSection({}, "Effective Date")).toEqual(["March 1, 2026"]);
    expect(ndaSection({ effectiveDate: "" }, "Effective Date")).toEqual(["[Effective date]"]);
  });

  it("words each MNDA term option like the template", () => {
    expect(ndaSection({ mndaTermYears: "2" }, "MNDA Term")).toEqual(["Expires 2 years from Effective Date."]);
    expect(ndaSection({ mndaTerm: "until-terminated" }, "MNDA Term")).toEqual([
      "Continues until terminated in accordance with the terms of the MNDA.",
    ]);
    expect(ndaSection({ mndaTerm: "" }, "MNDA Term")).toEqual(["[Fixed number of years, or until terminated]"]);
  });

  it("words each confidentiality option like the template", () => {
    expect(ndaSection({}, "Term of Confidentiality")[0]).toMatch(/^1 year from Effective Date, but in the case/);
    expect(ndaSection({ confidentialityTerm: "perpetual" }, "Term of Confidentiality")).toEqual(["In perpetuity."]);
  });

  it("shows the governing law, the courts and the modifications", () => {
    expect(ndaSection({}, "Governing Law & Jurisdiction")).toEqual([
      "Governing Law: Delaware",
      "Jurisdiction: courts located in New Castle, DE",
    ]);
    expect(ndaSection({}, "MNDA Modifications")).toEqual(["None"]);
  });

  it("dates both signature columns with the Effective Date, or leaves them blank", () => {
    const model = (effectiveDate: string) =>
      buildCoverPage(byId("mutual-nda"), { ...filledNda, values: { ...filledNda.values, effectiveDate } });
    expect(row(model("2026-03-01"), "Date")).toEqual(["March 1, 2026", "March 1, 2026"]);
    expect(row(model(""), "Date")).toEqual(["", ""]);
  });

  it("puts each party in its own signature column, headed by its role", () => {
    const model = buildCoverPage(byId("mutual-nda"), filledNda);
    expect(row(model, "Company")).toEqual(["Acme, Inc.", "Globex"]);
    expect(model.roles).toEqual(["Party 1", "Party 2"]);
  });
});

describe("a generated cover page", () => {
  const csa = byId("csa");
  const state: DocState = {
    document: "csa",
    values: { subscriptionPeriod: "1 year", orderDate: "2026-11-01", effectiveDate: "2026-10-15" },
    parties,
  };

  it("has a row for each field, grouped by section", () => {
    const model = buildCoverPage(csa, state);
    expect(model.groups.map((group) => group.title)).toEqual(["Order Form", "Key Terms"]);
    expect(model.groups[0].sections.map((section) => section.title)).toEqual(
      csa.fields.filter((field) => field.section === "Order Form").map((field) => field.label),
    );
    const values = Object.fromEntries(sections(model).map((section) => [section.title, text(section.paragraphs[0])]));
    expect(values["Subscription Period"]).toBe("1 year");
    expect(values["Order Date"]).toBe("November 1, 2026");
  });

  it("suggests the default, or gives an example, while a field is blank", () => {
    const values = Object.fromEntries(
      sections(buildCoverPage(csa, state)).map((section) => [section.title, text(section.paragraphs[0])]),
    );
    expect(values["DPA"]).toBe("[Suggested: None]");
    expect(values["Fees"]).toBe("[e.g. $1,000 per month, invoiced monthly in advance]");
    expect(values["Cloud Service"]).toBe("[To be filled in]");
  });

  it("is signed by the agreement's roles as of its Effective Date", () => {
    const model = buildCoverPage(csa, state);
    expect(model.roles).toEqual(["Provider", "Customer"]);
    expect(model.signingStatement).toBe(
      "By signing this Cover Page, each party agrees to enter into this Cloud Service Agreement as of the Effective Date.",
    );
    expect(row(model, "Date")).toEqual(["October 15, 2026", "October 15, 2026"]);
  });

  it("doesn't mention an Effective Date when the agreement has none", () => {
    const model = buildCoverPage(byId("dpa"), { ...emptyState, document: "dpa" });
    expect(model.signingStatement).toBe(
      "By signing this Cover Page, each party agrees to enter into this Data Processing Agreement.",
    );
    expect(model.groups).toHaveLength(1);
    expect(model.groups[0].title).toBeUndefined();
  });
});
