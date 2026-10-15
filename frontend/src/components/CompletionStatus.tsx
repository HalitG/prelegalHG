/** How close an agreement is to being ready to sign. */
export function CompletionStatus({ missing }: { missing: number }) {
  return missing === 0 ? (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700">
      <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
      Ready to sign
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
      <span className="size-2 rounded-full bg-accent" aria-hidden="true" />
      {missing} {missing === 1 ? "field" : "fields"} left
    </span>
  );
}
