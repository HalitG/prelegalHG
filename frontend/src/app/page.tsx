import { NdaCreator } from "@/components/NdaCreator";
import { loadMndaTemplate } from "@/lib/nda/template";

/** The templates are read at build time, so the whole page is served as static output. */
export const ensureStatic = "navigation";

export default function Home() {
  return (
    <>
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <span className="grid size-7 place-items-center rounded-lg bg-indigo-600 font-serif text-sm font-semibold text-white">
            p
          </span>
          <span className="font-semibold tracking-tight">prelegal</span>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
            Mutual NDA
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pt-8 pb-28 sm:px-6 lg:pb-12">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Create a Mutual NDA</h1>
          <p className="mt-2 text-slate-600">
            Fill in the key terms and both parties&rsquo; details. The agreement updates as you type, and you can
            download it as a PDF ready for signature.
          </p>
        </div>
        <NdaCreator template={loadMndaTemplate()} />
      </main>
    </>
  );
}
