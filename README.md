# prelegalHG

A platform for drafting common legal agreements.

prelegalHG helps people prepare standard business agreements without starting from a blank page. Users enter the key details of a deal, review the completed agreement, and download it ready for signature. The agreement text comes from the Common Paper standard agreements, which are widely used, free to use, and written to be read by non-lawyers.

**Status:** Work in progress. The project is under active development and is expected to be completed by October 19, 2026.

## What it does today

### Sign-in

The app opens on a sign-in page. For now this is a prototype: any email and password let you in, nothing is checked, and the email is only remembered in your browser. The header shows who is signed in and has a Sign out button.

### Mutual NDA creator

A web application for creating a Mutual Non-Disclosure Agreement (MNDA).

- The user fills in a form with the key terms: the two parties and their signers, the purpose of sharing information, the effective date, how long the agreement lasts, how long information stays confidential, the governing law and jurisdiction, and any modifications.
- The completed agreement is shown next to the form and updates as the user types. Fields that still need a value are highlighted.
- The user can download the agreement as a PDF. It contains the completed Cover Page and the full Standard Terms. Fields left empty are printed as blank lines so they can be completed by hand.

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

The Mutual NDA creator reads its agreement text directly from these files, so the templates are the single source of truth.

## Project structure

```
prelegalHG/
  frontend/      Next.js web application, built into static files
  backend/       FastAPI application that serves the API, the frontend and the database
  scripts/       Start and stop scripts for Mac, Linux and Windows
  templates/     Common Paper agreement templates in Markdown
  catalog.json   Name, description and file name of each template
  Dockerfile     Builds the whole application into one container image
  compose.yaml   Runs that image
```

The frontend is built into static files, which the backend serves together with its API under `/api`. The backend uses a SQLite database that is temporary: it starts empty every time the application starts.

## Running the application

Requirements: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (on Linux, Docker Engine with Docker Compose 2.24 or later).

1. Copy `.env.example` to `.env` and add your OpenAI API key. The application starts without it, but upcoming AI features need it.
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

To work on the frontend on its own, with changes shown as you save:

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:3000. The prototype sign-in works without the backend.

To run the complete application without Docker, build the frontend and start the backend, which serves the build. This needs [uv](https://docs.astral.sh/uv/):

```bash
cd frontend
npm run build
cd ../backend
uv run uvicorn app.main:create_app --factory --reload
```

Then open http://localhost:8000.

The frontend reads files from `templates/` when it is built, so build it from inside the full repository.

### Tests

| Folder     | Command                  | Description                                            |
| ---------- | ------------------------ | ------------------------------------------------------ |
| `frontend` | `npm test`               | Unit and component tests                               |
| `frontend` | `npm run lint`           | Check the code with ESLint                             |
| `frontend` | `npm run build`          | Build the static files into `frontend/out`             |
| `backend`  | `uv run pytest`          | Unit and integration tests                             |
| `backend`  | `uv run pytest -m smoke` | Check the running container after starting it          |

The backend tests also check the real frontend build when `frontend/out` exists.

## Technology

- Next.js, React and TypeScript, exported as static files
- Tailwind CSS for styling
- React PDF for generating the downloadable PDF
- FastAPI and Python, managed with uv
- SQLite for the database
- Docker for packaging and running the application
- Vitest, Testing Library and pytest for tests

## Licenses

- The project code is licensed under the MIT License. See `LICENSE`.
- The agreement templates are from Common Paper and are licensed under CC BY 4.0. See `templates/LICENSE.txt`.
- The Source Serif 4 font used in the PDF is licensed under the SIL Open Font License. See `frontend/public/fonts/OFL.txt`.

## Disclaimer

prelegalHG is not a law firm and does not provide legal advice. Review every agreement carefully, and consult a qualified lawyer before signing it.
