// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./api";
import { AuthError, setSessionForTests, signIn, signOut, signUp, useSession, type Session } from "./session";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const JO: Session = { id: 1, name: "Jo Smith", email: "jo@acme.com" };

beforeEach(() => setSessionForTests({ status: "loading" }));

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

const body = (call = 0) => JSON.parse(fetchMock.mock.calls[call][1]?.body as string);

describe("useSession", () => {
  it("asks the server who is signed in, once", async () => {
    fetchMock.mockResolvedValue(json(JO));
    const { result } = renderHook(useSession);
    renderHook(useSession);
    expect(result.current).toEqual({ status: "loading" });
    await waitFor(() => expect(result.current).toEqual({ status: "signed-in", session: JO }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/me");
  });

  it.each([
    ["the server says no one is", async () => json({ detail: "Please sign in." }, 401)],
    ["the server fails", async () => json({}, 500)],
    ["the server can't be reached", () => Promise.reject(new TypeError("Failed to fetch"))],
  ])("is signed out when %s", async (_, response) => {
    fetchMock.mockImplementation(response);
    const { result } = renderHook(useSession);
    await waitFor(() => expect(result.current).toEqual({ status: "signed-out" }));
  });

  it("keeps a sign-in made while the server was still answering", async () => {
    let answer!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
    const { result } = renderHook(useSession);
    fetchMock.mockResolvedValueOnce(json(JO));
    await act(() => signIn("jo@acme.com", "correct horse"));
    await act(async () => answer(json({}, 401)));
    expect(result.current).toEqual({ status: "signed-in", session: JO });
  });

  it("keeps returning the same state until the session changes", () => {
    setSessionForTests({ status: "signed-in", session: JO });
    const { result, rerender } = renderHook(useSession);
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it("is loading while the static HTML is rendered, even when signed in", () => {
    setSessionForTests({ status: "signed-in", session: JO });
    function Status() {
      return useSession().status;
    }
    expect(renderToString(<Status />)).toBe("loading");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("signIn", () => {
  it("sends the email and password and signs in as the user the server returns", async () => {
    setSessionForTests({ status: "signed-out" });
    fetchMock.mockResolvedValue(json(JO));
    const { result } = renderHook(useSession);
    await act(() => signIn("jo@acme.com", "correct horse"));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/signin");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("POST");
    expect(body()).toEqual({ email: "jo@acme.com", password: "correct horse" });
    expect(result.current).toEqual({ status: "signed-in", session: JO });
  });

  it.each([
    [async () => json({ detail: "Incorrect email or password." }, 401), "Incorrect email or password."],
    [async () => json({}, 500), "Couldn't sign you in. Please try again."],
    [() => Promise.reject(new TypeError("Failed to fetch")), "Couldn't reach the server. Check your connection and try again."],
  ])("explains why it failed, and stays signed out", async (response, message) => {
    setSessionForTests({ status: "signed-out" });
    fetchMock.mockImplementation(response);
    const { result } = renderHook(useSession);
    await expect(signIn("jo@acme.com", "wrong")).rejects.toThrow(new AuthError(message));
    expect(result.current).toEqual({ status: "signed-out" });
  });
});

describe("signUp", () => {
  const details = { name: "Jo Smith", email: "jo@acme.com", password: "correct horse", acceptedDisclaimer: true };

  it("creates the account and signs in", async () => {
    setSessionForTests({ status: "signed-out" });
    fetchMock.mockResolvedValue(json(JO, 201));
    const { result } = renderHook(useSession);
    await act(() => signUp(details));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/signup");
    expect(body()).toEqual(details);
    expect(result.current).toEqual({ status: "signed-in", session: JO });
  });

  it("points at the email when it already has an account", async () => {
    fetchMock.mockResolvedValue(json({ detail: "An account with this email already exists." }, 409));
    const error = await signUp(details).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AuthError);
    expect(error).toMatchObject({ message: "An account with this email already exists.", field: "email" });
  });

  it("gives a general message for other failures", async () => {
    fetchMock.mockResolvedValue(json({ detail: [] }, 422));
    await expect(signUp(details)).rejects.toMatchObject({ field: undefined });
  });
});

describe("signing out", () => {
  it("tells the server, then leaves the platform", async () => {
    setSessionForTests({ status: "signed-in", session: JO });
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const { result } = renderHook(useSession);
    await act(() => signOut());
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/signout", { method: "POST" });
    expect(result.current).toEqual({ status: "signed-out" });
  });

  it("leaves the platform even when the server can't be reached", async () => {
    setSessionForTests({ status: "signed-in", session: JO });
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(useSession);
    await act(() => signOut());
    expect(result.current).toEqual({ status: "signed-out" });
  });

  it("happens when any API call finds the sign-in has ended", async () => {
    setSessionForTests({ status: "signed-in", session: JO });
    fetchMock.mockResolvedValue(json({ detail: "Please sign in." }, 401));
    const { result } = renderHook(useSession);
    await act(() => apiFetch("/api/documents"));
    expect(result.current).toEqual({ status: "signed-out" });
  });

  it("does not happen for other API errors", async () => {
    setSessionForTests({ status: "signed-in", session: JO });
    fetchMock.mockResolvedValue(json({}, 500));
    const { result } = renderHook(useSession);
    const response = await act(() => apiFetch("/api/documents"));
    expect(response.status).toBe(500);
    expect(result.current.status).toBe("signed-in");
  });
});
