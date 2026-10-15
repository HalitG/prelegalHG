import fs from "node:fs";
import path from "node:path";
import type { DocumentDef } from "./types";

/**
 * Reads the agreements at build time: their fields from documents.json and their names and descriptions from
 * catalog.json, both at the repo root. The backend reads the same files (backend/app/documents.py). Node only.
 */

const REPO_DIR = path.join(process.cwd(), "..");

function readRepoFile(...parts: string[]): string {
  const file = path.join(REPO_DIR, ...parts);
  if (!fs.existsSync(file)) {
    throw new Error(`Not found: ${file}. Run the app from frontend/ inside the full prelegal repo.`);
  }
  return fs.readFileSync(file, "utf-8");
}

interface CatalogEntry {
  name: string;
  description: string;
  filename: string;
}

export function loadDocuments(): DocumentDef[] {
  const { documents } = JSON.parse(readRepoFile("documents.json")) as {
    documents: Omit<DocumentDef, "name" | "description">[];
  };
  const catalog = JSON.parse(readRepoFile("catalog.json")) as CatalogEntry[];
  return documents.map((document) => {
    const entry = catalog.find((candidate) => candidate.filename === document.file);
    if (!entry) throw new Error(`${document.id}: ${document.file} isn't in catalog.json`);
    return { ...document, name: entry.name, description: entry.description };
  });
}

/** A template's markdown from templates/. */
export function readTemplate(file: string): string {
  return readRepoFile("templates", file);
}
