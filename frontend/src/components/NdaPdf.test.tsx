import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { buildCoverPage } from "@/lib/nda/coverPage";
import { loadMndaTemplate } from "@/lib/nda/template";
import { defaultFormData, type NdaFormData } from "@/lib/nda/types";
import { NdaPdfDocument, registerPdfFonts } from "./NdaPdf";

registerPdfFonts(path.join(process.cwd(), "public", "fonts"));

const render = (form: NdaFormData) =>
  renderToBuffer(<NdaPdfDocument template={loadMndaTemplate()} coverPage={buildCoverPage(form, "2026-10-12")} />);

describe("NdaPdfDocument", () => {
  it("renders a PDF even when fields are still blank", async () => {
    const buffer = await render(defaultFormData);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("renders user input beyond Western European characters with the embedded font", async () => {
    const buffer = await render({
      ...defaultFormData,
      parties: [
        { company: "Łódź Software Sp. z o.o.", name: "Łukasz Żółć", title: "Prezes", noticeAddress: "ul. Piotrkowska 1" },
        { company: "ООО «Ромашка»", name: "Δημήτρης Παπαδόπουλος", title: "CEO", noticeAddress: "Hà Nội" },
      ],
    });
    expect(buffer.toString("latin1")).toContain("SourceSerif4");
  });
});
