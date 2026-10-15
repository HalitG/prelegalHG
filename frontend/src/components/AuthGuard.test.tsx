// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setSessionForTests, type SessionState } from "@/lib/session";
import { AuthGuard } from "./AuthGuard";

// useRouter only works inside a mounted Next.js app.
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const SIGNED_IN: SessionState = { status: "signed-in", session: { id: 1, name: "Jo Smith", email: "jo@acme.com" } };

afterEach(() => {
  cleanup();
  router.replace.mockClear();
  setSessionForTests({ status: "signed-out" });
});

const platform = (
  <AuthGuard>
    <p>Platform</p>
  </AuthGuard>
);

describe("AuthGuard", () => {
  it("shows the platform to a signed-in visitor", () => {
    setSessionForTests(SIGNED_IN);
    render(platform);
    expect(screen.getByText("Platform")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to the sign-in page without showing the platform", () => {
    setSessionForTests({ status: "signed-out" });
    render(platform);
    expect(screen.queryByText("Platform")).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/login/");
  });

  it("waits while the server says who is signed in", () => {
    vi.stubGlobal("fetch", () => new Promise(() => {}));
    setSessionForTests({ status: "loading" });
    render(platform);
    expect(screen.queryByText("Platform")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Loading…");
    expect(router.replace).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("leaves the platform when the sign-in ends", () => {
    setSessionForTests(SIGNED_IN);
    render(platform);
    act(() => setSessionForTests({ status: "signed-out" }));
    expect(screen.queryByText("Platform")).toBeNull();
    expect(router.replace).toHaveBeenCalledWith("/login/");
  });

  it("puts only a placeholder in the static HTML", () => {
    setSessionForTests(SIGNED_IN);
    const html = renderToString(platform);
    expect(html).not.toContain("Platform");
    expect(html).toContain('role="status"');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("hydrates the static HTML without a mismatch, then shows the platform", async () => {
    const container = document.createElement("div");
    container.innerHTML = renderToString(platform);
    document.body.append(container);
    setSessionForTests(SIGNED_IN);

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
