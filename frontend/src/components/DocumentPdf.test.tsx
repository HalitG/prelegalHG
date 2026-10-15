import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { documentText } from "@/lib/documents/build";
import { buildCoverPage } from "@/lib/documents/coverPage";
import { loadDocuments } from "@/lib/documents/registry";
import { emptyState, type DocState, type DocumentDef } from "@/lib/documents/types";
import { DocumentPdf, registerPdfFonts } from "./DocumentPdf";

registerPdfFonts(path.join(process.cwd(), "public", "fonts"));

const documents = loadDocuments();

const render = (document: DocumentDef, state: DocState) =>
  renderToBuffer(
    <DocumentPdf document={document} text={documentText(document)} coverPage={buildCoverPage(document, state)} />,
  );

describe("DocumentPdf", () => {
  it.each(documents)("renders the $name even when its fields are still blank", async (document) => {
    const buffer = await render(document, { ...emptyState, document: document.id });
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("renders user input beyond Western European characters with the embedded font", async () => {
    const buffer = await render(documents[0], {
      document: documents[0].id,
      values: {},
      parties: [
        { company: "Łódź Software Sp. z o.o.", name: "Łukasz Żółć", title: "Prezes", noticeAddress: "ul. Piotrkowska 1" },
        { company: "ООО «Ромашка»", name: "Δημήτρης Παπαδόπουλος", title: "CEO", noticeAddress: "Hà Nội" },
      ],
    });
    expect(buffer.toString("latin1")).toContain("SourceSerif4");
  });
});
