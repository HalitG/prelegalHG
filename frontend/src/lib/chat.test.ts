import { afterEach, describe, expect, it, vi } from "vitest";
import { assistantMessage, ChatError, GREETING, sendChat, type ChatMessage, type ChatResult } from "./chat";
import { emptyState, type DocState } from "./documents/types";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => fetchMock.mockReset());

const messages: ChatMessage[] = [GREETING, { role: "user", content: "An NDA with Globex" }];
const state: DocState = { ...emptyState, document: "mutual-nda", values: { governingLaw: "Delaware" } };
const result: ChatResult = { reply: "Thanks!", nextQuestion: "Who signs?", ...state };
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("sendChat", () => {
  it("posts the conversation, the agreement and today's date to the API", async () => {
    fetchMock.mockResolvedValue(json(result));
    await sendChat(messages, state, "2026-10-15");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/chat");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual({
      messages,
      document: "mutual-nda",
      values: { governingLaw: "Delaware" },
      parties: emptyState.parties,
      today: "2026-10-15",
    });
  });

  it("returns the reply, the next question and the updated agreement", async () => {
    fetchMock.mockResolvedValue(json(result));
    await expect(sendChat(messages, emptyState, "2026-10-15")).resolves.toEqual(result);
  });

  it("explains when the sign-in has ended", async () => {
    fetchMock.mockResolvedValue(json({ detail: "Please sign in." }, 401));
    await expect(sendChat(messages, state, "2026-10-15")).rejects.toThrow(
      new ChatError("Your sign-in has ended. Please sign in again."),
    );
  });

  it("explains when the server has no OpenAI API key", async () => {
    fetchMock.mockResolvedValue(json({ detail: "not configured" }, 503));
    await expect(sendChat(messages, state, "2026-10-15")).rejects.toThrow(
      new ChatError("The AI assistant isn't available: the server has no OpenAI API key set up."),
    );
  });

  it.each([400, 422, 500, 502])("asks the user to try again after a %i", async (status) => {
    fetchMock.mockResolvedValue(json({ detail: "x" }, status));
    await expect(sendChat(messages, state, "2026-10-15")).rejects.toThrow(
      new ChatError("The assistant couldn't answer. Please try again."),
    );
  });

  it("explains when the server can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(sendChat(messages, state, "2026-10-15")).rejects.toThrow(
      new ChatError("Couldn't reach the assistant. Check your connection and try again."),
    );
  });

  it("lets a cancelled request fail as a cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = new DOMException("Aborted", "AbortError");
    fetchMock.mockRejectedValue(abortError);
    await expect(sendChat(messages, state, "2026-10-15", controller.signal)).rejects.toBe(abortError);
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });
});

describe("assistantMessage", () => {
  it("shows the reply and then the next question", () => {
    expect(assistantMessage(result)).toEqual({ role: "assistant", content: "Thanks!\n\nWho signs?" });
  });

  it("is just the reply once there is nothing left to ask", () => {
    expect(assistantMessage({ ...result, nextQuestion: "" }).content).toBe("Thanks!");
  });
});
