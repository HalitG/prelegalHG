import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatError, GREETING, sendChat, type ChatMessage } from "./chat";
import { defaultFormData } from "./nda/types";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

afterEach(() => fetchMock.mockReset());

const messages: ChatMessage[] = [GREETING, { role: "user", content: "Acme and Globex" }];
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("sendChat", () => {
  it("posts the conversation, the fields and today's date to the API", async () => {
    fetchMock.mockResolvedValue(json({ reply: "Thanks!", fields: defaultFormData }));
    await sendChat(messages, defaultFormData, "2026-10-15");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/chat");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init?.body as string)).toEqual({ messages, fields: defaultFormData, today: "2026-10-15" });
  });

  it("returns the reply and the updated fields", async () => {
    const fields = { ...defaultFormData, governingLaw: "Delaware" };
    fetchMock.mockResolvedValue(json({ reply: "Delaware it is.", fields }));
    await expect(sendChat(messages, defaultFormData, "2026-10-15")).resolves.toEqual({
      reply: "Delaware it is.",
      fields,
    });
  });

  it("explains when the server has no OpenAI API key", async () => {
    fetchMock.mockResolvedValue(json({ detail: "not configured" }, 503));
    await expect(sendChat(messages, defaultFormData, "2026-10-15")).rejects.toThrow(
      new ChatError("The AI assistant isn't available: the server has no OpenAI API key set up."),
    );
  });

  it.each([400, 422, 500, 502])("asks the user to try again after a %i", async (status) => {
    fetchMock.mockResolvedValue(json({ detail: "x" }, status));
    await expect(sendChat(messages, defaultFormData, "2026-10-15")).rejects.toThrow(
      new ChatError("The assistant couldn't answer. Please try again."),
    );
  });

  it("explains when the server can't be reached", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(sendChat(messages, defaultFormData, "2026-10-15")).rejects.toThrow(
      new ChatError("Couldn't reach the assistant. Check your connection and try again."),
    );
  });

  it("lets a cancelled request fail as a cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = new DOMException("Aborted", "AbortError");
    fetchMock.mockRejectedValue(abortError);
    await expect(sendChat(messages, defaultFormData, "2026-10-15", controller.signal)).rejects.toBe(abortError);
    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });
});
