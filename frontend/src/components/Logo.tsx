export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-7 place-items-center rounded-lg bg-navy font-serif text-xs font-semibold tracking-tight text-accent ${className}`}
    >
      PL
    </span>
  );
}

/** `compact`: only the mark on small screens, where the header needs the room. */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <LogoMark />
      <span className={`font-semibold tracking-wider text-navy ${compact ? "hidden sm:inline" : ""}`}>PRELEGAL</span>
    </span>
  );
}
