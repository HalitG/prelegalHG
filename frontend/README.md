# prelegal frontend

The prelegal web app, built with Next.js. Users sign up or sign in, then use the **agreement creator**: they chat with
an AI assistant that picks one of the 11 Common Paper agreements and fills in its key terms, see the completed agreement
update live, and download it as a PDF ready for signature. Their agreements are saved as they work and listed in
**My documents**, where they can reopen or delete them.

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

Signing in, saving and the AI assistant all call the backend under `/api`. The development server forwards `/api` to
the backend at http://localhost:8000 (see `next.config.ts`), so start the backend too (see the main README). To see the
build served the way it is in production, run the backend on its own.

## How it works

- **Static export.** `next.config.ts` sets `output: "export"`, so everything is rendered when the app is built.
  `trailingSlash` makes each route a folder with an `index.html` (`out/login/index.html`), which is what the backend
  serves. Features that need a running Next.js server (Cache Components, server actions, rewrites, cookies) are not
  available in the build. Only the development server has a rewrite, which forwards `/api` to the backend.
- **Accounts.** `/signup/` and `/login/` post to the backend's `/api/auth/*`, which keeps the sign-in in an HttpOnly
  cookie. The page can't read that cookie, so `src/lib/session.ts` asks `GET /api/auth/me` once the page is running;
  until then the state is "loading", which is also what the static HTML is rendered with. Pages in the
  `src/app/(platform)/` route group are wrapped in `AuthGuard`, which shows a placeholder until the session is known
  and sends signed-out visitors to `/login/`. That only decides what is shown: the protection is the backend, which
  answers 401 without a sign-in. `src/lib/api.ts` wraps `fetch` for those routes and signs the page out on a 401 (for
  example after the server restarts, which empties its database).
- **Saving.** `src/lib/useAutosave.ts` saves the agreement and the conversation through `src/lib/savedDocuments.ts`
  a moment after they change, once an agreement is chosen, but not while a chat reply is on its way or after one
  failed. The page makes each agreement's id, so every save is the same `PUT /api/documents/<id>`, and each carries
  the next revision so the server ignores one that arrives late. Leaving the page, starting over or signing out first
  saves what is waiting. `/documents/` lists the agreements (`DocumentList`), and opening one goes to `/?doc=<id>`
  (`CreateAgreement`), since the static export can't have a page per agreement.
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
  When a reply arrives, the cursor goes back to the message box.
- **Chat and form share one state.** The "Edit the fields yourself" panel (`DocumentForm`) is generated from the chosen
  agreement's fields. Edits there go into the next chat request, so the assistant sees them. The panel is locked while
  a reply is on its way, because the reply replaces the agreement.
- **One model, two renderers.** `buildCoverPage()` (`src/lib/documents/coverPage.ts`) turns the values into the cover
  page content: the Mutual NDA's is worded like its template (`mndaCoverPage.ts`), and the others list each field,
  grouped by section. `DocumentPreview` renders that content and the Standard Terms as HTML, and `DocumentPdf` renders
  them as a PDF with `@react-pdf/renderer`.
- **Missing fields** appear as highlighted placeholders in the preview (showing the suggested default or an example)
  and as blank lines in the PDF, so a partly completed agreement can still be downloaded and finished by hand.
- **The disclaimer** that the documents are drafts is written once, in `src/lib/disclaimer.ts`, and shown in the
  footer of every screen (`AppFooter`), above the preview, on every page of the PDF and on the sign-up form.
- **The PDF renderer is loaded on demand.** It only loads when someone clicks *Download PDF*, which keeps the initial
  page light. Its fonts are loaded from `/fonts`, so the app must be served from the root of the site.
- **Brand colours** are Tailwind theme tokens in `src/app/globals.css`: `primary` (blue), `secondary` (purple, for
  submit buttons), `accent` (yellow), `navy` (headings) and `muted` (gray, for hints and captions).
