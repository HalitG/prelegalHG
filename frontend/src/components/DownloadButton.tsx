"use client";

import { useState } from "react";
import type { CoverPageModel } from "@/lib/documents/coverPage";
import type { DocumentDef, DocumentText } from "@/lib/documents/types";
import { Button } from "./Button";

interface DownloadButtonProps {
  document: DocumentDef;
  /** Null while the agreement's text is still loading. */
  text: DocumentText | null;
  coverPage: CoverPageModel;
  fileName: string;
}

export function DownloadButton({ document: agreement, text, coverPage, fileName }: DownloadButtonProps) {
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");

  async function download() {
    if (!text) return;
    setStatus("working");
    try {
      // The PDF renderer is large, so it is only loaded when someone actually downloads.
      const [{ pdf }, { DocumentPdf, registerPdfFonts }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./DocumentPdf"),
      ]);
      registerPdfFonts("/fonts");
      const blob = await pdf(<DocumentPdf document={agreement} text={text} coverPage={coverPage} />).toBlob();

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      // Attached and revoked late so Safari and Firefox reliably start the download.
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setStatus("idle");
    } catch (error) {
      console.error("Failed to generate the PDF", error);
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center gap-3">
      {status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          Couldn&rsquo;t create the PDF. Please try again.
        </p>
      )}
      <Button onClick={download} disabled={!text || status === "working"} className="disabled:cursor-wait">
        {status === "working" ? (
          <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        ) : (
          <svg className="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
            <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
          </svg>
        )}
        {status === "working" ? "Preparing PDF…" : "Download PDF"}
      </Button>
    </div>
  );
}
