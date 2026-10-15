import type { ReactNode } from "react";

/** A page's title and the sentence or two under it. */
export function PageHeading({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-8 max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-slate-600">{children}</p>
    </div>
  );
}
