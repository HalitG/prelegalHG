import { describe, expect, it } from "vitest";
import { parseBlocks, parseInline } from "./markdown";

describe("parseInline", () => {
  it("splits bold, cover page terms and links from plain text", () => {
    expect(
      parseInline(
        'the (“**MNDA**”) for the <span class="coverpage_link">Purpose</span> at [commonpaper.com](https://commonpaper.com).',
      ),
    ).toEqual([
      { type: "text", text: "the (“" },
      { type: "bold", text: "MNDA" },
      { type: "text", text: "”) for the " },
      { type: "term", text: "Purpose" },
      { type: "text", text: " at " },
      { type: "link", text: "commonpaper.com", href: "https://commonpaper.com" },
      { type: "text", text: "." },
    ]);
  });

  it("returns a single text run when there is no markup", () => {
    expect(parseInline("plain")).toEqual([{ type: "text", text: "plain" }]);
  });
});

describe("parseBlocks", () => {
  it("recognises headings, numbered clauses and paragraphs across CRLF line endings", () => {
    const blocks = parseBlocks("# Title\r\n\r\n1. **Intro**. Text\r\ncontinues.\r\n\r\nFooter");
    expect(blocks).toEqual([
      { type: "heading", level: 1, text: "Title" },
      {
        type: "clause",
        number: 1,
        runs: [
          { type: "bold", text: "Intro" },
          { type: "text", text: ". Text continues." },
        ],
      },
      { type: "paragraph", runs: [{ type: "text", text: "Footer" }] },
    ]);
  });
});
