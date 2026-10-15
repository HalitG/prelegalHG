import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-primary text-white hover:bg-primary/90 focus-visible:outline-primary",
  /** Purple is reserved for submitting forms. */
  secondary: "bg-secondary text-white hover:bg-secondary/90 focus-visible:outline-secondary",
  outline: "bg-white text-navy ring-1 ring-slate-300 ring-inset hover:bg-slate-50 focus-visible:outline-primary",
};

export const buttonClass = (variant: keyof typeof variants = "primary", className = "") =>
  `inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-70 ${variants[variant]} ${className}`;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  /** Shows a spinner and disables the button while its action runs. */
  loading?: boolean;
}

/** A brand button. Defaults to `type="button"` so it never submits a form by accident. */
export function Button({
  variant = "primary",
  type = "button",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass(variant, `${loading ? "cursor-wait" : ""} ${className}`)}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none"
        />
      )}
      {children}
    </button>
  );
}
