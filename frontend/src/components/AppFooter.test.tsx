import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DISCLAIMER } from "@/lib/disclaimer";
import { AppFooter } from "./AppFooter";

describe("AppFooter", () => {
  it("reminds every screen that the documents are drafts", () => {
    const html = renderToStaticMarkup(<AppFooter />);
    expect(html).toContain("<footer");
    expect(html).toContain(DISCLAIMER);
  });
});
