"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { deleteDocument, listDocuments, SavedDocumentsError, type DocumentSummary } from "@/lib/savedDocuments";
import { useLoaded } from "@/lib/useLoaded";
import { Button, buttonClass } from "./Button";
import { CompletionStatus } from "./CompletionStatus";

function parties([first, second]: [string, string]) {
  const named = [first, second].map((company) => company.trim()).filter(Boolean);
  return named.length ? named.join(" and ") : "Parties not added yet";
}

/** Names an agreement for screen readers, since several can be of the same kind. */
const describe = (document: DocumentSummary) => `the ${document.documentName}: ${parties(document.companies)}`;

const updated = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** The signed-in user's agreements, newest first, to open or delete. */
export function DocumentList() {
  const { loaded, retry, update } = useLoaded(null, listDocuments);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const container = useRef<HTMLDivElement>(null);
  // The buttons the user pressed disappear, so say where the keyboard focus goes next (a CSS selector).
  const focusNext = useRef<string | null>(null);

  useEffect(() => {
    if (!focusNext.current) return;
    container.current?.querySelector<HTMLElement>(focusNext.current)?.focus();
    focusNext.current = null;
  });

  function confirm(id: string | null, focus: string) {
    focusNext.current = focus;
    setConfirming(id);
  }

  async function remove(document: DocumentSummary, documents: DocumentSummary[]) {
    const index = documents.indexOf(document);
    const next = documents[index + 1] ?? documents[index - 1];
    focusNext.current = next ? `[data-open="${next.id}"]` : "[data-first-agreement]";
    setConfirming(null);
    setDeleteError(null);
    update((all) => all.filter((other) => other.id !== document.id));
    try {
      await deleteDocument(document.id);
    } catch (error) {
      // Put it back where it was: it is still saved.
      update((all) => [...all.slice(0, index), document, ...all.slice(index)]);
      const reason = error instanceof SavedDocumentsError ? error.message : String(error);
      setDeleteError(`Couldn't delete the ${document.documentName}. ${reason}`);
    }
  }

  function content() {
    if (loaded.status === "loading") {
      return (
        <div role="status" className="space-y-3">
          <span className="sr-only">Loading your agreements</span>
          {[0, 1, 2].map((i) => (
            <div key={i} aria-hidden="true" className="h-20 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200 motion-reduce:animate-none" />
          ))}
        </div>
      );
    }

    if (loaded.status === "error") {
      return (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-700 ring-1 ring-red-200">
          Couldn&rsquo;t load your agreements. {loaded.error.message}
          <Button variant="outline" onClick={retry}>
            Retry
          </Button>
        </div>
      );
    }

    const documents = loaded.data;
    return (
      <div className="space-y-4">
        {deleteError && (
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700 ring-1 ring-red-200">
            {deleteError}
          </p>
        )}
        {documents.length === 0 ? (
          <div className="rounded-2xl bg-white px-6 py-16 text-center shadow-sm ring-1 ring-slate-200">
            <h2 className="text-lg font-semibold">No agreements yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
              Tell the AI assistant what you need, and the agreement it prepares will be saved here.
            </p>
            <Link href="/" data-first-agreement className={buttonClass("primary", "mt-6")}>
              Create your first agreement
            </Link>
          </div>
        ) : (
          <ul aria-label="Your agreements" className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            {documents.map((document) => (
              <li key={document.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold">{document.documentName}</h2>
                  <p className="truncate text-sm text-slate-600">{parties(document.companies)}</p>
                </div>
                <div className="flex flex-col items-start gap-0.5 sm:w-56">
                  <CompletionStatus missing={document.missing} />
                  <span className="text-xs whitespace-nowrap text-slate-500">
                    Updated {updated.format(new Date(document.updatedAt))}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {confirming === document.id ? (
                    <>
                      <span className="text-sm text-slate-700">Delete it?</span>
                      <Button
                        variant="outline"
                        onClick={() => remove(document, documents)}
                        className="text-red-700"
                        aria-label={`Yes, delete ${describe(document)}`}
                      >
                        Delete
                      </Button>
                      <Button
                        variant="outline"
                        data-cancel={document.id}
                        onClick={() => confirm(null, `[data-delete="${document.id}"]`)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Link
                        href={`/?doc=${document.id}`}
                        data-open={document.id}
                        className={buttonClass("primary")}
                        aria-label={`Open ${describe(document)}`}
                      >
                        Open
                      </Link>
                      <Button
                        variant="outline"
                        data-delete={document.id}
                        onClick={() => confirm(document.id, `[data-cancel="${document.id}"]`)}
                        aria-label={`Delete ${describe(document)}`}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return <div ref={container}>{content()}</div>;
}
