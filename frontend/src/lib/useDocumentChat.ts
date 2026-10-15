import { useEffect, useRef, useState } from "react";
import { assistantMessage, ChatError, GREETING, sendChat, type ChatMessage } from "./chat";
import { emptyState, type DocState } from "./documents/types";

export type ChatStatus = "idle" | "sending" | "error";

export interface DocumentChat {
  messages: ChatMessage[];
  status: ChatStatus;
  /** Why the last message failed, written for the user. Set while `status` is "error". */
  error: string | null;
  /** Sends a message. Returns false, and sends nothing, if it is blank or a reply is still on its way. */
  send: (text: string) => boolean;
  /** Sends the conversation again after a failure. */
  retry: () => void;
  /** Starts a new conversation, with no agreement chosen. */
  reset: () => void;
}

/**
 * The conversation with the AI assistant. Each reply comes with the agreement as the assistant left it, which is
 * passed to `onState`. Nothing is stored: a page load starts a new conversation.
 */
export function useDocumentChat(state: DocState, onState: (state: DocState) => void, today: string): DocumentChat {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  async function request(history: ChatMessage[]) {
    const controller = new AbortController();
    pending.current = controller;
    setStatus("sending");
    setError(null);
    try {
      const result = await sendChat(history, state, today, controller.signal);
      // Starting over, or leaving the page, cancels the request: its reply no longer belongs to the conversation.
      if (controller.signal.aborted) return;
      setMessages([...history, assistantMessage(result)]);
      onState({ document: result.document, values: result.values, parties: result.parties });
      setStatus("idle");
    } catch (caught) {
      if (controller.signal.aborted) return;
      setError(caught instanceof ChatError ? caught.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  function send(text: string) {
    const content = text.trim();
    if (!content || status === "sending") return false;
    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(history);
    void request(history);
    return true;
  }

  function retry() {
    if (status === "error") void request(messages);
  }

  function reset() {
    pending.current?.abort();
    setMessages([GREETING]);
    setStatus("idle");
    setError(null);
    onState(emptyState);
  }

  return { messages, status, error, send, retry, reset };
}
