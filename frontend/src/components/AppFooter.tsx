import { DISCLAIMER } from "@/lib/disclaimer";

/** On every screen: the reminder that the documents are drafts. */
export function AppFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-5 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <strong className="font-semibold text-navy">Drafts only.</strong> {DISCLAIMER}
        </p>
        <p className="shrink-0 text-slate-500">Based on Common Paper standard agreements</p>
      </div>
    </footer>
  );
}
