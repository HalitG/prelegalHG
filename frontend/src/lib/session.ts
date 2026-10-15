import { useSyncExternalStore } from "react";
import { errorDetail, jsonRequest } from "./http";

/*
 * Who is signed in. The server keeps the sign-in in an HttpOnly cookie, which the page can't read, so it asks
 * GET /api/auth/me once it is running. Until the answer arrives the state is "loading", which is also what the
 * static HTML is rendered with, so hydration always matches.
 */

export interface Session {
  id: number;
  name: string;
  email: string;
}

export type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; session: Session };

const LOADING: SessionState = { status: "loading" };
const SIGNED_OUT: SessionState = { status: "signed-out" };

let current: SessionState = LOADING;
let checking = false;
const listeners = new Set<() => void>();

function set(next: SessionState) {
  current = next;
  listeners.forEach((listener) => listener());
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  if (current.status === "loading" && !checking) void check();
  return () => {
    listeners.delete(onChange);
  };
}

/** Asks the server who is signed in. Signing in or out meanwhile wins over the answer. */
async function check() {
  checking = true;
  let next = SIGNED_OUT;
  try {
    const response = await fetch("/api/auth/me");
    if (response.ok) next = { status: "signed-in", session: (await response.json()) as Session };
  } catch {
    // The server can't be reached: treat it as signed out, so the visitor sees the sign-in form.
  }
  if (current.status === "loading") set(next);
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, () => current, () => LOADING);
}

/** Signing up or in failed. `message` is written for the user; `field` is the form field it is about, if any. */
export class AuthError extends Error {
  override name = "AuthError";
  constructor(
    message: string,
    readonly field?: "email",
  ) {
    super(message);
  }
}

/** Signs up or in. Fails only with an AuthError, from `describe` if the server said no. */
async function authenticate(
  path: string,
  body: object,
  failure: string,
  describe: (response: Response) => AuthError | Promise<AuthError>,
) {
  let response: Response;
  try {
    response = await fetch(path, jsonRequest("POST", body));
  } catch {
    throw new AuthError("Couldn't reach the server. Check your connection and try again.");
  }
  if (!response.ok) throw await describe(response);
  let session: Session;
  try {
    session = (await response.json()) as Session;
  } catch {
    throw new AuthError(failure);
  }
  set({ status: "signed-in", session });
}

export function signIn(email: string, password: string): Promise<void> {
  const failure = "Couldn't sign you in. Please try again.";
  return authenticate("/api/auth/signin", { email, password }, failure, (response) =>
    new AuthError(response.status === 401 ? "Incorrect email or password." : failure),
  );
}

export interface SignUpDetails {
  name: string;
  email: string;
  password: string;
  acceptedDisclaimer: boolean;
}

export function signUp(details: SignUpDetails): Promise<void> {
  const failure = "Couldn't create your account. Check the details and try again.";
  return authenticate("/api/auth/signup", details, failure, async (response) =>
    response.status === 409
      ? new AuthError((await errorDetail(response)) ?? "An account with this email already exists.", "email")
      : new AuthError(failure),
  );
}

/** Signs out. The page leaves the platform even if the server can't be reached. */
export async function signOut(): Promise<void> {
  try {
    await fetch("/api/auth/signout", { method: "POST" });
  } catch {
    // The cookie stays, but the server forgets the sign-in when it restarts.
  }
  set(SIGNED_OUT);
}

/** The server no longer knows the sign-in (see apiFetch). */
export function expireSession() {
  set(SIGNED_OUT);
}

/** For tests: sets who is signed in without asking the server, or starts over from "loading". */
export function setSessionForTests(state: SessionState) {
  checking = state.status !== "loading";
  set(state);
}
