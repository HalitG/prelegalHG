"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut, useSession } from "@/lib/session";
import { savePendingChanges } from "@/lib/useAutosave";
import { Button } from "./Button";
import { Logo } from "./Logo";

// Phones show the short labels, so the header fits.
const LINKS = [
  { href: "/", label: "New agreement", short: "New" },
  { href: "/documents/", label: "My documents", short: "Documents" },
];

/** "/documents" and "/documents/" are the same page. */
const samePage = (a: string, b: string) => a.replace(/\/$/, "") === b.replace(/\/$/, "");

export function AppHeader() {
  const state = useSession();
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  async function leave() {
    setSigningOut(true);
    // Saving needs the sign-in, so save the last changes first.
    await savePendingChanges().catch(() => {});
    await signOut();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:gap-8 sm:px-6">
        <Link href="/" aria-label="Prelegal home" className="shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-primary">
          <Logo compact />
        </Link>
        <nav aria-label="Main" className="flex h-full items-center gap-1 sm:gap-2">
          {LINKS.map(({ href, label, short }) => {
            const current = samePage(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={current ? "page" : undefined}
                aria-label={label}
                className={`flex h-full items-center border-b-2 px-2 text-sm font-medium whitespace-nowrap transition ${
                  current ? "border-accent text-navy" : "border-transparent text-slate-600 hover:text-navy"
                }`}
              >
                <span className="sm:hidden">{short}</span>
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
        {state.status === "signed-in" && (
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <span className="hidden max-w-48 truncate text-sm text-slate-600 md:block" title={state.session.email}>
              {state.session.name}
            </span>
            <Button variant="outline" onClick={leave} loading={signingOut}>
              Sign out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
