# prelegal frontend

The prelegal web app, built with Next.js. It has a prototype sign-in page and the **Mutual Non-Disclosure Agreement**
creator: the user fills in the key terms, sees the completed agreement update live, and downloads it as a PDF ready
for signature.

The app is exported as static files (`out/`), which the FastAPI backend in `../backend` serves.

## Getting started

```bash
npm install
npm run dev     # http://localhost:3000
```

| Script          | Purpose                                          |
| --------------- | ------------------------------------------------ |
| `npm run dev`   | Start the development server                     |
| `npm run build` | Build the static export into `out/`              |
| `npm test`      | Run the Vitest unit and component tests          |
| `npm run lint`  | Lint with ESLint                                 |

To see the build served the way it is in production, run the backend (see the main README).

## How it works

- **Static export.** `next.config.ts` sets `output: "export"`, so everything is rendered when the app is built.
  `trailingSlash` makes each route a folder with an `index.html` (`out/login/index.html`), which is what the backend
  serves. Features that need a running Next.js server (Cache Components, server actions, rewrites, cookies) are not
  available.
- **Prototype sign-in.** `/login/` accepts any email and password. `src/lib/session.ts` keeps the email in
  `localStorage` and is the only code that knows how the session works, so real sign-in can replace it. Pages in the
  `src/app/(platform)/` route group are wrapped in `AuthGuard`, which sends signed-out visitors to `/login/`. Until
  the browser has read the session, the guard shows a placeholder, so signed-out visitors never see the platform.
  This is not access control: the static HTML still carries the page's data, so anything private must come from
  the backend once real sign-in exists.
- **Templates are the source of truth.** `src/lib/nda/template.ts` reads `../templates/Mutual-NDA.md` and
  `../templates/Mutual-NDA-coverpage.md` at build time, so build the app from inside this repo. A small parser
  (`src/lib/nda/markdown.ts`) turns the markdown into plain data: clauses made of text, **bold**, links, and references
  to Cover Page terms.
- **One model, two renderers.** `buildCoverPage()` (`src/lib/nda/coverPage.ts`) turns the form into the Cover Page
  content. `NdaPreview` renders that content as HTML, and `NdaPdf` renders it as a PDF with `@react-pdf/renderer`.
- **Missing fields** appear as highlighted placeholders in the preview and as blank lines in the PDF, so a partly
  completed NDA can still be downloaded and finished by hand.
- **The PDF renderer is loaded on demand.** It only loads when someone clicks *Download PDF*, which keeps the initial
  page light. Its fonts are loaded from `/fonts`, so the app must be served from the root of the site.
- **Brand colours** are Tailwind theme tokens in `src/app/globals.css`: `primary` (blue), `secondary` (purple, for
  submit buttons), `accent` (yellow), `navy` (headings) and `muted` (gray, for hints and captions).
