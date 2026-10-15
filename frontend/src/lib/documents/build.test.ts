import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { documentText, writeDocumentTexts } from "./build";
import { loadDocuments } from "./registry";

const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "prelegal-documents-"));
afterEach(() => fs.rmSync(outDir, { recursive: true, force: true }));

describe("writeDocumentTexts", () => {
  it("writes each agreement's parsed text to its own JSON file, replacing old files", () => {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "old.json"), "{}");

    const written = writeDocumentTexts(outDir);

    const documents = loadDocuments();
    expect(written).toEqual(documents.map((document) => `${document.id}.json`));
    expect(fs.readdirSync(outDir).sort()).toEqual([...written].sort());
    const nda = JSON.parse(fs.readFileSync(path.join(outDir, "mutual-nda.json"), "utf-8"));
    expect(nda).toEqual(documentText(documents.find((document) => document.id === "mutual-nda")!));
  });
});

describe("documentText", () => {
  it("includes a cover page introduction only for agreements with a cover page template", () => {
    const withIntro = loadDocuments().filter((document) => documentText(document).intro !== null);
    expect(withIntro.map((document) => document.id)).toEqual(["mutual-nda"]);
  });
});
