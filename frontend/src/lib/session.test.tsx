// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSession, signIn, signOut, useSession } from "./session";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("parseSession", () => {
  it("returns the stored email", () => {
    expect(parseSession('{"email":"jo@acme.com"}')).toEqual({ email: "jo@acme.com" });
  });

  it("treats missing, corrupt or incomplete values as no session", () => {
    for (const raw of [null, "", "not json", "null", "5", "{}", '{"email":""}', '{"email":5}']) {
      expect(parseSession(raw)).toBeNull();
    }
  });
});

describe("signIn", () => {
  it("remembers only the email", () => {
    signIn("jo@acme.com");
    expect(localStorage.getItem("prelegal.session")).toBe('{"email":"jo@acme.com"}');
  });
});

describe("useSession", () => {
  it("is signed out when nothing is stored", () => {
    const { result } = renderHook(useSession);
    expect(result.current).toEqual({ status: "signed-out" });
  });

  it("follows signing in and out", () => {
    const { result } = renderHook(useSession);
    act(() => signIn("jo@acme.com"));
    expect(result.current).toEqual({ status: "signed-in", session: { email: "jo@acme.com" } });
    act(() => signOut());
    expect(result.current).toEqual({ status: "signed-out" });
  });

  it("follows signing in and out in another tab", () => {
    const { result } = renderHook(useSession);
    act(() => {
      localStorage.setItem("prelegal.session", '{"email":"jo@acme.com"}');
      window.dispatchEvent(new StorageEvent("storage"));
    });
    expect(result.current.status).toBe("signed-in");
    act(() => {
      localStorage.clear();
      window.dispatchEvent(new StorageEvent("storage"));
    });
    expect(result.current.status).toBe("signed-out");
  });

  it("keeps returning the same state until the session changes", () => {
    signIn("jo@acme.com");
    const { result, rerender } = renderHook(useSession);
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("treats unreadable storage as signed out", () => {
    signIn("jo@acme.com");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage is blocked");
    });
    const { result } = renderHook(useSession);
    expect(result.current).toEqual({ status: "signed-out" });
  });

  it("is loading while the static HTML is rendered, even if a session is stored", () => {
    signIn("jo@acme.com");
    function Status() {
      return useSession().status;
    }
    expect(renderToString(<Status />)).toBe("loading");
  });
});
