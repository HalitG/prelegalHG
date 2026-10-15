import { useEffect, useState } from "react";
import type { DocumentText } from "./types";

const cache = new Map<string, Promise<DocumentText>>();

/** Fetches an agreement's text, written to public/documents/ at build time. Each agreement is fetched once. */
export function fetchDocumentText(id: string): Promise<DocumentText> {
  let text = cache.get(id);
  if (!text) {
    text = fetch(`/documents/${id}.json`).then((response) => {
      if (!response.ok) throw new Error(`Couldn't load ${id}: ${response.status}`);
      return response.json() as Promise<DocumentText>;
    });
    // A failed fetch is forgotten, so the next attempt tries again.
    text.catch(() => cache.delete(id));
    cache.set(id, text);
  }
  return text;
}

export type DocumentTextState =
  | { status: "loading"; text: null }
  | { status: "ready"; text: DocumentText }
  | { status: "error"; text: null; retry: () => void };

/** The text of the agreement with this id, or null while none is chosen. */
export function useDocumentText(id: string | null): DocumentTextState | null {
  // `text` is null when the fetch failed.
  const [loaded, setLoaded] = useState<{ id: string; text: DocumentText | null } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let current = true;
    fetchDocumentText(id).then(
      (text) => current && setLoaded({ id, text }),
      () => current && setLoaded({ id, text: null }),
    );
    return () => {
      current = false;
    };
  }, [id, attempt]);

  if (!id) return null;
  if (loaded?.id !== id) return { status: "loading", text: null };
  if (loaded.text) return { status: "ready", text: loaded.text };
  return {
    status: "error",
    text: null,
    retry: () => {
      setLoaded(null);
      setAttempt((n) => n + 1);
    },
  };
}
