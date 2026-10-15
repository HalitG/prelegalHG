import { apiFetch } from "./api";
import type { DocState } from "./documents/types";
import { jsonRequest } from "./http";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** The longest message the backend accepts (`ChatMessage` in backend/app/chat.py). */
export const MAX_MESSAGE_LENGTH = 4000;

export interface ChatResult extends DocState {
  reply: string;
  /** The assistant's next question. "" only once the agreement is complete. */
  nextQuestion: string;
}

/** The assistant's opening message. It is part of the page, so the chat starts without calling the API. */
export const GREETING: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'll help you prepare a legal agreement, such as an NDA, a cloud service or software license agreement, " +
    "a pilot, partnership or professional services agreement, or a data processing agreement. I'll ask a few " +
    "questions and fill in the agreement as we go.\n\nTo start: what kind of agreement do you need?",
};

/** The reply and the next question, as one message: the conversation the assistant sees is what the user saw. */
export function assistantMessage({ reply, nextQuestion }: ChatResult): ChatMessage {
  return { role: "assistant", content: [reply, nextQuestion].filter(Boolean).join("\n\n") };
}

/** A chat request that failed. `message` is written for the user. */
export class ChatError extends Error {
  override name = "ChatError";
}

/** Sends the conversation so far, which must end with the user's message, and the agreement as it stands. */
export async function sendChat(
  messages: ChatMessage[],
  state: DocState,
  /** The user's local ISO date, so "today" means the same to the assistant as it does to the user. */
  today: string,
  signal?: AbortSignal,
): Promise<ChatResult> {
  let response: Response;
  try {
    response = await apiFetch("/api/chat", { ...jsonRequest("POST", { messages, ...state, today }), signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ChatError("Couldn't reach the assistant. Check your connection and try again.");
  }
  if (response.status === 401) {
    // The page is already on its way back to the sign-in screen.
    throw new ChatError("Your sign-in has ended. Please sign in again.");
  }
  if (response.status === 503) {
    throw new ChatError("The AI assistant isn't available: the server has no OpenAI API key set up.");
  }
  if (!response.ok) {
    throw new ChatError("The assistant couldn't answer. Please try again.");
  }
  return response.json();
}
