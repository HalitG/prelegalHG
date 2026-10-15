import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/Button";
import { DocumentList } from "@/components/DocumentList";

export const metadata: Metadata = {
  title: "My documents",
};

export default function DocumentsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My Documents</h1>
          <p className="mt-2 text-slate-600">
            Every agreement you start is saved here as you work. Open one to carry on where you left off.
          </p>
        </div>
        <Link href="/" className={buttonClass("primary")}>
          New agreement
        </Link>
      </div>
      <DocumentList />
    </main>
  );
}
