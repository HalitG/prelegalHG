"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { signIn, type AuthError } from "@/lib/session";
import { looksLikeEmail } from "@/lib/validation";
import { AuthCard, focusFirstInvalid, FormAlert, textLink } from "./AuthCard";
import { Button } from "./Button";
import { PasswordField, TextField } from "./form-controls";

interface Errors {
  email?: string;
  password?: string;
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const found: Errors = {
      email: looksLikeEmail(email) ? undefined : "Enter your email address, like jo@company.com.",
      password: password ? undefined : "Enter your password.",
    };
    setErrors(found);
    setFailure(null);
    if (found.email || found.password) return focusFirstInvalid(form);

    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (error) {
      setFailure((error as AuthError).message);
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back. Sign in to draft agreements and pick up where you left off."
      footer={
        <>
          New to Prelegal?{" "}
          <Link href="/signup/" className={textLink}>
            Create an account
          </Link>
        </>
      }
    >
      <form className="space-y-4" aria-label="Sign in" noValidate onSubmit={submit}>
        {failure && <FormAlert>{failure}</FormAlert>}
        <TextField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={setEmail}
          placeholder="you@company.com"
          error={errors.email}
        />
        <PasswordField
          label="Password"
          name="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={setPassword}
          error={errors.password}
        />
        <Button type="submit" variant="secondary" className="w-full" loading={submitting}>
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}
