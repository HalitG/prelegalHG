import type { ReactNode } from "react";
import { AppHeader } from "@/components/AppHeader";
import { AuthGuard } from "@/components/AuthGuard";

/** Pages in this route group make up the signed-in platform. */
export default function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <AppHeader />
      {children}
    </AuthGuard>
  );
}
