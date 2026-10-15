import type { Metadata } from "next";
import { Suspense } from "react";
import { CreateAgreement } from "@/components/CreateAgreement";
import { Splash } from "@/components/Splash";
import { loadDocuments } from "@/lib/documents/registry";

export const metadata: Metadata = {
  title: "Create an agreement",
};

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-8 pb-12 sm:px-6">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Create a Legal Agreement</h1>
        <p className="mt-2 text-slate-600">
          Chat with the AI assistant about what you need. It picks the right Common Paper agreement, asks for the
          key terms and both parties&rsquo; details, and fills in the agreement as you go. Your work is saved as
          you go, and you can download it as a PDF.
        </p>
      </div>
      {/* CreateAgreement reads ?doc= from the address, which the static export can only do in the browser. */}
      <Suspense fallback={<Splash />}>
        <CreateAgreement documents={loadDocuments()} />
      </Suspense>
    </main>
  );
}
