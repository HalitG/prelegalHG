"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { DocumentDef } from "@/lib/documents/types";
import { loadDocument } from "@/lib/savedDocuments";
import { useLoaded } from "@/lib/useLoaded";
import { Button, buttonClass } from "./Button";
import { DocumentCreator } from "./DocumentCreator";
import { PageHeading } from "./PageHeading";

/**
 * The agreement creator: a new agreement, or the saved one in `?doc=<id>` (the static export has no per-agreement
 * pages). Starting over on a saved agreement goes back to a new one.
 */
export function CreateAgreement({ documents }: { documents: DocumentDef[] }) {
  const id = useSearchParams().get("doc");
  const router = useRouter();

  if (!id) return <DocumentCreator key="new" documents={documents} />;
  return <SavedAgreement key={id} id={id} documents={documents} onStartOver={() => router.replace("/")} />;
}

function SavedAgreement({
  id,
  documents,
  onStartOver,
}: {
  id: string;
  documents: DocumentDef[];
  onStartOver: () => void;
}) {
  const { loaded, retry } = useLoaded(id, loadDocument);

  if (loaded.status === "ready") {
    return <DocumentCreator documents={documents} initial={loaded.data} onStartOver={onStartOver} />;
  }
  const heading = <PageHeading title="Edit an Agreement">Opening it from My documents.</PageHeading>;
  if (loaded.status === "loading") {
    return (
      <>
        {heading}
        <div role="status" className="rounded-2xl bg-white px-6 py-16 text-center text-sm text-slate-600 shadow-sm ring-1 ring-slate-200">
          Opening your agreement…
        </div>
      </>
    );
  }
  const notFound = loaded.error.status === 404;
  return (
    <>
      {heading}
      <div role="alert" className="rounded-2xl bg-white px-6 py-12 text-center shadow-sm ring-1 ring-slate-200">
        <h2 className="text-lg font-semibold">
          {notFound ? "We couldn't find that agreement" : "Couldn't open the agreement"}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {notFound ? "It may have been deleted. Your other agreements are in My documents." : loaded.error.message}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {!notFound && (
            <Button variant="outline" onClick={retry}>
              Try again
            </Button>
          )}
          <Link href="/documents/" className={buttonClass("primary")}>
            My documents
          </Link>
        </div>
      </div>
    </>
  );
}
