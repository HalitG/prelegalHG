"use client";

import { signOut, useSession } from "@/lib/session";
import { Button } from "./Button";
import { Logo } from "./Logo";

export function AppHeader() {
  const state = useSession();

  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Logo />
        {state.status === "signed-in" && (
          <div className="ml-auto flex min-w-0 items-center gap-4">
            <span className="max-w-40 truncate text-sm text-muted sm:max-w-64" title={state.session.email}>
              {state.session.email}
            </span>
            <Button variant="outline" onClick={() => signOut()}>
              Sign out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
