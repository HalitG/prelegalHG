import { memo } from "react";
import type { CoverPageModel, Piece } from "@/lib/documents/coverPage";
import type { Block, Clause, Inline } from "@/lib/documents/parse";
import type { DocumentDef, DocumentText } from "@/lib/documents/types";
import type { DocumentTextState } from "@/lib/documents/useDocumentText";
import { Button } from "./Button";

function Inlines({ runs }: { runs: Inline[] }) {
  return runs.map((run, i) => {
    switch (run.type) {
      case "text":
        return run.text;
      case "bold":
        return (
          <strong key={i}>
            <Inlines runs={run.children} />
          </strong>
        );
      case "term":
        return (
          <span key={i} className="underline decoration-primary/60 decoration-dotted underline-offset-2">
            {run.text}
          </span>
        );
      case "link":
        return (
          <a
            key={i}
            href={run.href}
            target="_blank"
            rel="noreferrer"
            className="text-navy underline decoration-primary/60 underline-offset-2 hover:decoration-primary"
          >
            {run.text}
          </a>
        );
    }
  });
}

/** Template text as-is; user values highlighted; missing values as a placeholder chip. */
function PieceView({ piece }: { piece: Piece }) {
  if (typeof piece === "string") return piece;
  return piece.value ? (
    <mark className="rounded-sm bg-primary/10 px-0.5 whitespace-pre-line text-inherit">{piece.value}</mark>
  ) : (
    <span className="rounded-sm border border-dashed border-accent bg-accent/10 px-1 font-sans text-[0.8em] text-amber-700">
      {piece.placeholder}
    </span>
  );
}

function ClauseView({ clause, depth }: { clause: Clause; depth: number }) {
  const children = clause.children.map((child, i) => <ClauseView key={i} clause={child} depth={depth + 1} />);
  // A top-level clause with a title and no text of its own is a section heading.
  if (depth === 0 && clause.title && clause.content.length === 0) {
    return (
      <section className="space-y-2 pt-3">
        <h4 className="font-semibold">
          {clause.label} {clause.title}
        </h4>
        {children}
      </section>
    );
  }
  return (
    <div className="flex gap-2">
      <span className="shrink-0 tabular-nums">{clause.label}</span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-justify">
          {clause.title && <strong>{clause.title} </strong>}
          <Inlines runs={clause.content} />
        </p>
        {children}
      </div>
    </div>
  );
}

/** The Standard Terms. Memoised: they are long, and don't change as the user fills in the cover page. */
const StandardTerms = memo(function StandardTerms({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return (
              <h3 key={i} className="text-center text-lg font-semibold">
                {block.text}
              </h3>
            );
          case "clause":
            return <ClauseView key={i} clause={block} depth={0} />;
          case "paragraph":
            return (
              <p key={i} className="pt-4 text-center font-sans text-[11px] text-muted">
                <Inlines runs={block.content} />
              </p>
            );
        }
      })}
    </div>
  );
});

function CoverPage({ coverPage, intro }: { coverPage: CoverPageModel; intro: DocumentText["intro"] }) {
  return (
    <>
      {intro && (
        <p className="text-slate-600">
          <Inlines runs={intro} />
        </p>
      )}

      {coverPage.groups.map((group, i) => (
        <div key={group.title ?? i} className="mt-6">
          {group.title && (
            <h3 className="mb-1 font-sans text-[11px] font-semibold tracking-[0.2em] text-muted uppercase">
              {group.title}
            </h3>
          )}
          <div className="divide-y divide-slate-100 border-y border-slate-200">
            {group.sections.map((section) => (
              <section key={section.title} className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
                <div>
                  <h4 className="font-semibold">{section.title}</h4>
                  {section.caption && <p className="font-sans text-[11px] text-muted">{section.caption}</p>}
                </div>
                <div className="space-y-1">
                  {section.paragraphs.map((paragraph, j) => (
                    <p key={j}>
                      {paragraph.map((piece, k) => (
                        <PieceView key={k} piece={piece} />
                      ))}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      ))}

      <p className="mt-6">{coverPage.signingStatement}</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-left">
          <thead>
            <tr className="font-sans text-[11px] tracking-wider text-muted uppercase">
              <th className="w-[28%] border-b border-slate-300 py-2" />
              {coverPage.roles.map((role) => (
                <th key={role} className="border-b border-slate-300 px-3 py-2 font-semibold">
                  {role}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {coverPage.signatureRows.map((row) => (
              <tr key={row.label} className="align-top">
                <th scope="row" className="border-b border-slate-200 py-2.5 pr-3 font-semibold text-slate-900">
                  {row.label}
                  {row.caption && (
                    <span className="block font-sans text-[11px] font-normal text-muted">{row.caption}</span>
                  )}
                </th>
                {row.cells.map((cell, i) => (
                  <td
                    key={i}
                    className={`${row.tall ? "h-16" : "h-11"} border-b border-slate-200 px-3 py-2.5 break-words`}
                  >
                    <PieceView piece={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TextStatus({ text }: { text: DocumentTextState }) {
  if (text.status === "error") {
    return (
      <div role="alert" className="flex items-center justify-center gap-3 font-sans text-sm text-red-700">
        Couldn&rsquo;t load the Standard Terms.
        <Button variant="outline" onClick={text.retry} className="px-3 py-1 text-xs">
          Retry
        </Button>
      </div>
    );
  }
  return (
    <div role="status" className="animate-pulse space-y-3 motion-reduce:animate-none">
      <span className="sr-only">Loading the Standard Terms</span>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} aria-hidden="true" className="h-3 rounded bg-slate-100" style={{ width: `${95 - i * 10}%` }} />
      ))}
    </div>
  );
}

interface DocumentPreviewProps {
  document: DocumentDef;
  coverPage: CoverPageModel;
  text: DocumentTextState;
}

export function DocumentPreview({ document, coverPage, text }: DocumentPreviewProps) {
  return (
    <article className="font-serif text-[13.5px] leading-relaxed text-slate-800" aria-label={`${document.name} preview`}>
      <header className="mb-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">{document.name}</h2>
        <p className="mt-1 font-sans text-[11px] font-semibold tracking-[0.2em] text-muted uppercase">Cover Page</p>
      </header>

      <CoverPage coverPage={coverPage} intro={text.text?.intro ?? null} />

      <div className="my-10 flex items-center gap-3 font-sans text-[11px] tracking-[0.2em] text-muted uppercase">
        <span className="h-px flex-1 bg-slate-200" />
        Standard Terms
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      {text.status === "ready" ? <StandardTerms blocks={text.text.terms} /> : <TextStatus text={text} />}
    </article>
  );
}

/** Shown until the assistant and the user have chosen an agreement. */
export function EmptyPreview({ documents }: { documents: DocumentDef[] }) {
  return (
    <div className="mx-auto max-w-md py-10 text-center font-sans">
      <h2 className="text-lg font-semibold">Your agreement will appear here</h2>
      <p className="mt-2 text-sm text-slate-600">
        Tell the assistant what you need, and it will pick the right agreement and fill it in as you chat. It can
        prepare:
      </p>
      <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Agreements the assistant can prepare">
        {documents.map((document) => (
          <li key={document.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
            {document.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
