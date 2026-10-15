import { field, signatureRows, type CoverPageModel, type Piece } from "./coverPage";
import { formatDate, formatYears } from "./fields";
import type { DocState, DocumentDef } from "./types";

/** The Mutual NDA's cover page, worded like templates/Mutual-NDA-coverpage.md. */
export function buildMndaCoverPage(document: DocumentDef, { values, parties }: DocState): CoverPageModel {
  const value = (key: string) => values[key] ?? "";
  const effectiveDate = formatDate(value("effectiveDate"));

  const mndaTerm: Piece[] =
    value("mndaTerm") === "expires"
      ? ["Expires ", field(formatYears(value("mndaTermYears")), "Number of years"), " from Effective Date."]
      : value("mndaTerm") === "until-terminated"
        ? ["Continues until terminated in accordance with the terms of the MNDA."]
        : [field("", "Fixed number of years, or until terminated")];

  const confidentialityTerm: Piece[] =
    value("confidentialityTerm") === "years"
      ? [
          field(formatYears(value("confidentialityYears")), "Number of years"),
          " from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.",
        ]
      : value("confidentialityTerm") === "perpetual"
        ? ["In perpetuity."]
        : [field("", "Fixed number of years, or in perpetuity")];

  return {
    groups: [
      {
        sections: [
          {
            title: "Purpose",
            caption: "How Confidential Information may be used",
            paragraphs: [[field(value("purpose"), "Purpose")]],
          },
          { title: "Effective Date", paragraphs: [[field(effectiveDate, "Effective date")]] },
          { title: "MNDA Term", caption: "The length of this MNDA", paragraphs: [mndaTerm] },
          {
            title: "Term of Confidentiality",
            caption: "How long Confidential Information is protected",
            paragraphs: [confidentialityTerm],
          },
          {
            title: "Governing Law & Jurisdiction",
            paragraphs: [
              ["Governing Law: ", field(value("governingLaw"), "State")],
              ["Jurisdiction: ", field(value("chosenCourts"), "City or county and state")],
            ],
          },
          { title: "MNDA Modifications", paragraphs: [[field(value("modifications"), "Modifications, or None")]] },
        ],
      },
    ],
    signingStatement: "By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.",
    roles: document.roles,
    signatureRows: signatureRows(parties, effectiveDate),
  };
}
