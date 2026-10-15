import type { NdaFormData } from "./nda/types";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** The longest message the backend accepts (`ChatMessage` in backend/app/chat.py). */
export const MAX_MESSAGE_LENGTH = 4000;

export interface ChatResult {
  reply: string;
  /** The complete updated fields, which replace the current ones. */
  fields: NdaFormData;
}

/** The assistant's opening message. It is part of the page, so the chat starts without calling the API. */
export const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'll help you prepare a Mutual Non-Disclosure Agreement. I'll ask a few questions and fill in the " +
    "agreement as we go.\n\nTo start: which two companies are entering into the NDA, and who will sign for each?",
};

/** A chat request that failed. `message` is written for the user. */
export class ChatError extends Error {
  override name = "ChatError";
}

/** Sends the conversation so far, which must end with the user's message, and the current fields. */
export async function sendChat(
  messages: ChatMessage[],
  fields: NdaFormData,
  /** The user's local ISO date, so "today" means the same to the assistant as it does in the preview. */
  today: string,
  signal?: AbortSignal,
): Promise<ChatResult> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, fields, today }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ChatError("Couldn't reach the assistant. Check your connection and try again.");
  }
  if (response.status === 503) {
    throw new ChatError("The AI assistant isn't available: the server has no OpenAI API key set up.");
  }
  if (!response.ok) {
    throw new ChatError("The assistant couldn't answer. Please try again.");
  }
  return response.json();
}
