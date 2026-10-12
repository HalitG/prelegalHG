/**
 * A deliberately small parser for the markdown subset used by the Common Paper
 * templates: headings, numbered clauses, and paragraphs containing **bold**,
 * [links](url) and <span class="coverpage_link">Cover Page term</span> references.
 * The output is plain data so it can be rendered both as HTML and as a PDF.
 */

export type Run =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  /** A defined term whose value lives on the Cover Page (e.g. "Purpose"). */
  | { type: "term"; text: string }
  | { type: "link"; text: string; href: string };

export type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "clause"; number: number; runs: Run[] }
  | { type: "paragraph"; runs: Run[] };

const INLINE_PATTERN =
  /\*\*(.+?)\*\*|<span class="coverpage_link">(.+?)<\/span>|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(source: string): Run[] {
  const runs: Run[] = [];
  let cursor = 0;

  for (const match of source.matchAll(INLINE_PATTERN)) {
    if (match.index > cursor) {
      runs.push({ type: "text", text: source.slice(cursor, match.index) });
    }
    const [, bold, term, linkText, href] = match;
    if (bold !== undefined) runs.push({ type: "bold", text: bold });
    else if (term !== undefined) runs.push({ type: "term", text: term });
    else runs.push({ type: "link", text: linkText, href });
    cursor = match.index + match[0].length;
  }

  if (cursor < source.length) {
    runs.push({ type: "text", text: source.slice(cursor) });
  }
  return runs;
}

export function parseBlocks(markdown: string): Block[] {
  return markdown
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim().replace(/\s*\n\s*/g, " "))
    .filter(Boolean)
    .map((chunk): Block => {
      const heading = chunk.match(/^(#{1,6})\s+(.*)$/);
      if (heading) return { type: "heading", level: heading[1].length, text: heading[2] };

      const clause = chunk.match(/^(\d+)\.\s+(.*)$/);
      if (clause) return { type: "clause", number: Number(clause[1]), runs: parseInline(clause[2]) };

      return { type: "paragraph", runs: parseInline(chunk) };
    });
}
