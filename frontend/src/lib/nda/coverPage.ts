import type { NdaFormData } from "./types";

/**
 * A value supplied by the user. An empty `value` means it's still missing: the
 * preview shows the placeholder and the PDF leaves a blank line to fill by hand.
 */
export interface Field {
  value: string;
  placeholder: string;
}

/** Fixed template text, or a user-supplied field. */
export type Piece = string | Field;

export interface CoverSection {
  title: string;
  caption?: string;
  paragraphs: Piece[][];
}

export interface SignatureRow {
  label: string;
  caption?: string;
  cells: [Piece, Piece];
  /** Leaves extra room for a handwritten signature. */
  tall?: boolean;
}

/** Renderer-agnostic content of the filled-in Cover Page, shared by the HTML preview and the PDF. */
export interface CoverPageModel {
  sections: CoverSection[];
  signatureRows: SignatureRow[];
}

export const SIGNING_STATEMENT =
  "By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.";

const field = (value: string, placeholder: string): Field => ({ value: value.trim(), placeholder });

/** "2026-10-12" → "October 12, 2026". Parsed as a local date so it never shifts by a day. */
export function formatDate(iso: string): string {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const [year, month, day] = match.slice(1).map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export const MAX_YEARS = 999;

/** "1" → "1 year", "3" → "3 years"; anything but a whole number from 1 to MAX_YEARS → "". */
export function formatYears(years: string): string {
  const trimmed = years.trim();
  const n = Number(trimmed);
  if (!/^\d+$/.test(trimmed) || n < 1 || n > MAX_YEARS) return "";
  return `${n} year${n === 1 ? "" : "s"}`;
}

export function buildCoverPage(form: NdaFormData, today: string): CoverPageModel {
  const [party1, party2] = form.parties;
  const perParty = (pick: (p: typeof party1) => string, placeholder: string): [Field, Field] => [
    field(pick(party1), placeholder),
    field(pick(party2), placeholder),
  ];
  const effectiveDate = formatDate(form.effectiveDate ?? today);
  // Signing dates default to the Effective Date. A blank date is already counted as missing
  // in its own section, so here it just leaves a line to fill in by hand.
  const signingDate: Piece = effectiveDate ? field(effectiveDate, "") : "";

  return {
    sections: [
      {
        title: "Purpose",
        caption: "How Confidential Information may be used",
        paragraphs: [[field(form.purpose, "Purpose")]],
      },
      {
        title: "Effective Date",
        paragraphs: [[field(effectiveDate, "Effective date")]],
      },
      {
        title: "MNDA Term",
        caption: "The length of this MNDA",
        paragraphs: [
          form.mndaTerm === "expires"
            ? ["Expires ", field(formatYears(form.mndaTermYears), "Number of years"), " from Effective Date."]
            : ["Continues until terminated in accordance with the terms of the MNDA."],
        ],
      },
      {
        title: "Term of Confidentiality",
        caption: "How long Confidential Information is protected",
        paragraphs: [
          form.confidentialityTerm === "years"
            ? [
                field(formatYears(form.confidentialityYears), "Number of years"),
                " from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.",
              ]
            : ["In perpetuity."],
        ],
      },
      {
        title: "Governing Law & Jurisdiction",
        paragraphs: [
          ["Governing Law: ", field(form.governingLaw, "State")],
          ["Jurisdiction: ", field(form.jurisdiction, "City or county and state")],
        ],
      },
      {
        title: "MNDA Modifications",
        paragraphs: [[form.modifications.trim() ? field(form.modifications, "") : "None."]],
      },
    ],
    signatureRows: [
      { label: "Signature", cells: ["", ""], tall: true },
      { label: "Print Name", cells: perParty((p) => p.name, "Full name") },
      { label: "Title", cells: perParty((p) => p.title, "Title") },
      { label: "Company", cells: perParty((p) => p.company, "Company") },
      {
        label: "Notice Address",
        caption: "Use either email or postal address",
        cells: perParty((p) => p.noticeAddress, "Email or postal address"),
      },
      { label: "Date", cells: [signingDate, signingDate] },
    ],
  };
}

/** Number of user-supplied fields that are still blank. */
export function countMissing(model: CoverPageModel): number {
  const pieces = [
    ...model.sections.flatMap((section) => section.paragraphs.flat()),
    ...model.signatureRows.flatMap((row) => row.cells),
  ];
  return pieces.filter((piece) => typeof piece !== "string" && !piece.value).length;
}

/** e.g. "Mutual-NDA_Acme-Inc_Globex.pdf" */
export function pdfFileName(parties: NdaFormData["parties"]): string {
  const slugs = parties
    .map((party) => party.company.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, ""))
    .filter(Boolean);
  return `${["Mutual-NDA", ...slugs].join("_")}.pdf`;
}
