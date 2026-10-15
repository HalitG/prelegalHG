// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setSessionForTests } from "@/lib/session";
import { LoginForm } from "./LoginForm";

// useRouter only works inside a mounted Next.js app.
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

async function fillIn(email: string, password: string) {
  const user = userEvent.setup();
  if (email) await user.type(screen.getByLabelText("Email"), email);
  if (password) await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
  return user;
}

describe("LoginForm", () => {
  it("is part of the static HTML, so it shows before JavaScript loads", () => {
    const html = renderToString(<LoginForm />);
    expect(html).toContain('aria-label="Sign in"');
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
    expect(html).not.toContain("Prototype");
  });

  it("signs in with the email and password and opens the platform", async () => {
    fetchMock.mockResolvedValue(json({ id: 1, name: "Jo Smith", email: "jo@acme.com" }));
    render(<LoginForm />);
    await fillIn("jo@acme.com", "correct horse");
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      email: "jo@acme.com",
      password: "correct horse",
    });
    expect(router.replace).toHaveBeenCalledWith("/");
  });

  it("says what is missing, and sends nothing", async () => {
    render(<LoginForm />);
    await fillIn("jo", "");
    const email = screen.getByLabelText("Email");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByText("Enter your email address, like jo@company.com.")).toBeTruthy();
    expect(screen.getByText("Enter your password.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    await act(() => new Promise(requestAnimationFrame));
    expect(document.activeElement).toBe(email);
  });

  it("explains a wrong password, and lets the user try again", async () => {
    fetchMock.mockResolvedValue(json({ detail: "Incorrect email or password." }, 401));
    render(<LoginForm />);
    await fillIn("jo@acme.com", "wrong horse");
    expect(screen.getByRole("alert").textContent).toBe("Incorrect email or password.");
    expect(router.replace).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows that it is signing in", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<LoginForm />);
    await fillIn("jo@acme.com", "correct horse");
    const button = screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("can show the password", async () => {
    render(<LoginForm />);
    const user = userEvent.setup();
    const password = screen.getByLabelText("Password");
    expect(password.getAttribute("type")).toBe("password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(password.getAttribute("type")).toBe("text");
    await user.click(screen.getByRole("button", { name: "Hide password" }));
    expect(password.getAttribute("type")).toBe("password");
  });

  it("links to creating an account", () => {
    render(<LoginForm />);
    expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toBe("/signup/");
  });

  it("sends a visitor who is already signed in straight to the platform", () => {
    setSessionForTests({ status: "signed-in", session: { id: 1, name: "Jo Smith", email: "jo@acme.com" } });
    render(<LoginForm />);
    expect(screen.queryByRole("form", { name: "Sign in" })).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/");
  });
});
