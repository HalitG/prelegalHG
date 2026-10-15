// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signIn, signOut } from "@/lib/session";
import { AuthGuard } from "./AuthGuard";

// useRouter only works inside a mounted Next.js app.
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  router.replace.mockClear();
});

const platform = (
  <AuthGuard>
    <p>Platform</p>
  </AuthGuard>
);

describe("AuthGuard", () => {
  it("shows the platform to a signed-in visitor", () => {
    signIn("jo@acme.com");
    render(platform);
    expect(screen.getByText("Platform")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to the sign-in page without showing the platform", () => {
    render(platform);
    expect(screen.queryByText("Platform")).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/login/");
  });

  it("leaves the platform when the visitor signs out", () => {
    signIn("jo@acme.com");
    render(platform);
    act(() => signOut());
    expect(screen.queryByText("Platform")).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/login/");
  });

  it("puts only a placeholder in the static HTML", () => {
    signIn("jo@acme.com");
    const html = renderToString(platform);
    expect(html).not.toContain("Platform");
    expect(html).toContain('role="status"');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("hydrates the static HTML without a mismatch, then shows the platform", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(platform);
    document.body.append(container);
    signIn("jo@acme.com");

    const errors: unknown[] = [];
    const root = await act(async () =>
      hydrateRoot(container, platform, { onRecoverableError: (error) => errors.push(error) }),
    );

    expect(errors).toEqual([]);
    expect(container.textContent).toBe("Platform");
    act(() => root.unmount());
    container.remove();
  });
});
