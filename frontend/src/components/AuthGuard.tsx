"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useSession } from "@/lib/session";
import { Splash } from "./Splash";

/**
 * Shows its children to signed-in visitors only and sends everyone else to the sign-in page. Until the session
 * is known (the static HTML and hydration) it shows a placeholder, so signed-out visitors never see the platform.
 */
export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === "signed-out") router.replace("/login/");
  }, [status, router]);

  return status === "signed-in" ? children : <Splash />;
}
