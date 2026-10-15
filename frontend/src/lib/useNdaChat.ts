import { useEffect, useRef, useState } from "react";
import { ChatError, GREETING, sendChat, type ChatMessage } from "./chat";
import { defaultFormData, type NdaFormData } from "./nda/types";

export type ChatStatus = "idle" | "sending" | "error";

export interface NdaChat {
  messages: ChatMessage[];
  status: ChatStatus;
  /** Why the last message failed, written for the user. Set while `status` is "error". */
  error: string | null;
  /** Sends a message. Returns false, and sends nothing, if it is blank or a reply is still on its way. */
  send: (text: string) => boolean;
  /** Sends the conversation again after a failure. */
  retry: () => void;
  /** Starts a new conversation and a blank agreement. */
  reset: () => void;
}

/**
 * The conversation with the AI assistant. Each reply comes with the complete updated fields, which are passed to
 * `onFields`. Nothing is stored: a page load starts a new conversation.
 */
export function useNdaChat(form: NdaFormData, onFields: (form: NdaFormData) => void, today: string): NdaChat {
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
      const result = await sendChat(history, form, today, controller.signal);
      // Starting over, or leaving the page, cancels the request: its reply no longer belongs to the conversation.
      if (controller.signal.aborted) return;
      setMessages([...history, { role: "assistant", content: result.reply }]);
      onFields(result.fields);
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
    onFields(defaultFormData);
  }

  return { messages, status, error, send, retry, reset };
}
