// Run before `npm run dev` and `npm run build` (see src/lib/documents/build.ts). Node runs TypeScript itself by
// stripping the types, so the files it imports name their .ts extension.
import path from "node:path";
import { writeDocumentTexts } from "../src/lib/documents/build.ts";

const outDir = path.join(import.meta.dirname, "..", "public", "documents");
const written = writeDocumentTexts(outDir);
console.log(`Wrote ${written.length} agreements to public/documents/`);
