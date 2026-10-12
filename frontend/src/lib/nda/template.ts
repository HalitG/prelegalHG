import fs from "node:fs";
import path from "node:path";
import { parseBlocks, type Block, type Run } from "./markdown";

/** The repo-level templates/ directory (PL-2) is the single source of truth for agreement text. */
const TEMPLATES_DIR = path.join(process.cwd(), "..", "templates");

export interface MndaTemplate {
  /** The "Using this Mutual Non-Disclosure Agreement" paragraph from the Cover Page. */
  coverPageIntro: Run[];
  /** Heading, numbered clauses and attribution from the Standard Terms. */
  standardTerms: Block[];
}

function readTemplate(filename: string): Block[] {
  const file = path.join(TEMPLATES_DIR, filename);
  if (!fs.existsSync(file)) {
    throw new Error(`Template not found: ${file}. Run the app from frontend/ inside the full prelegal repo.`);
  }
  return parseBlocks(fs.readFileSync(file, "utf-8"));
}

/**
 * Reads the Mutual NDA templates. Uses synchronous I/O so the page is fully
 * prerendered at build time.
 */
export function loadMndaTemplate(): MndaTemplate {
  const coverPage = readTemplate("Mutual-NDA-coverpage.md");
  const introHeading = coverPage.findIndex(
    (block) => block.type === "heading" && /using this/i.test(block.text),
  );
  const intro = introHeading === -1 ? undefined : coverPage[introHeading + 1];
  if (intro?.type !== "paragraph") {
    throw new Error("Mutual-NDA-coverpage.md: could not find the introductory paragraph");
  }

  return {
    coverPageIntro: intro.runs,
    standardTerms: readTemplate("Mutual-NDA.md"),
  };
}
