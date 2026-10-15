# prelegal frontend

The prelegal web app, built with Next.js. It has a prototype sign-in page and the **Mutual Non-Disclosure Agreement**
creator: the user chats with an AI assistant that fills in the key terms, sees the completed agreement update live,
and downloads it as a PDF ready for signature.

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
- **Templates are the source of truth.** `src/lib/nda/template.ts` reads `../templates/Mutual-NDA.md` and
  `../templates/Mutual-NDA-coverpage.md` at build time, so build the app from inside this repo. A small parser
  (`src/lib/nda/markdown.ts`) turns the markdown into plain data: clauses made of text, **bold**, links, and references
  to Cover Page terms.
- **AI chat.** `src/lib/useNdaChat.ts` holds the conversation, and `src/lib/chat.ts` sends it to the backend's
  `/api/chat` with the current fields and today's date. Each reply comes with the complete updated fields, which
  replace the form state in `NdaCreator`. The backend asks OpenAI and checks its answer. The greeting is part of the
  page, so nothing is sent until the user writes. Nothing is stored: a page load starts a new conversation.
- **Chat and form share one state.** The "Edit the fields yourself" panel is the original form (`NdaForm`). Edits there
  go into the next chat request, so the assistant sees them. The panel is locked while a reply is on its way, because
  the reply replaces every field.
- **One model, two renderers.** `buildCoverPage()` (`src/lib/nda/coverPage.ts`) turns the fields into the Cover Page
  content. `NdaPreview` renders that content as HTML, and `NdaPdf` renders it as a PDF with `@react-pdf/renderer`.
- **Missing fields** appear as highlighted placeholders in the preview and as blank lines in the PDF, so a partly
  completed NDA can still be downloaded and finished by hand.
- **The PDF renderer is loaded on demand.** It only loads when someone clicks *Download PDF*, which keeps the initial
  page light. Its fonts are loaded from `/fonts`, so the app must be served from the root of the site.
- **Brand colours** are Tailwind theme tokens in `src/app/globals.css`: `primary` (blue), `secondary` (purple, for
  submit buttons), `accent` (yellow), `navy` (headings) and `muted` (gray, for hints and captions).
