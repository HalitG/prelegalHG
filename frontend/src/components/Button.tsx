import type { ButtonHTMLAttributes } from "react";

const variants = {
  primary: "bg-primary text-white hover:bg-primary/90 focus-visible:outline-primary",
  /** Purple is reserved for submitting forms. */
  secondary: "bg-secondary text-white hover:bg-secondary/90 focus-visible:outline-secondary",
  outline: "bg-white text-navy ring-1 ring-slate-300 ring-inset hover:bg-slate-50 focus-visible:outline-primary",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
}

/** A brand button. Defaults to `type="button"` so it never submits a form by accident. */
export function Button({ variant = "primary", type = "button", className = "", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-70 ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
