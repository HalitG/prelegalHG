import { useCallback, useEffect, useState } from "react";
import { SavedDocumentsError } from "./savedDocuments";

export type Loaded<T> =
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; error: SavedDocumentsError };

/**
 * Loads `load(key)` when the component mounts and whenever `key` changes, and again on `retry`. A result that
 * arrives after `key` has changed is dropped. `load` should be a module-level function, so it never changes.
 */
export function useLoaded<K, T>(key: K, load: (key: K) => Promise<T>) {
  const [loaded, setLoaded] = useState<Loaded<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    load(key).then(
      (data) => current && setLoaded({ status: "ready", data }),
      (error: unknown) =>
        current &&
        setLoaded({
          status: "error",
          error: error instanceof SavedDocumentsError ? error : new SavedDocumentsError(String(error), 0),
        }),
    );
    return () => {
      current = false;
    };
  }, [key, load, attempt]);

  const retry = useCallback(() => {
    setLoaded({ status: "loading" });
    setAttempt((count) => count + 1);
  }, []);

  /** Changes the loaded data, e.g. to remove a deleted item straight away. */
  const update = useCallback(
    (change: (data: T) => T) => setLoaded((now) => (now.status === "ready" ? { status: "ready", data: change(now.data) } : now)),
    [],
  );

  return { loaded, retry, update };
}
