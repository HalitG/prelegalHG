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
      {/* CreateAgreement reads ?doc= from the address, which the static export can only do in the browser. Its
          heading says whether the user is creating an agreement or editing a saved one. */}
      <Suspense fallback={<Splash />}>
        <CreateAgreement documents={loadDocuments()} />
      </Suspense>
    </main>
  );
}
