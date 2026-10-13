import { useMemo, useSyncExternalStore } from "react";

/*
 * The prototype session. Nothing is authenticated: signing in just remembers the email in localStorage.
 * Real sign-in replaces this module and keeps its exports (useSession, signIn, signOut).
 */

const STORAGE_KEY = "prelegal.session";

export interface Session {
  email: string;
}

export type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; session: Session };

const LOADING: SessionState = { status: "loading" };
const SIGNED_OUT: SessionState = { status: "signed-out" };

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // Fires when another tab signs in or out.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function notify() {
  listeners.forEach((listener) => listener());
}

/** The stored string rather than a parsed object, so the snapshot only changes when storage does. */
function readStoredSession(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // Storage can be blocked by privacy settings; treat that as signed out.
  }
}

export function parseSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const email = (JSON.parse(raw) as Partial<Session> | null)?.email;
    return typeof email === "string" && email ? { email } : null;
  } catch {
    return null;
  }
}

/**
 * The current session. It is "loading" while the static HTML is prerendered and hydrated, because storage
 * can only be read in the browser; the first client render after that has the real state.
 */
export function useSession(): SessionState {
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, readStoredSession, () => undefined);
  return useMemo(() => {
    if (raw === undefined) return LOADING;
    const session = parseSession(raw);
    return session ? { status: "signed-in", session } : SIGNED_OUT;
  }, [raw]);
}

/** Signs in as `email`. No password is checked or stored. */
export function signIn(email: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ email } satisfies Session));
  notify();
}

export function signOut() {
  localStorage.removeItem(STORAGE_KEY);
  notify();
}
