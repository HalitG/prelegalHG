import type { DocState, DocumentDef, FieldDef, Party } from "./types";

// The backend has the same rules (backend/app/documents.py); testdata/field-values.json at the repo root checks that
// both sides agree on which values are usable.
export const MAX_YEARS = 999;
/** The longest values the backend accepts. */
export const MAX_TEXT = 500;
export const MAX_LONG_TEXT = 5000;
export const MAX_NOTICE_ADDRESS = 1000;

export const PARTY_FIELDS: { key: keyof Party; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "name", label: "Signer name" },
  { key: "title", label: "Signer title" },
  { key: "noticeAddress", label: "Notice address" },
];

/** "2026-10-12" → "October 12, 2026"; anything else → "". Parsed as a local date so it never shifts by a day. */
export function formatDate(iso: string): string {
  const match = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getMonth() !== month - 1) return "";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** "1" → "1 year", "3" → "3 years"; anything but a whole number from 1 to MAX_YEARS → "". */
export function formatYears(years: string): string {
  const trimmed = years.trim();
  const n = Number(trimmed);
  if (!/^\d+$/.test(trimmed) || n < 1 || n > MAX_YEARS) return "";
  return `${n} year${n === 1 ? "" : "s"}`;
}

/** A field's value as the agreement shows it, or "" while it is missing or unusable. */
export function fieldText(field: FieldDef, value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  switch (field.kind) {
    case "date":
      return formatDate(trimmed);
    case "years":
      return formatYears(trimmed);
    case "choice":
      return field.options?.find((option) => option.value === trimmed)?.label ?? "";
    default:
      return trimmed;
  }
}

/** Whether a field applies, given the other values (e.g. a number of years only applies to a fixed term). */
export function applies(field: FieldDef, values: Record<string, string>): boolean {
  return !field.showIf || values[field.showIf.field] === field.showIf.equals;
}

/** The party fields and agreement fields still to fill in, as keys like "party1.company" or "governingLaw". */
export function missingKeys(document: DocumentDef, state: DocState): string[] {
  const parties = state.parties.flatMap((party, index) =>
    PARTY_FIELDS.filter(({ key }) => !party[key].trim()).map(({ key }) => `party${index + 1}.${key}`),
  );
  const fields = document.fields.filter(
    (field) => applies(field, state.values) && !fieldText(field, state.values[field.key]),
  );
  return [...parties, ...fields.map((field) => field.key)];
}

/** e.g. "Mutual-Non-Disclosure-Agreement_Acme-Inc_Globex.pdf" */
export function pdfFileName(document: DocumentDef, parties: Party[]): string {
  const slug = (text: string) =>
    text
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "");
  return `${[document.name, ...parties.map((party) => party.company)].map(slug).filter(Boolean).join("_")}.pdf`;
}
