"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { MAX_MESSAGE_LENGTH, type ChatMessage } from "@/lib/chat";
import type { DocumentChat as DocumentChatState } from "@/lib/useDocumentChat";
import { Button } from "./Button";
import { inputClass } from "./form-controls";

function MessageBubble({ message }: { message: ChatMessage }) {
  const fromUser = message.role === "user";
  return (
    <div className={`flex ${fromUser ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-line ${
          fromUser ? "rounded-br-sm bg-primary text-white" : "rounded-bl-sm bg-slate-100 text-slate-800"
        }`}
      >
        <span className="sr-only">{fromUser ? "You: " : "Assistant: "}</span>
        {message.content}
      </p>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start" role="status">
      <span className="sr-only">Assistant is typing</span>
      <span className="flex gap-1 rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-3.5" aria-hidden="true">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 animate-bounce rounded-full bg-slate-400 motion-reduce:animate-none"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
    </div>
  );
}

/** Whether the user is typing in another field, such as one in the "Edit the fields yourself" panel. */
function typingElsewhere(input: HTMLTextAreaElement | null) {
  const active = document.activeElement;
  return active instanceof HTMLElement && active !== input && active.matches("input, textarea, select, [contenteditable]");
}

/** The conversation with the AI assistant that chooses and fills in the agreement. */
export function DocumentChat({ messages, status, error, send, retry, reset }: DocumentChatState) {
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  const sending = status === "sending";
  const wasSending = useRef(false);

  // Keep the latest message in view.
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, status]);

  // When the answer arrives, put the cursor back in the message box so the user can reply straight away, unless
  // they have moved on to another field meanwhile.
  useEffect(() => {
    if (wasSending.current && !sending && !typingElsewhere(input.current)) input.current?.focus();
    wasSending.current = sending;
  }, [sending]);

  function submit() {
    if (send(draft)) setDraft("");
    input.current?.focus();
  }

  // Retry and Start over disappear once clicked, which would leave the focus nowhere.
  function retryAndFocus() {
    retry();
    input.current?.focus();
  }

  function resetAndFocus() {
    reset();
    input.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter starts a new line. Leave Enter alone while an input method is composing text.
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <section
      aria-label="Chat with the AI assistant"
      className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200"
    >
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-3">
        <div>
          <h2 className="text-base font-semibold">AI assistant</h2>
          <p className="text-xs text-muted">It picks the agreement and fills it in as you chat.</p>
        </div>
        {messages.length > 1 && (
          <Button variant="outline" onClick={resetAndFocus} className="px-3 py-1.5 text-xs">
            Start over
          </Button>
        )}
      </div>

      <div
        ref={log}
        role="log"
        aria-label="Conversation"
        aria-live="polite"
        className="h-80 space-y-3 overflow-y-auto px-5 py-4 lg:h-[calc(100vh-24rem)] lg:min-h-80"
      >
        {messages.map((message, i) => (
          <MessageBubble key={i} message={message} />
        ))}
        {sending && <TypingIndicator />}
      </div>

      {status === "error" && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-t border-red-100 bg-red-50 px-5 py-2.5 text-sm text-red-700"
        >
          <span>{error}</span>
          <Button variant="outline" onClick={retryAndFocus} className="px-3 py-1 text-xs">
            Retry
          </Button>
        </div>
      )}

      <form
        aria-label="Send a message"
        className="flex items-end gap-2 border-t border-slate-200 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <label htmlFor={inputId} className="sr-only">
          Message
        </label>
        <textarea
          ref={input}
          id={inputId}
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type your answer…"
          maxLength={MAX_MESSAGE_LENGTH}
          className={`${inputClass} max-h-40 min-h-11 w-full resize-y`}
        />
        <Button type="submit" variant="secondary" disabled={sending || !draft.trim()}>
          Send
        </Button>
      </form>
    </section>
  );
}
