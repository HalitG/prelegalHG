import { LogoMark } from "./Logo";

/** A neutral placeholder for while the session is still unknown, or while redirecting. */
export function Splash() {
  return (
    <div className="grid min-h-screen place-items-center">
      <LogoMark className="animate-pulse" />
      <span role="status" className="sr-only">
        Loading…
      </span>
    </div>
  );
}
