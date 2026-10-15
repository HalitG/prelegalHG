import { describe, expect, it } from "vitest";
import { documentText } from "./build";
import { coverPageIntro, parseInline, parseTemplate, type Block, type Clause, type Inline } from "./parse";
import { loadDocuments, readTemplate } from "./registry";

describe("parseInline", () => {
  it("splits bold, cover page terms and links from plain text", () => {
    expect(
      parseInline(
        'the (“**MNDA**”) for the <span class="coverpage_link">Purpose</span> at [commonpaper.com](https://commonpaper.com).',
      ),
    ).toEqual([
      { type: "text", text: "the (“" },
      { type: "bold", children: [{ type: "text", text: "MNDA" }] },
      { type: "text", text: "”) for the " },
      { type: "term", text: "Purpose" },
      { type: "text", text: " at " },
      { type: "link", text: "commonpaper.com", href: "https://commonpaper.com" },
      { type: "text", text: "." },
    ]);
  });

  it("reads every kind of term, including ones with an anchor id", () => {
    const terms = parseInline(
      '<span class="keyterms_link">General Cap Amount</span>, <span class="orderform_link" id="3.2.a">Uptime Credit</span>, ' +
        '<span class="sow_link">Fees</span>, <span class="businessterms_link">Territory</span>',
    ).filter((run) => run.type === "term");
    expect(terms.map((run) => run.text)).toEqual(["General Cap Amount", "Uptime Credit", "Fees", "Territory"]);
  });

  it("keeps terms inside bold text", () => {
    expect(parseInline('**not more than the <span class="keyterms_link">General Cap Amount</span>.**')).toEqual([
      {
        type: "bold",
        children: [
          { type: "text", text: "not more than the " },
          { type: "term", text: "General Cap Amount" },
          { type: "text", text: "." },
        ],
      },
    ]);
  });

  it("unwraps anchors, keeping what they contain", () => {
    expect(parseInline('<span id="13.1">**"Affiliate"**</span> means <span id="5.3.a">if</span> x<span id="4.1"></span>')).toEqual([
      { type: "bold", children: [{ type: "text", text: '"Affiliate"' }] },
      { type: "text", text: " means if x" },
    ]);
  });

  it("turns autolinks into links, and gives a link without a scheme one", () => {
    expect(parseInline("at <https://commonpaper.com/standards/sla/2.0/>.")[1]).toEqual({
      type: "link",
      text: "https://commonpaper.com/standards/sla/2.0/",
      href: "https://commonpaper.com/standards/sla/2.0/",
    });
    expect(parseInline("[the terms](commonpaper.com/standards/partnership-agreement/1.0)")[0]).toEqual({
      type: "link",
      text: "the terms",
      href: "https://commonpaper.com/standards/partnership-agreement/1.0",
    });
  });
});

describe("parseTemplate", () => {
  it("nests clauses by indentation and numbers them like the agreements' cross-references", () => {
    const blocks = parseTemplate(
      [
        "# Cloud Service Agreement",
        "",
        '1. <span class="header_2" id="1">Service</span>',
        '    1. <span class="header_3" id="1.1">Access and Use.</span>  During the term, Customer may use it.',
        '    2. <span class="header_3" id="1.2">Restrictions.</span>  Customer will not:',
        "        a. copy it; or",
        "            i. sell it.",
        "2. Definitions",
        '    1. <span id="2.1">**"Affiliate"**</span> means a related company.',
      ].join("\n"),
    );
    const [heading, service, definitions] = blocks as [Block, Clause, Clause];
    expect(heading).toEqual({ type: "heading", level: 1, text: "Cloud Service Agreement" });
    expect(service).toMatchObject({ label: "1.", title: "Service", content: [] });
    expect(service.children.map((clause) => [clause.label, clause.title])).toEqual([
      ["1.1", "Access and Use."],
      ["1.2", "Restrictions."],
    ]);
    expect(service.children[0].content).toEqual([{ type: "text", text: "During the term, Customer may use it." }]);
    const [letter] = service.children[1].children;
    expect([letter.label, letter.children[0].label]).toEqual(["(a)", "(i)"]);
    // A plain top-level clause with sub-clauses is a section title.
    expect(definitions).toMatchObject({ label: "2.", title: "Definitions", content: [] });
    expect(definitions.children[0].label).toBe("2.1");
  });

  it("reads clauses separated by blank lines, and a closing paragraph", () => {
    const blocks = parseTemplate("1. **Introduction**. Hi.\r\n\r\n2. **Use**. Bye.\r\n\r\nFree to use under CC BY 4.0.");
    expect(blocks.map((block) => (block.type === "clause" ? block.label : block.type))).toEqual(["1.", "2.", "paragraph"]);
  });
});

/** Every text in a block tree, to check nothing is left unparsed. */
function texts(blocks: (Block | Clause)[]): string[] {
  const inline = (runs: Inline[]): string[] =>
    runs.flatMap((run) => (run.type === "bold" ? inline(run.children) : [run.text]));
  return blocks.flatMap((block) => {
    if (block.type === "heading") return [block.text];
    if (block.type === "paragraph") return inline(block.content);
    return [block.label, block.title ?? "", ...inline(block.content), ...texts(block.children)];
  });
}

describe.each(loadDocuments())("the $name template", (document) => {
  const { terms } = documentText(document);

  it("parses without leaving markup behind", () => {
    const leftovers = texts(terms).filter((text) => /<\/?span|\*\*|\]\(/.test(text));
    expect(leftovers).toEqual([]);
  });

  it("starts with the agreement's title and numbers its sections in order", () => {
    expect(terms[0]).toMatchObject({ type: "heading", level: 1 });
    const sections = terms.filter((block) => block.type === "clause");
    expect(sections.map((section) => section.label)).toEqual(sections.map((_, i) => `${i + 1}.`));
  });
});

describe("coverPageIntro", () => {
  it("reads the Mutual NDA cover page introduction", () => {
    expect(coverPageIntro(readTemplate("Mutual-NDA-coverpage.md"))[0]).toEqual({
      type: "text",
      text: "This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“",
    });
  });

  it("fails loudly when there is no introduction", () => {
    expect(() => coverPageIntro("# Title\n\nText")).toThrow();
  });
});
