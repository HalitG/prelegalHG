// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GREETING, type ChatMessage } from "./chat";
import { emptyState, type DocState } from "./documents/types";
import { SAVE_DELAY, savePendingChanges, useAutosave } from "./useAutosave";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

const saved = () => new Response(JSON.stringify({ id: "x", updatedAt: "now" }), { status: 200 });

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockImplementation(async () => saved());
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  fetchMock.mockReset();
});

const A = "a".repeat(32);
const B = "b".repeat(32);
const nda: DocState = { ...emptyState, document: "mutual-nda" };
const conversation: ChatMessage[] = [GREETING, { role: "user", content: "An NDA" }];

interface Props {
  id: string;
  state: DocState;
  messages: ChatMessage[];
  paused?: boolean;
  savedRevision?: number;
}

function setup(initial: Props) {
  return renderHook(
    ({ id, state, messages, paused = false, savedRevision }: Props) =>
      useAutosave(id, state, messages, { paused, savedRevision }),
    { initialProps: initial },
  );
}

/** Lets the debounce run out and the save finish. */
const settle = () => act(() => vi.advanceTimersByTimeAsync(SAVE_DELAY));

const puts = () => fetchMock.mock.calls.map(([url, init]) => [url, JSON.parse(init?.body as string)]);

describe("useAutosave", () => {
  it("saves nothing until an agreement is chosen", async () => {
    const { result } = setup({ id: A, state: emptyState, messages: conversation });
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current).toBe("idle");
  });

  it("saves the agreement and the conversation a moment after they change", async () => {
    const { result } = setup({ id: A, state: nda, messages: conversation });
    await act(() => vi.advanceTimersByTimeAsync(SAVE_DELAY - 1));
    expect(fetchMock).not.toHaveBeenCalled();
    await settle();
    expect(puts()).toEqual([[`/api/documents/${A}`, { ...nda, messages: conversation, revision: 1 }]]);
    expect(result.current).toBe("saved");
  });

  it("saves several quick changes once", async () => {
    const { rerender } = setup({ id: A, state: nda, messages: conversation });
    for (const purpose of ["A", "A d", "A deal"]) {
      rerender({ id: A, state: { ...nda, values: { purpose } }, messages: conversation });
      await act(() => vi.advanceTimersByTimeAsync(100));
    }
    await settle();
    expect(puts()).toHaveLength(1);
    expect(puts()[0][1].values).toEqual({ purpose: "A deal" });
  });

  it("waits while a chat reply is on its way", async () => {
    const { rerender } = setup({ id: A, state: nda, messages: conversation, paused: true });
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    rerender({ id: A, state: nda, messages: conversation, paused: false });
    await settle();
    expect(puts()).toHaveLength(1);
  });

  it("doesn't save an agreement that was just opened, until it changes, then carries on from its revision", async () => {
    const { result, rerender } = setup({ id: A, state: nda, messages: conversation, savedRevision: 4 });
    expect(result.current).toBe("saved");
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
    rerender({ id: A, state: { ...nda, values: { purpose: "x" } }, messages: conversation, savedRevision: 4 });
    await settle();
    expect(puts().map(([, body]) => body.revision)).toEqual([5]);
  });

  it("doesn't save a change that was undone", async () => {
    const { rerender } = setup({ id: A, state: nda, messages: conversation, savedRevision: 1 });
    rerender({ id: A, state: { ...nda, values: { purpose: "x" } }, messages: conversation });
    rerender({ id: A, state: nda, messages: conversation });
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("saves one at a time, in order", async () => {
    let finish!: () => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => (finish = () => resolve(saved()))));
    const { result, rerender } = setup({ id: A, state: nda, messages: conversation });
    await settle();
    expect(result.current).toBe("saving");

    rerender({ id: A, state: { ...nda, values: { purpose: "later" } }, messages: conversation });
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => finish());
    expect(puts().map(([, body]) => [body.values, body.revision])).toEqual([
      [{}, 1],
      [{ purpose: "later" }, 2],
    ]);
    expect(result.current).toBe("saved");
  });

  it("doesn't resend what is being saved when a change is undone meanwhile", async () => {
    let finish!: () => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => (finish = () => resolve(saved()))));
    const { result, rerender } = setup({ id: A, state: nda, messages: conversation });
    await settle();
    rerender({ id: A, state: { ...nda, values: { purpose: "x" } }, messages: conversation });
    rerender({ id: A, state: nda, messages: conversation });
    await act(async () => finish());
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current).toBe("saved");
  });

  it("can save what is waiting straight away, e.g. before signing out", async () => {
    setup({ id: A, state: nda, messages: conversation });
    await act(() => savePendingChanges());
    expect(puts()).toHaveLength(1);
    await settle();
    expect(puts()).toHaveLength(1);
  });

  it("says when saving failed, and tries again on the next change", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    const { result, rerender } = setup({ id: A, state: nda, messages: conversation });
    await settle();
    expect(result.current).toBe("error");
    rerender({ id: A, state: { ...nda, values: { purpose: "x" } }, messages: conversation });
    await settle();
    expect(result.current).toBe("saved");
  });

  it("saves what is waiting when the user starts over, then starts the new agreement afresh", async () => {
    const { result, rerender } = setup({ id: A, state: nda, messages: conversation });
    rerender({ id: B, state: emptyState, messages: [GREETING] });
    expect(result.current).toBe("idle");
    await settle();
    expect(puts()).toEqual([[`/api/documents/${A}`, { ...nda, messages: conversation, revision: 1 }]]);

    rerender({ id: B, state: { ...nda, document: "csa" }, messages: [GREETING] });
    await settle();
    expect(puts()[1][0]).toBe(`/api/documents/${B}`);
    expect(puts()[1][1].revision).toBe(1);
  });

  it("saves what is waiting when the page is left", async () => {
    const { unmount } = setup({ id: A, state: nda, messages: conversation });
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(puts()).toHaveLength(1);
  });

  it("saves what is waiting when the tab is closed or reloaded", async () => {
    setup({ id: A, state: nda, messages: conversation });
    window.dispatchEvent(new Event("pagehide"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.keepalive).toBe(true);
    expect(puts()[0][1].revision).toBe(1);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
