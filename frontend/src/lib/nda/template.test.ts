import { describe, expect, it } from "vitest";
import { loadMndaTemplate } from "./template";

describe("loadMndaTemplate", () => {
  const template = loadMndaTemplate();

  it("extracts the Cover Page introduction", () => {
    expect(template.coverPageIntro[0]).toEqual({
      type: "text",
      text: "This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“",
    });
  });

  it("parses all eleven Standard Terms clauses in order", () => {
    const clauses = template.standardTerms.filter((block) => block.type === "clause");
    expect(clauses.map((clause) => clause.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it("keeps references to Cover Page terms", () => {
    const terms = template.standardTerms.flatMap((block) =>
      block.type === "clause" ? block.runs.filter((run) => run.type === "term").map((run) => run.text) : [],
    );
    expect(new Set(terms)).toEqual(
      new Set(["Purpose", "Effective Date", "MNDA Term", "Term of Confidentiality", "Governing Law", "Jurisdiction"]),
    );
  });
});
