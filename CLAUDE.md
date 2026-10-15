# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory. The user can use AI chat in order to establish what document they want and how to fill in the fields. The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

All the documents in the catalog are supported, through an AI chat. See "Current status" at the end.

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instruction from Jira
2. Develop the feature - do not skip any step from the feature-dev 7 step process
3. Thoroughly test the feature with unit tests and integration tests and fix any issues
4. Submit a PR using your github tools

## AI design

When writing code to make call to LLMs, use OpenAI with the gpt-5.4-mini model. You should use Structured Outputs so that you can interpret the results and populate fields in the legal document.

There is an OPENAI_API_KEY in the .env file in the project root.

## Technical design

The entire project should be packaged into a Docker container.
The backend should be in backend/ and be a uv project, using FastAPI.
The frontend should be in frontend/
The database should use SQLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.
The frontend is built as a static Next.js export and served by FastAPI.
There should be scripts in scripts/ for:
```bash
# Mac 
scripts/start-mac.sh   # Start
scripts/stop-mac.sh   # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```

## Color Scheme

- Accent Yellow: ```#ecad0a```
- Blue Primary: ```#209dd7```
- Purple Secondary: ```#753991``` (submit buttons)
- Dark Navy: ```#032147``` (headings)
- Gray Text: ```#888888```

## Current status

Done (PL-2 to PL-7):
- `templates/` holds the 12 Common Paper templates listed in `catalog.json`. `documents.json` defines the 11 agreements (the Mutual NDA cover page template belongs to the Mutual NDA): each one's template, party roles, cover page sections and fields (text, long text, date, choice or years, with an optional suggested default and `showIf` condition). The frontend and the backend both read it; tests check that every term a template leaves to the cover page has a field.
- Agreement creator in `frontend/` (Next.js, Tailwind): an AI chat (`DocumentChat`, `lib/useDocumentChat.ts`, `lib/chat.ts`) picks the agreement and fills it in, with a collapsible "Edit the fields yourself" panel generated from the fields (`DocumentForm`), a live preview of the cover page and Standard Terms (`DocumentPreview`) and a PDF download (`DocumentPdf`). The Mutual NDA's cover page is worded like its template (`lib/documents/mndaCoverPage.ts`); the others are generated from their fields. `scripts/build-documents.mts` (run before `dev` and `build`) parses the templates into `public/documents/<id>.json`, which the page fetches once an agreement is chosen. After each reply the cursor returns to the message box.
- AI chat: `POST /api/chat` (`backend/app/chat.py`, `backend/app/documents.py`) is stateless. The browser sends the conversation, the chosen agreement (or null), its values, the two parties and today's date. OpenAI `gpt-5.4-mini` answers with Structured Outputs: the agreement, only the fields it changes (validated and merged by the server), a reply and a separate next question; if the model leaves the question empty while fields are missing, the server asks about the first one. For an unsupported agreement the assistant offers the closest supported one. Switching agreements keeps the parties, effective date, governing law and courts. Without `OPENAI_API_KEY` it answers 503. Outside Docker the backend reads `.env` from the repo root. `npm run dev` forwards `/api` to the backend on :8000.
- Accounts (`backend/app/auth.py`): `POST /api/auth/signup` (name, email, password of 8 or more characters, and accepting that documents are drafts), `/api/auth/signin`, `/api/auth/signout` and `GET /api/auth/me`. Passwords are hashed with scrypt. A sign-in is a random token in an HttpOnly, SameSite=Lax cookie (not Secure: plain HTTP on localhost); the `sessions` table stores only its SHA-256. It lasts until the browser closes, or `PRELEGAL_SESSION_DAYS` days if that is set. Routes that need a user depend on `SignedIn` and answer 401 otherwise; `/api/chat` is one of them. The frontend asks `/api/auth/me` on load (`frontend/src/lib/session.ts`), signs out on any 401 (`lib/api.ts`), and has `/login/` and `/signup/` pages.
- Saved agreements (`backend/app/saved.py`): `GET /api/documents` (summaries: agreement name, companies, fields missing, last change), `GET`, `PUT` and `DELETE /api/documents/<id>`, all scoped to the signed-in user (another user's id answers 404). The browser makes the 32-hex id, so saving is an idempotent PUT of the agreement plus the conversation and a revision number; a save older than the stored revision is ignored. `frontend/src/lib/useAutosave.ts` saves a moment after each change once an agreement is chosen (not while a reply is pending or after one failed), and before leaving the page, starting over or signing out. "My documents" (`/documents/`, `DocumentList`) lists, opens (`/?doc=<id>`, `CreateAgreement`) and deletes them. A reopened agreement brings back its conversation and is headed "Edit the <agreement>" (following the agreement if the chat switches it); a new one is headed "Create a Legal Agreement" (`PageHeading`).
- A disclaimer (`frontend/src/lib/disclaimer.ts`) says the documents are drafts subject to legal review: in the footer of every screen, above the preview, on every PDF page and as a required checkbox on sign-up. The header has New agreement / My documents navigation (short labels on phones), the user's name and Sign out, which first saves pending changes. Forms show inline errors (`TextField` `error`, `PasswordField` with show/hide, `CheckboxField`) and focus the first field to fix; `Button` has a `loading` state.
- `backend/` (FastAPI, uv) serves the static frontend export and `/api`. Shared request and response shapes are in `backend/app/wire.py`; `app/db.py` has the schema (`users`, `sessions`, `documents`) and the per-request `Connection` dependency. On every start it recreates the SQLite database empty, so accounts, sign-ins and saved agreements last until the next restart.
- One Docker image (`Dockerfile`, `compose.yaml`) runs the app at http://localhost:8000 using the start and stop scripts in `scripts/`. `.env` is passed to the container. The image includes `documents.json` and `catalog.json` for the backend (`PRELEGAL_DOCUMENTS_DIR`).
- `.env` is not in the repo, and there is no `.env.example`: users create `.env` in the project root with `OPENAI_API_KEY=<key>` (the README and the start scripts say so), and optionally `PRELEGAL_SESSION_DAYS`. `.gitignore` ignores every `.env*` file.
- Tests: `npm test` in `frontend/` (Vitest) and `uv run pytest` in `backend/`. Both run the shared cases in `testdata/field-values.json`, so the frontend and the backend agree on which values count as filled in. `uv run pytest -m live` checks the chat against the real OpenAI API; `-m smoke` checks the running container, including signing up and saving an agreement.

Not done yet: nothing is planned beyond PL-7. Known limits, fine for a database that is wiped on every restart: no rate limiting on sign-in, and expired sign-ins are never cleaned up. The save sent as a tab closes is a keepalive request, which browsers cap at 64 KB, so a very long conversation can miss its last change if the tab is closed within a moment of it.
