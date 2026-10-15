# prelegalHG

A platform for drafting common legal agreements.

prelegalHG helps people prepare standard business agreements without starting from a blank page. Users enter the key details of a deal, review the completed agreement, and download it ready for signature. The agreement text comes from the Common Paper standard agreements, which are widely used, free to use, and written to be read by non-lawyers.

**Status:** Work in progress. The project is under active development and is expected to be completed by October 19, 2026.

## What it does today

### Sign-in

The app opens on a sign-in page. For now this is a prototype: any email and password let you in, nothing is checked, and the email is only remembered in your browser. The header shows who is signed in and has a Sign out button.

### Agreement creator

A web application for creating any of the 11 Common Paper agreements listed below.

- The user chats with an AI assistant. It asks what kind of agreement they need and picks the matching one. If they ask for an agreement it can't prepare, such as an employment contract or a lease, it says so and offers the closest one it can.
- It then asks about the agreement one or two questions at a time, starting with the two parties and their signers, and fills in the agreement from the answers. Until every field is filled in, it always ends with its next question. When a term has a usual default (for example "None" for an optional term), it suggests it and asks the user to confirm.
- The user can switch to a different agreement part-way through. The parties, effective date, governing law and courts carry over.
- The completed agreement is shown next to the chat and updates after each answer: a cover page with every term the Standard Terms leave to it, followed by the full Standard Terms. Fields that still need a value are highlighted, and a counter shows how many are left.
- The user can also edit the fields directly in the "Edit the fields yourself" panel below the chat. The assistant sees those edits.
- "Start over" begins a new conversation. The conversation is not saved: reloading the page starts again.
- The user can download the agreement as a PDF. It contains the completed cover page and the full Standard Terms. Fields left empty are printed as blank lines so they can be completed by hand.

The Mutual NDA uses Common Paper's own cover page. For the other agreements the app generates one, grouped into the Order Form, Key Terms, Business Terms or Statement of Work where the agreement has them.

The assistant uses OpenAI (`gpt-5.4-mini`) and needs `OPENAI_API_KEY` in `.env`. Without it, the rest of the app works and the chat says that the assistant isn't available.

### Agreement templates

The `templates/` folder contains 12 Common Paper standard agreements in Markdown, and `catalog.json` lists each one with a short description:

- AI Addendum
- Business Associate Agreement
- Cloud Service Agreement
- Data Processing Agreement
- Design Partner Agreement
- Mutual Non-Disclosure Agreement (Standard Terms and Cover Page)
- Partnership Agreement
- Pilot Agreement
- Professional Services Agreement
- Service Level Agreement
- Software License Agreement

The agreement creator reads the agreement text directly from these files, so the templates are the single source of truth. `documents.json` defines each agreement's parties and the fields of its cover page; the frontend and the backend both read it.

## Project structure

```
prelegalHG/
  frontend/      Next.js web application, built into static files
  backend/       FastAPI application that serves the API, the frontend and the database
  scripts/       Start and stop scripts for Mac, Linux and Windows
  templates/     Common Paper agreement templates in Markdown
  catalog.json   Name, description and file name of each template
  documents.json Parties and cover page fields of each agreement
  Dockerfile     Builds the whole application into one container image
  compose.yaml   Runs that image
```

The frontend is built into static files, which the backend serves together with its API under `/api`. The backend uses a SQLite database that is temporary: it starts empty every time the application starts.

## Running the application

Requirements: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (on Linux, Docker Engine with Docker Compose 2.24 or later).

1. Create a `.env` file in the project root containing your OpenAI API key: `OPENAI_API_KEY=<your key>`. The application starts without it, but the AI assistant needs it.
2. Start the application with the script for your system. It builds the container, starts it, and waits until it is ready:

   | System  | Start                          | Stop                          |
   | ------- | ------------------------------ | ----------------------------- |
   | Mac     | `scripts/start-mac.sh`         | `scripts/stop-mac.sh`         |
   | Linux   | `scripts/start-linux.sh`       | `scripts/stop-linux.sh`       |
   | Windows | `scripts\start-windows.ps1`    | `scripts\stop-windows.ps1`    |

3. Open http://localhost:8000.

If PowerShell refuses to run the Windows scripts, run them with `powershell -ExecutionPolicy Bypass -File scripts\start-windows.ps1`.

Stopping the application discards the database. The application is only reachable from your own computer.

## Development

The backend reads `.env` from the repository root when it runs outside Docker, so the AI assistant works there too. This needs [uv](https://docs.astral.sh/uv/).

To work on the frontend with changes shown as you save, start the backend and the frontend development server in two terminals:

```bash
cd backend
uv run uvicorn app.main:create_app --factory --reload   # the API, at http://localhost:8000
```

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:3000. The development server forwards `/api` requests to the backend at http://localhost:8000. The prototype sign-in works without the backend; the AI assistant needs it.

To run the complete application without Docker, build the frontend and start the backend, which serves the build:

```bash
cd frontend
npm run build
cd ../backend
uv run uvicorn app.main:create_app --factory --reload
```

Then open http://localhost:8000.

The frontend reads `templates/`, `documents.json` and `catalog.json` when it is built, so build it from inside the full repository. `npm run dev` and `npm run build` first parse the templates into `frontend/public/documents/`.

### Tests

| Folder     | Command                  | Description                                            |
| ---------- | ------------------------ | ------------------------------------------------------ |
| `frontend` | `npm test`               | Unit and component tests                               |
| `frontend` | `npm run lint`           | Check the code with ESLint                             |
| `frontend` | `npm run build`          | Build the static files into `frontend/out`             |
| `backend`  | `uv run pytest`          | Unit and integration tests                             |
| `backend`  | `uv run pytest -m smoke` | Check the running container after starting it          |
| `backend`  | `uv run pytest -m live`  | Check the AI assistant against OpenAI (uses your key)  |

The backend tests also check the real frontend build when `frontend/out` exists.

## Technology

- Next.js, React and TypeScript, exported as static files
- Tailwind CSS for styling
- React PDF for generating the downloadable PDF
- FastAPI and Python, managed with uv
- SQLite for the database
- Docker for packaging and running the application
- OpenAI (`gpt-5.4-mini`, Structured Outputs) for the AI assistant
- Vitest, Testing Library and pytest for tests

## Licenses

- The project code is licensed under the MIT License. See `LICENSE`.
- The agreement templates are from Common Paper and are licensed under CC BY 4.0. See `templates/LICENSE.txt`.
- The Source Serif 4 font used in the PDF is licensed under the SIL Open Font License. See `frontend/public/fonts/OFL.txt`.

## Disclaimer

prelegalHG is not a law firm and does not provide legal advice. Review every agreement carefully, and consult a qualified lawyer before signing it.
