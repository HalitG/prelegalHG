import { SIGNING_STATEMENT, type CoverPageModel, type Piece } from "@/lib/nda/coverPage";
import type { Run } from "@/lib/nda/markdown";
import type { MndaTemplate } from "@/lib/nda/template";

function Runs({ runs }: { runs: Run[] }) {
  return runs.map((run, i) => {
    switch (run.type) {
      case "text":
        return run.text;
      case "bold":
        return <strong key={i}>{run.text}</strong>;
      case "term":
        return (
          <span key={i} className="underline decoration-indigo-300 decoration-dotted underline-offset-2">
            {run.text}
          </span>
        );
      case "link":
        return (
          <a key={i} href={run.href} target="_blank" rel="noreferrer" className="text-indigo-700 hover:underline">
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
    <mark className="rounded-sm bg-indigo-50 px-0.5 whitespace-pre-line text-inherit">{piece.value}</mark>
  ) : (
    <span className="rounded-sm border border-dashed border-amber-300 bg-amber-50 px-1 font-sans text-[0.8em] text-amber-700">
      {piece.placeholder}
    </span>
  );
}

export function NdaPreview({ template, coverPage }: { template: MndaTemplate; coverPage: CoverPageModel }) {
  return (
    <article className="font-serif text-[13.5px] leading-relaxed text-slate-800" aria-label="Mutual NDA preview">
      <header className="mb-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Mutual Non-Disclosure Agreement</h2>
        <p className="mt-1 font-sans text-[11px] font-semibold tracking-[0.2em] text-slate-400 uppercase">Cover Page</p>
      </header>

      <p className="text-slate-600">
        <Runs runs={template.coverPageIntro} />
      </p>

      <div className="mt-6 divide-y divide-slate-100 border-y border-slate-200">
        {coverPage.sections.map((section) => (
          <section key={section.title} className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
            <div>
              <h3 className="font-semibold text-slate-900">{section.title}</h3>
              {section.caption && <p className="font-sans text-[11px] text-slate-400">{section.caption}</p>}
            </div>
            <div className="space-y-1">
              {section.paragraphs.map((paragraph, i) => (
                <p key={i}>
                  {paragraph.map((piece, j) => (
                    <PieceView key={j} piece={piece} />
                  ))}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-6">{SIGNING_STATEMENT}</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[28rem] border-collapse text-left">
          <thead>
            <tr className="font-sans text-[11px] tracking-wider text-slate-500 uppercase">
              <th className="w-[28%] border-b border-slate-300 py-2" />
              <th className="border-b border-slate-300 px-3 py-2 font-semibold">Party 1</th>
              <th className="border-b border-slate-300 px-3 py-2 font-semibold">Party 2</th>
            </tr>
          </thead>
          <tbody>
            {coverPage.signatureRows.map((row) => (
              <tr key={row.label} className="align-top">
                <th scope="row" className="border-b border-slate-200 py-2.5 pr-3 font-semibold text-slate-900">
                  {row.label}
                  {row.caption && (
                    <span className="block font-sans text-[11px] font-normal text-slate-400">{row.caption}</span>
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

      <div className="my-10 flex items-center gap-3 font-sans text-[11px] tracking-[0.2em] text-slate-400 uppercase">
        <span className="h-px flex-1 bg-slate-200" />
        Standard Terms
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="space-y-3">
        {template.standardTerms.map((block, i) => {
          switch (block.type) {
            case "heading":
              return (
                <h3 key={i} className="text-center text-lg font-semibold text-slate-900">
                  {block.text}
                </h3>
              );
            case "clause":
              return (
                <p key={i} className="text-justify">
                  {block.number}. <Runs runs={block.runs} />
                </p>
              );
            case "paragraph":
              return (
                <p key={i} className="pt-4 text-center font-sans text-[11px] text-slate-400">
                  <Runs runs={block.runs} />
                </p>
              );
          }
        })}
      </div>
    </article>
  );
}
