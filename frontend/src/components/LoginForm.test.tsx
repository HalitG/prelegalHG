// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signIn } from "@/lib/session";
import { LoginForm } from "./LoginForm";

// useRouter only works inside a mounted Next.js app.
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  router.replace.mockClear();
});

const storedSession = () => localStorage.getItem("prelegal.session");

async function fillIn(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText("Email"), email);
  if (password) await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginForm", () => {
  it("is part of the static HTML, so it shows before JavaScript loads", () => {
    const html = renderToString(<LoginForm />);
    expect(html).toContain('aria-label="Sign in"');
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
  });

  it("signs in with any email and password and opens the platform", async () => {
    render(<LoginForm />);
    await fillIn("jo@acme.com", "x");
    expect(storedSession()).toBe('{"email":"jo@acme.com"}');
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("does not sign in until both fields are filled in", async () => {
    render(<LoginForm />);
    await fillIn("jo@acme.com", "");
    expect(storedSession()).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("does not sign in with something that isn't an email address", async () => {
    render(<LoginForm />);
    await fillIn("jo", "secret");
    expect(storedSession()).toBeNull();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("sends a visitor who is already signed in straight to the platform", () => {
    signIn("jo@acme.com");
    render(<LoginForm />);
    expect(screen.queryByRole("form", { name: "Sign in" })).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});
