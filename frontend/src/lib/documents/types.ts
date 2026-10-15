import type { Block, Inline } from "./parse";

/**
 * The agreements and their fields, from documents.json and catalog.json at the repo root (see registry.ts). The
 * JSON is trusted as it is: the backend's tests validate it against the same shapes (backend/app/documents.py).
 */

export interface FieldDef {
  key: string;
  label: string;
  kind: "text" | "longText" | "date" | "choice" | "years";
  description: string;
  /** A value the assistant suggests. It is only filled in once the user agrees. */
  default?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  /** The field only applies, and only counts as missing, when another field has this value. */
  showIf?: { field: string; equals: string };
  section?: string;
}

export interface DocumentDef {
  id: string;
  /** From catalog.json. */
  name: string;
  /** From catalog.json. */
  description: string;
  /** The Standard Terms in templates/. */
  file: string;
  /** A cover page template in templates/; only the Mutual NDA has one. */
  coverFile?: string;
  roles: [string, string];
  /** Headings that group the fields on the cover page, e.g. "Order Form" and "Key Terms". */
  sections?: string[];
  fields: FieldDef[];
}

export interface Party {
  company: string;
  name: string;
  title: string;
  noticeAddress: string;
}

/** The agreement being drafted. Every value is a string; "" means the user hasn't given it yet. */
export interface DocState {
  /** The chosen agreement's id, or null until the assistant and the user have chosen one. */
  document: string | null;
  values: Record<string, string>;
  parties: [Party, Party];
}

export const emptyParty: Party = { company: "", name: "", title: "", noticeAddress: "" };

export const emptyState: DocState = { document: null, values: {}, parties: [emptyParty, emptyParty] };

/** An agreement's text, parsed from its templates at build time and fetched by the page (see build.ts). */
export interface DocumentText {
  /** The cover page's introduction, if the agreement has a cover page template. */
  intro: Inline[] | null;
  /** The Standard Terms. */
  terms: Block[];
}
