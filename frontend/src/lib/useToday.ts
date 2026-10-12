import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

function localIsoDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Today's date in the viewer's timezone (yyyy-mm-dd). Returns "" while
 * prerendering, so the static HTML never bakes in the build date and
 * hydration doesn't mismatch.
 */
export function useToday(): string {
  return useSyncExternalStore(subscribe, localIsoDate, () => "");
}
