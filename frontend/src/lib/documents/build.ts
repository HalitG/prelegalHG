import fs from "node:fs";
import path from "node:path";
import { coverPageIntro, parseTemplate } from "./parse.ts";
import { loadDocuments, readTemplate } from "./registry.ts";
import type { DocumentDef, DocumentText } from "./types";

/**
 * Parses each agreement's templates at build time into public/documents/<id>.json, which the page fetches once
 * the chat has chosen that agreement. Together the templates are about 250 KB, too much to put in the page itself.
 */

export function documentText(document: DocumentDef): DocumentText {
  return {
    intro: document.coverFile ? coverPageIntro(readTemplate(document.coverFile)) : null,
    terms: parseTemplate(readTemplate(document.file)),
  };
}

/** Writes every agreement's text to `outDir`, replacing what was there. Returns the file names. */
export function writeDocumentTexts(outDir: string): string[] {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  return loadDocuments().map((document) => {
    const name = `${document.id}.json`;
    fs.writeFileSync(path.join(outDir, name), JSON.stringify(documentText(document)));
    return name;
  });
}
