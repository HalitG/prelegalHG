// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DISCLAIMER_CONSENT } from "@/lib/disclaimer";
import { setSessionForTests } from "@/lib/session";
import { SignUpForm } from "./SignUpForm";

const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => setSessionForTests({ status: "signed-out" }));

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  router.replace.mockClear();
});

async function fillIn({ name = "Jo Smith", email = "jo@acme.com", password = "correct horse", accept = true } = {}) {
  const user = userEvent.setup();
  if (name) await user.type(screen.getByLabelText("Name"), name);
  if (email) await user.type(screen.getByLabelText("Email"), email);
  if (password) await user.type(screen.getByLabelText("Password"), password);
  if (accept) await user.click(screen.getByLabelText(DISCLAIMER_CONSENT));
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

describe("SignUpForm", () => {
  it("is part of the static HTML", () => {
    const html = renderToString(<SignUpForm />);
    expect(html).toContain('aria-label="Create your account"');
    expect(html).toContain(DISCLAIMER_CONSENT);
  });

  it("creates the account and opens the platform", async () => {
    fetchMock.mockResolvedValue(json({ id: 1, name: "Jo Smith", email: "jo@acme.com" }, 201));
    render(<SignUpForm />);
    await fillIn();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/signup");
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      name: "Jo Smith",
      email: "jo@acme.com",
      password: "correct horse",
      acceptedDisclaimer: true,
    });
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("needs a name, an email, a password of at least 8 characters and the disclaimer accepted", async () => {
    render(<SignUpForm />);
    await fillIn({ name: "", email: "jo@", password: "short", accept: false });
    expect(screen.getByText("Enter your name.")).toBeTruthy();
    expect(screen.getByText("Enter your email address, like jo@company.com.")).toBeTruthy();
    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();
    expect(screen.getByText("Please confirm that you understand this to create an account.")).toBeTruthy();
    expect(screen.getByLabelText(DISCLAIMER_CONSENT).getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not sign up without accepting the disclaimer", async () => {
    render(<SignUpForm />);
    await fillIn({ accept: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("points at the email when it already has an account", async () => {
    fetchMock.mockResolvedValue(json({ detail: "An account with this email already exists." }, 409));
    render(<SignUpForm />);
    await fillIn();
    const email = screen.getByLabelText("Email");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("An account with this email already exists.")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("explains other failures", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<SignUpForm />);
    await fillIn();
    expect(screen.getByRole("alert").textContent).toBe(
      "Couldn't reach the server. Check your connection and try again.",
    );
  });

  it("links to signing in", () => {
    render(<SignUpForm />);
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login/");
  });
});
