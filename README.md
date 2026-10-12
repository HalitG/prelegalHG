# prelegalHG

A platform for drafting common legal agreements.

prelegalHG helps people prepare standard business agreements without starting from a blank page. Users enter the key details of a deal, review the completed agreement, and download it ready for signature. The agreement text comes from the Common Paper standard agreements, which are widely used, free to use, and written to be read by non-lawyers.

**Status:** Work in progress. The project is under active development and is expected to be completed by October 19, 2026.

## What it does today

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
  frontend/      Next.js web application (the Mutual NDA creator)
  templates/     Common Paper agreement templates in Markdown
  catalog.json   Name, description and file name of each template
```

## Running the application

Requirements: Node.js 20 or later.

```bash
cd frontend
npm install
npm run dev
```

Then open http://localhost:3000.

Other commands, run from the `frontend` folder:

| Command         | Description                         |
| --------------- | ----------------------------------- |
| `npm test`      | Run the unit tests                  |
| `npm run lint`  | Check the code with ESLint          |
| `npm run build` | Create a production build           |
| `npm start`     | Serve the production build          |

The application reads files from `templates/` when it is built, so build it from inside the full repository.

## Technology

- Next.js, React and TypeScript
- Tailwind CSS for styling
- React PDF for generating the downloadable PDF
- Vitest for unit tests

## Licenses

- The project code is licensed under the MIT License. See `LICENSE`.
- The agreement templates are from Common Paper and are licensed under CC BY 4.0. See `templates/LICENSE.txt`.
- The Source Serif 4 font used in the PDF is licensed under the SIL Open Font License. See `frontend/public/fonts/OFL.txt`.

## Disclaimer

prelegalHG is not a law firm and does not provide legal advice. Review every agreement carefully, and consult a qualified lawyer before signing it.
