/**
 * A small parser for the markdown the Common Paper templates use: a "#" title, then numbered clauses nested by
 * indentation (four spaces a level), one per line, whose text has **bold**, links, and <span> tags that mark
 * section titles (header_2, header_3), terms defined on the cover page (coverpage_link, keyterms_link,
 * orderform_link, ...) and anchors. The output is plain data, so it can be written to JSON at build time and
 * rendered both as HTML and as a PDF.
 *
 * It imports nothing, so scripts/build-documents.mts can run it with plain Node.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "bold"; children: Inline[] }
  /** A term whose value is set on the cover page, e.g. "Purpose" or "Subscription Period". */
  | { type: "term"; text: string }
  | { type: "link"; text: string; href: string };

export type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; content: Inline[] }
  | Clause;

export interface Clause {
  type: "clause";
  /** The clause number as shown: "1.", "1.1", "(a)" or "(i)". */
  label: string;
  /** The section or clause title, e.g. "Access and Use." */
  title: string | null;
  content: Inline[];
  children: Clause[];
}

const INLINE_PATTERN =
  /\*\*(.+?)\*\*|<span class="\w+_link"[^>]*>(.*?)<\/span>|<span[^>]*>(.*?)<\/span>|<(https?:\/\/[^>\s]+)>|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(source: string): Inline[] {
  const runs: Inline[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = runs.at(-1);
    if (last?.type === "text") last.text += text;
    else runs.push({ type: "text", text });
  };

  let cursor = 0;
  for (const match of source.matchAll(INLINE_PATTERN)) {
    pushText(source.slice(cursor, match.index));
    const [, bold, term, spanned, autolink, linkText, href] = match;
    if (bold !== undefined) runs.push({ type: "bold", children: parseInline(bold) });
    else if (term !== undefined) runs.push({ type: "term", text: term });
    // Anchors (<span id="13.1">) and any other spans just contribute their content.
    else if (spanned !== undefined) parseInline(spanned).forEach((run) => (run.type === "text" ? pushText(run.text) : runs.push(run)));
    else if (autolink !== undefined) runs.push({ type: "link", text: autolink, href: autolink });
    // One template links to "commonpaper.com/..." without a scheme, which a browser would treat as a relative path.
    else runs.push({ type: "link", text: linkText, href: /^[a-z]+:/i.test(href) ? href : `https://${href}` });
    cursor = match.index + match[0].length;
  }
  pushText(source.slice(cursor));
  return runs;
}

const TITLE_PATTERN = /^<span class="header_[23]"[^>]*>(.*?)<\/span>\s*/;

function clauseLabel(depth: number, marker: string, parent: Clause | undefined): string {
  if (depth === 0) return `${marker}.`;
  if (depth === 1 && parent) return `${parent.label.replace(/\.$/, "")}.${marker}`;
  return `(${marker})`;
}

export function parseTemplate(markdown: string): Block[] {
  const blocks: Block[] = [];
  const open: { depth: number; clause: Clause }[] = [];

  for (const line of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    if (!line.trim()) continue;

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    const item = line.match(/^( *)([0-9]+|[a-z]{1,4})\.\s+(.*)$/);
    if (!item) {
      open.length = 0;
      blocks.push(
        heading
          ? { type: "heading", level: heading[1].length, text: heading[2].trim() }
          : { type: "paragraph", content: parseInline(line.trim()) },
      );
      continue;
    }

    const depth = Math.floor(item[1].length / 4);
    while (open.length && open[open.length - 1].depth >= depth) open.pop();
    const parent = open.at(-1)?.clause;
    const title = item[3].match(TITLE_PATTERN);
    const clause: Clause = {
      type: "clause",
      label: clauseLabel(depth, item[2], parent),
      title: title ? title[1].trim() : null,
      content: parseInline((title ? item[3].slice(title[0].length) : item[3]).trim()),
      children: [],
    };

    if (parent) {
      // A top-level clause with only plain text and sub-clauses ("11. Definitions") is a section title.
      const [only] = parent.content;
      if (!parent.title && parent.content.length === 1 && only.type === "text") {
        parent.title = only.text;
        parent.content = [];
      }
      parent.children.push(clause);
    } else {
      blocks.push(clause);
    }
    open.push({ depth, clause });
  }
  return blocks;
}

/** The introduction under the "Using this ..." heading of a cover page template. */
export function coverPageIntro(markdown: string): Inline[] {
  const blocks = parseTemplate(markdown);
  const index = blocks.findIndex((block) => block.type === "heading" && /using this/i.test(block.text));
  const intro = blocks[index + 1];
  if (index === -1 || intro?.type !== "paragraph") throw new Error("The cover page has no introduction");
  return intro.content;
}
