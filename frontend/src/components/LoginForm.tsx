"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { signIn, useSession } from "@/lib/session";
import { Button } from "./Button";
import { Logo } from "./Logo";
import { Splash } from "./Splash";
import { TextField } from "./form-controls";

/** The prototype sign-in: any email and password let the visitor in. Nothing is verified or sent anywhere. */
export function LoginForm() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Covers both signing in here and opening this page while already signed in.
  useEffect(() => {
    if (status === "signed-in") router.replace("/");
  }, [status, router]);

  if (status === "signed-in") return <Splash />;

  // The browser has already checked that both fields are filled in and the email looks valid.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    signIn(email);
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex justify-center">
        <Logo />
      </div>
      <div className="rounded-2xl border-t-4 border-accent bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted">Prototype: any email and password will sign you in.</p>
        <form className="mt-6 space-y-4" aria-label="Sign in" onSubmit={submit}>
          <TextField
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={setEmail}
            placeholder="you@company.com"
          />
          <TextField
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={setPassword}
          />
          <Button type="submit" variant="secondary" className="w-full">
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
