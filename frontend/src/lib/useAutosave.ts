import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "./chat";
import type { DocState } from "./documents/types";
import { saveDocument } from "./savedDocuments";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** How long to wait after the last change before saving. */
export const SAVE_DELAY = 800;

interface Draft {
  id: string;
  state: DocState;
  messages: ChatMessage[];
  /** What is saved, to tell whether anything has changed since. */
  key: string;
}

const keyOf = (id: string, state: DocState, messages: ChatMessage[]) => JSON.stringify([id, state, messages]);

/** Each mounted autosave's "save what is waiting now", for savePendingChanges. */
const savers = new Set<() => Promise<void>>();

/** Saves every change still waiting for its moment, e.g. before signing out. */
export async function savePendingChanges(): Promise<void> {
  await Promise.all(Array.from(savers, (save) => save()));
}

/**
 * Saves the agreement and its conversation as `id`, a moment after they last changed, once an agreement has been
 * chosen. Nothing is saved while `paused` (a chat reply is on its way, or failed), so a saved agreement always
 * matches a finished conversation. Saves go out one at a time, in order, each with the next revision so the server
 * can ignore one that arrives late. A change of `id` (starting over), moving to another page, or closing the tab
 * first saves what is waiting.
 *
 * `savedRevision` is set when the agreement was opened from the server at that revision: it isn't saved again
 * until it changes.
 */
export function useAutosave(
  id: string,
  state: DocState,
  messages: ChatMessage[],
  { paused, savedRevision }: { paused: boolean; savedRevision?: number },
): SaveStatus {
  const opened = savedRevision !== undefined;
  // The status belongs to an id, so a new agreement doesn't show the previous one's.
  const [saved, setSaved] = useState({ id, status: (opened ? "saved" : "idle") as SaveStatus });
  const [openedKey] = useState(() => (opened ? keyOf(id, state, messages) : null));
  /** The newest version sent, or being sent: there is no need to send it again. */
  const sent = useRef(openedKey);
  const pending = useRef<Draft | null>(null);
  const revision = useRef({ id, count: savedRevision ?? 0 });
  const queue = useRef<Promise<void>>(Promise.resolve());

  /** Takes the waiting draft, with the next revision for its agreement. */
  const take = useCallback(() => {
    const draft = pending.current;
    if (!draft) return null;
    pending.current = null;
    sent.current = draft.key;
    if (revision.current.id !== draft.id) revision.current = { id: draft.id, count: 0 };
    return { ...draft, revision: ++revision.current.count };
  }, []);

  const flush = useCallback(() => {
    const draft = take();
    if (draft) {
      setSaved({ id: draft.id, status: "saving" });
      queue.current = queue.current.then(async () => {
        try {
          await saveDocument(draft.id, draft.state, draft.messages, draft.revision);
          if (!pending.current) setSaved({ id: draft.id, status: "saved" });
        } catch {
          // Send it again with the next change, even if that change undoes this one.
          if (sent.current === draft.key) sent.current = null;
          setSaved({ id: draft.id, status: "error" });
        }
      });
    }
    return queue.current;
  }, [take]);

  useEffect(() => {
    if (!state.document || paused) return;
    const key = keyOf(id, state, messages);
    if (key === sent.current) {
      // Changed back to what was sent: nothing to do, not even an earlier change that was waiting.
      pending.current = null;
      return;
    }
    pending.current = { id, state, messages, key };
    const timer = setTimeout(flush, SAVE_DELAY);
    return () => clearTimeout(timer);
  }, [id, state, messages, paused, flush]);

  // Runs when the id changes and when the page leaves: save the previous agreement's last changes.
  useEffect(() => () => void flush(), [id, flush]);

  useEffect(() => {
    savers.add(flush);
    return () => {
      savers.delete(flush);
    };
  }, [flush]);

  // Closing or reloading the tab within the moment before a save: send it anyway, as a request the browser
  // finishes after the page has gone. Browsers cap those at 64 KB, so a very long conversation may not make it.
  useEffect(() => {
    function leave() {
      const draft = take();
      if (draft) saveDocument(draft.id, draft.state, draft.messages, draft.revision, { keepalive: true }).catch(() => {});
    }
    window.addEventListener("pagehide", leave);
    return () => window.removeEventListener("pagehide", leave);
  }, [take]);

  return saved.id === id ? saved.status : "idle";
}
