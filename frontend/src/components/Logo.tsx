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

export function Logo() {
  return (
    <span className="flex items-center gap-3">
      <LogoMark />
      <span className="font-semibold tracking-wider text-navy">PRELEGAL</span>
    </span>
  );
}
