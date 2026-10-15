"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { DISCLAIMER_CONSENT } from "@/lib/disclaimer";
import { signUp, type AuthError } from "@/lib/session";
import { looksLikeEmail, MAX_NAME, MAX_PASSWORD, MIN_PASSWORD } from "@/lib/validation";
import { AuthCard, focusFirstInvalid, FormAlert, textLink } from "./AuthCard";
import { Button } from "./Button";
import { CheckboxField, PasswordField, TextField } from "./form-controls";

interface Errors {
  name?: string;
  email?: string;
  password?: string;
  accepted?: string;
}

export function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const found: Errors = {
      name: name.trim() ? undefined : "Enter your name.",
      email: looksLikeEmail(email) ? undefined : "Enter your email address, like jo@company.com.",
      password: password.length >= MIN_PASSWORD ? undefined : `Use at least ${MIN_PASSWORD} characters.`,
      accepted: accepted ? undefined : "Please confirm that you understand this to create an account.",
    };
    setErrors(found);
    setFailure(null);
    if (Object.values(found).some(Boolean)) return focusFirstInvalid(form);

    setSubmitting(true);
    try {
      await signUp({ name, email, password, acceptedDisclaimer: true });
    } catch (caught) {
      const error = caught as AuthError;
      if (error.field === "email") {
        setErrors({ email: error.message });
        focusFirstInvalid(form);
      } else {
        setFailure(error.message);
      }
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Draft Common Paper agreements with an AI assistant, and keep them all in one place."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login/" className={textLink}>
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-4" aria-label="Create your account" noValidate onSubmit={submit}>
        {failure && <FormAlert>{failure}</FormAlert>}
        <TextField
          label="Name"
          name="name"
          autoComplete="name"
          required
          maxLength={MAX_NAME}
          value={name}
          onChange={setName}
          placeholder="Jo Smith"
          error={errors.name}
        />
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
          autoComplete="new-password"
          required
          maxLength={MAX_PASSWORD}
          value={password}
          onChange={setPassword}
          hint={`At least ${MIN_PASSWORD} characters.`}
          error={errors.password}
        />
        <CheckboxField label={DISCLAIMER_CONSENT} checked={accepted} onChange={setAccepted} error={errors.accepted} />
        <Button type="submit" variant="secondary" className="w-full" loading={submitting}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
