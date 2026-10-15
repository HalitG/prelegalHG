import { applies, fieldText, formatDate } from "./fields";
import { buildMndaCoverPage } from "./mndaCoverPage";
import type { DocState, DocumentDef, FieldDef, Party } from "./types";

/**
 * A value supplied by the user. An empty `value` means it's still missing: the
 * preview shows the placeholder and the PDF leaves a blank line to fill by hand.
 */
export interface Field {
  value: string;
  placeholder: string;
}

/** Fixed text, or a user-supplied field. */
export type Piece = string | Field;

export interface CoverSection {
  title: string;
  caption?: string;
  paragraphs: Piece[][];
}

export interface CoverGroup {
  /** e.g. "Order Form" or "Key Terms"; none when the cover page has a single group. */
  title?: string;
  sections: CoverSection[];
}

export interface SignatureRow {
  label: string;
  caption?: string;
  cells: [Piece, Piece];
  /** Leaves extra room for a handwritten signature. */
  tall?: boolean;
}

/** Renderer-agnostic content of the filled-in cover page, shared by the HTML preview and the PDF. */
export interface CoverPageModel {
  groups: CoverGroup[];
  signingStatement: string;
  /** The parties' roles, which head the signature columns. */
  roles: [string, string];
  signatureRows: SignatureRow[];
}

export function field(value: string, placeholder: string): Field {
  return { value: value.trim(), placeholder };
}

/** The signature block. Signing dates default to `date`; otherwise they are left to fill in by hand. */
export function signatureRows(parties: [Party, Party], date: string): SignatureRow[] {
  const perParty = (pick: (party: Party) => string, placeholder: string): [Field, Field] => [
    field(pick(parties[0]), placeholder),
    field(pick(parties[1]), placeholder),
  ];
  // A blank date is already counted as missing in its own section, so here it just leaves a line.
  const signingDate: Piece = date ? field(date, "") : "";
  return [
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
  ];
}

/** What a blank field shows: the suggested default, or an example. */
function placeholder(definition: FieldDef): string {
  if (definition.default) return `Suggested: ${definition.default}`;
  if (definition.placeholder) return `e.g. ${definition.placeholder}`;
  return "To be filled in";
}

/** A cover page generated from the agreement's fields: one row per field, grouped by its sections. */
function buildGeneratedCoverPage(document: DocumentDef, state: DocState): CoverPageModel {
  const fields = document.fields.filter((definition) => applies(definition, state.values));
  const groups = (document.sections ?? [undefined]).map((title) => ({
    title,
    sections: fields
      .filter((definition) => definition.section === title)
      .map((definition) => ({
        title: definition.label,
        paragraphs: [[field(fieldText(definition, state.values[definition.key]), placeholder(definition))]],
      })),
  }));
  const effectiveDate = document.fields.find((definition) => definition.key === "effectiveDate");
  return {
    groups,
    signingStatement: `By signing this Cover Page, each party agrees to enter into this ${document.name}${
      effectiveDate ? ` as of the ${effectiveDate.label}` : ""
    }.`,
    roles: document.roles,
    signatureRows: signatureRows(state.parties, formatDate(state.values.effectiveDate ?? "")),
  };
}

export function buildCoverPage(document: DocumentDef, state: DocState): CoverPageModel {
  // The Mutual NDA has a cover page template of its own, which words some of its fields as sentences.
  return document.id === "mutual-nda" ? buildMndaCoverPage(document, state) : buildGeneratedCoverPage(document, state);
}
