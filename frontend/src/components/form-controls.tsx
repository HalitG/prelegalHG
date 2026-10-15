import { useId, type ReactNode } from "react";
import { MAX_YEARS } from "@/lib/nda/coverPage";

export const inputClass =
  "block rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs ring-1 ring-slate-300 ring-inset placeholder:text-muted focus:ring-2 focus:ring-primary focus:outline-none";

export function FormSection({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-navy ring-1 ring-primary/30">
          {step}
        </span>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  type?: "text" | "date" | "email" | "password";
  multiline?: boolean;
  name?: string;
  autoComplete?: string;
  required?: boolean;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
  multiline,
  name,
  autoComplete,
  required,
}: TextFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const shared = {
    id,
    name,
    value,
    placeholder,
    autoComplete,
    required,
    "aria-describedby": hintId,
    className: `${inputClass} w-full`,
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {multiline ? (
        <textarea {...shared} rows={3} onChange={(e) => onChange(e.target.value)} className={`${shared.className} resize-y`} />
      ) : (
        <input {...shared} type={type} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * A segmented radio group. `children` render below the options, e.g. a years
 * input that only applies to one choice.
 */
export function ChoiceGroup<T extends string>({
  legend,
  value,
  options,
  onChange,
  children,
}: {
  legend: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  children?: ReactNode;
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-slate-700">{legend}</legend>
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
        {options.map((option) => (
          <label
            key={option.value}
            className="cursor-pointer rounded-md px-3 py-1.5 text-center text-sm font-medium text-slate-600 transition has-checked:bg-white has-checked:text-navy has-checked:shadow-sm has-focus-visible:ring-2 has-focus-visible:ring-primary"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </fieldset>
  );
}

export function YearsField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-3">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={1}
        max={MAX_YEARS}
        step={1}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} w-20`}
      />
      <span className="text-sm text-slate-600">{suffix}</span>
    </div>
  );
}
