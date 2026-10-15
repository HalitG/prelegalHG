"use client";

import { useMemo, useState } from "react";
import { DISCLAIMER } from "@/lib/disclaimer";
import { buildCoverPage } from "@/lib/documents/coverPage";
import { missingKeys, pdfFileName } from "@/lib/documents/fields";
import { emptyState, type DocState, type DocumentDef } from "@/lib/documents/types";
import { useDocumentText } from "@/lib/documents/useDocumentText";
import { newDocumentId, type SavedDocument } from "@/lib/savedDocuments";
import { useAutosave, type SaveStatus } from "@/lib/useAutosave";
import { useDocumentChat } from "@/lib/useDocumentChat";
import { useToday } from "@/lib/useToday";
import { CompletionStatus } from "./CompletionStatus";
import { DocumentChat } from "./DocumentChat";
import { DocumentForm } from "./DocumentForm";
import { DocumentPreview, EmptyPreview } from "./DocumentPreview";
import { DownloadButton } from "./DownloadButton";

const SAVE_LABELS: Record<SaveStatus, string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  error: "Couldn't save. We'll try again when you make a change.",
};

function SaveIndicator({ status }: { status: SaveStatus }) {
  return (
    <span aria-live="polite" className={`text-xs ${status === "error" ? "text-red-700" : "text-slate-500"}`}>
      {status === "saved" && (
        <span aria-hidden="true" className="mr-1 text-emerald-600">
          ✓
        </span>
      )}
      {SAVE_LABELS[status]}
    </span>
  );
}

function DraftNotice() {
  return (
    <p role="note" className="mb-8 rounded-lg border-l-4 border-accent bg-accent/10 px-4 py-3 font-sans text-xs text-slate-700">
      <strong className="font-semibold text-navy">Draft.</strong> {DISCLAIMER}
    </p>
  );
}

interface DocumentCreatorProps {
  documents: DocumentDef[];
  /** A saved agreement to carry on with. Without it, the creator starts a new one. */
  initial?: SavedDocument;
  /** Called when the user starts over, after the creator has reset itself. */
  onStartOver?: () => void;
}

export function DocumentCreator({ documents, initial, onStartOver }: DocumentCreatorProps) {
  const [state, setState] = useState<DocState>(() =>
    initial ? { document: initial.document, values: initial.values, parties: initial.parties } : emptyState,
  );
  // Each agreement is saved under its own id; starting over begins a new one.
  const [id, setId] = useState(() => initial?.id ?? newDocumentId());
  const today = useToday();
  const chat = useDocumentChat(state, setState, today, initial?.messages);
  // Not while a reply is on its way, or after one failed: the conversation would end with an unanswered message.
  const saveStatus = useAutosave(id, state, chat.messages, {
    paused: chat.status !== "idle",
    savedRevision: initial?.revision,
  });
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

  function startOver() {
    chat.reset();
    setId(newDocumentId());
    onStartOver?.();
  }

  return (
    <div>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          <DocumentChat {...chat} reset={startOver} />

          <details className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl bg-white px-5 py-3.5 text-sm font-semibold text-navy shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              Edit the fields yourself
              <span aria-hidden="true" className="text-slate-500 transition group-open:rotate-180">
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
          className="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 shadow-slate-900/5 ring-slate-200 lg:sticky lg:top-20"
        >
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 className="text-sm font-semibold">Preview</h2>
              <span aria-live="polite">{missing !== null && <CompletionStatus missing={missing} />}</span>
              {document && <SaveIndicator status={saveStatus} />}
            </div>
            <div className="hidden lg:block">{download}</div>
          </div>
          <div className="px-6 py-8 sm:px-12 sm:py-12 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto">
            {document && coverPage && text ? (
              <>
                <DraftNotice />
                <DocumentPreview document={document} coverPage={coverPage} text={text} />
              </>
            ) : (
              <EmptyPreview documents={documents} />
            )}
          </div>
        </section>
      </div>

      {/* On small screens the preview sits below the chat, so keep the download action in reach. It sticks to
          the bottom of the window until the end of the creator, so it never covers the footer. */}
      {document && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-8 flex items-center justify-between gap-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:hidden">
          {missing !== null && <CompletionStatus missing={missing} />}
          {download}
        </div>
      )}
    </div>
  );
}
