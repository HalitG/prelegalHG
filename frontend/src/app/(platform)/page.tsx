import type { Metadata } from "next";
import { NdaCreator } from "@/components/NdaCreator";
import { loadMndaTemplate } from "@/lib/nda/template";

export const metadata: Metadata = {
  title: "Mutual NDA Creator",
};

export default function Home() {
  return (
    <main className="mx-auto max-w-7xl px-4 pt-8 pb-28 sm:px-6 lg:pb-12">
      <div className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Create a Mutual NDA</h1>
        <p className="mt-2 text-slate-600">
          Fill in the key terms and both parties&rsquo; details. The agreement updates as you type, and you can
          download it as a PDF ready for signature.
        </p>
      </div>
      <NdaCreator template={loadMndaTemplate()} />
    </main>
  );
}
