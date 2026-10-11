# prelegal frontend

A Next.js app for drafting a Common Paper **Mutual Non-Disclosure Agreement** (Jira PL-3). The user fills in the key
terms, sees the completed agreement update live, and downloads it as a PDF ready for signature.

## Getting started

```bash
npm install
npm run dev     # http://localhost:3000
```

| Script          | Purpose                                  |
| --------------- | ---------------------------------------- |
| `npm run dev`   | Start the development server             |
| `npm run build` | Production build (the page is static)    |
| `npm start`     | Serve the production build               |
| `npm test`      | Run the Vitest unit tests                |
| `npm run lint`  | Lint with ESLint                         |

## How it works

- **Templates are the source of truth.** `src/lib/nda/template.ts` reads `../templates/Mutual-NDA.md` and
  `../templates/Mutual-NDA-coverpage.md` at build time, so run the app from inside this repo. A small parser
  (`src/lib/nda/markdown.ts`) turns the markdown into plain data: clauses made of text, **bold**, links, and references
  to Cover Page terms.
- **One model, two renderers.** `buildCoverPage()` (`src/lib/nda/coverPage.ts`) turns the form into the Cover Page
  content. `NdaPreview` renders that content as HTML, and `NdaPdf` renders it as a PDF with `@react-pdf/renderer`.
- **Missing fields** appear as highlighted placeholders in the preview and as blank lines in the PDF, so a partly
  completed NDA can still be downloaded and finished by hand.
- **The PDF renderer is loaded on demand.** It only loads when someone clicks *Download PDF*, which keeps the initial
  page light.
