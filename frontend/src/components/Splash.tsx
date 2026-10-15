import { LogoMark } from "./Logo";

/** A neutral placeholder for while the session is still unknown, or while redirecting. It covers the window. */
export function Splash() {
  return (
    <div className="fixed inset-0 grid place-items-center">
      <LogoMark className="animate-pulse" />
      <span role="status" className="sr-only">
        Loading…
      </span>
    </div>
  );
}
