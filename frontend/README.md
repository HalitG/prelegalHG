# prelegal frontend

The prelegal web app, built with Next.js. It has a prototype sign-in page and the **agreement creator**: the user chats
with an AI assistant that picks one of the 11 Common Paper agreements and fills in its key terms, sees the completed
agreement update live, and downloads it as a PDF ready for signature.

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

`dev` and `build` first run `scripts/build-documents.mts`, which parses the templates into `public/documents/`.

The AI assistant calls the backend's `/api/chat`. The development server forwards `/api` to the backend at
http://localhost:8000 (see `next.config.ts`), so start the backend too to use it (see the main README). To see the
build served the way it is in production, run the backend on its own.

## How it works

- **Static export.** `next.config.ts` sets `output: "export"`, so everything is rendered when the app is built.
  `trailingSlash` makes each route a folder with an `index.html` (`out/login/index.html`), which is what the backend
  serves. Features that need a running Next.js server (Cache Components, server actions, rewrites, cookies) are not
  available in the build. Only the development server has a rewrite, which forwards `/api` to the backend.
- **Prototype sign-in.** `/login/` accepts any email and password. `src/lib/session.ts` keeps the email in
  `localStorage` and is the only code that knows how the session works, so real sign-in can replace it. Pages in the
  `src/app/(platform)/` route group are wrapped in `AuthGuard`, which sends signed-out visitors to `/login/`. Until
  the browser has read the session, the guard shows a placeholder, so signed-out visitors never see the platform.
  This is not access control: the static HTML still carries the page's data, so anything private must come from
  the backend once real sign-in exists.
- **The agreements are defined once.** `../documents.json` lists each agreement's parties and cover page fields, and
  `../catalog.json` its name and description. `src/lib/documents/registry.ts` reads them at build time; the backend
  reads the same files. Every value is a string, and `""` means not given yet.
- **Templates are the source of truth.** Before `dev` and `build`, `scripts/build-documents.mts` parses each
  agreement's Standard Terms in `../templates/` (`src/lib/documents/parse.ts`) into `public/documents/<id>.json`:
  clauses nested by indentation, made of text, **bold**, links, and references to cover page terms. The page fetches
  an agreement's file once the chat has chosen it, rather than carrying all of them (about 250 KB). The script runs on
  plain Node, which strips the TypeScript types, so the files it imports name their `.ts` extension.
- **AI chat.** `src/lib/useDocumentChat.ts` holds the conversation, and `src/lib/chat.ts` sends it to the backend's
  `/api/chat` with the chosen agreement (if any), its values, the parties and today's date. Each reply comes with the
  agreement as the assistant left it, which replaces the state in `DocumentCreator`, and with the assistant's next
  question, shown after the reply. The greeting is part of the page, so nothing is sent until the user writes.
  Nothing is stored: a page load starts a new conversation. When a reply arrives, the cursor goes back to the
  message box.
- **Chat and form share one state.** The "Edit the fields yourself" panel (`DocumentForm`) is generated from the chosen
  agreement's fields. Edits there go into the next chat request, so the assistant sees them. The panel is locked while
  a reply is on its way, because the reply replaces the agreement.
- **One model, two renderers.** `buildCoverPage()` (`src/lib/documents/coverPage.ts`) turns the values into the cover
  page content: the Mutual NDA's is worded like its template (`mndaCoverPage.ts`), and the others list each field,
  grouped by section. `DocumentPreview` renders that content and the Standard Terms as HTML, and `DocumentPdf` renders
  them as a PDF with `@react-pdf/renderer`.
- **Missing fields** appear as highlighted placeholders in the preview (showing the suggested default or an example)
  and as blank lines in the PDF, so a partly completed agreement can still be downloaded and finished by hand.
- **The PDF renderer is loaded on demand.** It only loads when someone clicks *Download PDF*, which keeps the initial
  page light. Its fonts are loaded from `/fonts`, so the app must be served from the root of the site.
- **Brand colours** are Tailwind theme tokens in `src/app/globals.css`: `primary` (blue), `secondary` (purple, for
  submit buttons), `accent` (yellow), `navy` (headings) and `muted` (gray, for hints and captions).
