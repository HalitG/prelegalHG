"use client";

import { useMemo, useState } from "react";
import { buildCoverPage } from "@/lib/documents/coverPage";
import { missingKeys, pdfFileName } from "@/lib/documents/fields";
import { emptyState, type DocState, type DocumentDef } from "@/lib/documents/types";
import { useDocumentText } from "@/lib/documents/useDocumentText";
import { useDocumentChat } from "@/lib/useDocumentChat";
import { useToday } from "@/lib/useToday";
import { DocumentChat } from "./DocumentChat";
import { DocumentForm } from "./DocumentForm";
import { DocumentPreview, EmptyPreview } from "./DocumentPreview";
import { DownloadButton } from "./DownloadButton";

function CompletionStatus({ missing }: { missing: number }) {
  return missing === 0 ? (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
      <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
      Ready to sign
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
      <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
      {missing} {missing === 1 ? "field" : "fields"} left
    </span>
  );
}

export function DocumentCreator({ documents }: { documents: DocumentDef[] }) {
  const [state, setState] = useState<DocState>(emptyState);
  const today = useToday();
  const chat = useDocumentChat(state, setState, today);
  const document = documents.find((candidate) => candidate.id === state.document) ?? null;
  const text = useDocumentText(document?.id ?? null);
  const coverPage = useMemo(() => document && buildCoverPage(document, state), [document, state]);
  const missing = document ? missingKeys(document, state).length : null;
  const download = document && coverPage && (
    <DownloadButton
      document={document}
      text={text?.text ?? null}
      coverPage={coverPage}
      fileName={pdfFileName(document, state.parties)}
    />
  );

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
      <div className="space-y-4">
        <DocumentChat {...chat} />

        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-navy shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
            Edit the fields yourself
            <span aria-hidden="true" className="text-muted transition group-open:rotate-180">
              ▾
            </span>
          </summary>
          {document ? (
            // A reply replaces the agreement, so edits made while it is on its way would be lost.
            <fieldset disabled={chat.status === "sending"} className="mt-4 disabled:opacity-60">
              <DocumentForm document={document} state={state} onChange={setState} />
            </fieldset>
          ) : (
            <p className="mt-4 rounded-2xl bg-white px-5 py-4 text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
              Once you and the assistant have chosen an agreement, you can edit its fields here.
            </p>
          )}
        </details>
      </div>

      <section
        aria-label="Document preview"
        className="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 shadow-slate-900/5 ring-slate-200 lg:sticky lg:top-6"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold">Preview</h2>
            <span aria-live="polite">{missing !== null && <CompletionStatus missing={missing} />}</span>
          </div>
          <div className="hidden lg:block">{download}</div>
        </div>
        <div className="px-6 py-8 sm:px-12 sm:py-12 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto">
          {document && coverPage && text ? (
            <DocumentPreview document={document} coverPage={coverPage} text={text} />
          ) : (
            <EmptyPreview documents={documents} />
          )}
        </div>
      </section>

      {/* On small screens the preview sits below the chat, so keep the download action in reach. */}
      {document && (
        <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
          {missing !== null && <CompletionStatus missing={missing} />}
          {download}
        </div>
      )}
    </div>
  );
}
