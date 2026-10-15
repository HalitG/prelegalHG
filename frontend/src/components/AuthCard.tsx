"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/lib/session";
import { Logo } from "./Logo";
import { Splash } from "./Splash";

/**
 * The card around the sign-in and sign-up forms. A visitor who is signed in, or signs in here, goes to the
 * platform. The form is in the static HTML, so it shows before JavaScript loads.
 */
export function AuthCard({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === "signed-in") router.replace("/");
  }, [status, router]);

  if (status === "signed-in") return <Splash />;

  return (
    <div className="w-full max-w-md">
      <div className="mb-8 flex justify-center">
        <Logo />
      </div>
      <div className="rounded-2xl border-t-4 border-accent bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </div>
      <p className="mt-6 text-center text-sm text-slate-600">{footer}</p>
    </div>
  );
}

/** For the link to the other form, under the card. */
export const textLink = "font-semibold text-navy underline-offset-2 hover:underline";

/** A form-level error, such as wrong credentials. */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">
      {children}
    </p>
  );
}

/** Puts the cursor in the first field the user needs to fix, once React has marked it. */
export function focusFirstInvalid(form: HTMLFormElement) {
  requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}
