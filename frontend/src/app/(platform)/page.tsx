import type { Metadata } from "next";
import { DocumentCreator } from "@/components/DocumentCreator";
import { loadDocuments } from "@/lib/documents/registry";

export const metadata: Metadata = {
  title: "Create an agreement",
};

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 pt-8 pb-28 sm:px-6 lg:pb-12">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Create a legal agreement</h1>
        <p className="mt-2 text-slate-600">
          Chat with the AI assistant about what you need. It picks the right Common Paper agreement, asks for the
          key terms and both parties&rsquo; details, and fills in the agreement as you go. Then download it as a
          PDF ready for signature.
        </p>
      </div>
      <DocumentCreator documents={loadDocuments()} />
    </main>
  );
}
