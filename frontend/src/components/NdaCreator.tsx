"use client";

import { useMemo, useState } from "react";
import { buildCoverPage, countMissing, pdfFileName } from "@/lib/nda/coverPage";
import type { MndaTemplate } from "@/lib/nda/template";
import { defaultFormData, type NdaFormData } from "@/lib/nda/types";
import { useToday } from "@/lib/useToday";
import { DownloadButton } from "./DownloadButton";
import { NdaForm } from "./NdaForm";
import { NdaPreview } from "./NdaPreview";

function CompletionStatus({ missing }: { missing: number }) {
  return missing === 0 ? (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
      <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
      Ready to sign
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
      <span className="size-2 rounded-full bg-amber-400" aria-hidden="true" />
      {missing} {missing === 1 ? "field" : "fields"} left
    </span>
  );
}

export function NdaCreator({ template }: { template: MndaTemplate }) {
  const [form, setForm] = useState<NdaFormData>(defaultFormData);
  const today = useToday();
  const coverPage = useMemo(() => buildCoverPage(form, today), [form, today]);
  const missing = countMissing(coverPage);
  const download = <DownloadButton template={template} coverPage={coverPage} fileName={pdfFileName(form.parties)} />;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
      <NdaForm form={form} today={today} onChange={setForm} />

      <section
        aria-label="Document preview"
        className="overflow-hidden rounded-2xl bg-white shadow-xl ring-1 shadow-slate-900/5 ring-slate-200 lg:sticky lg:top-6"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-900">Preview</h2>
            <span aria-live="polite">
              <CompletionStatus missing={missing} />
            </span>
          </div>
          <div className="hidden lg:block">{download}</div>
        </div>
        <div className="px-6 py-8 sm:px-12 sm:py-12 lg:max-h-[calc(100vh-7.5rem)] lg:overflow-y-auto">
          <NdaPreview template={template} coverPage={coverPage} />
        </div>
      </section>

      {/* On small screens the preview sits below the form, so keep the download action in reach. */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <CompletionStatus missing={missing} />
        {download}
      </div>
    </div>
  );
}
