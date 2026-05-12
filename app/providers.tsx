"use client";

/**
 * Client-side providers wrapper.
 * SessionProvider makes useSession() available to all child components.
 *
 * TODO: Add other providers here as needed (e.g. theme, toast notifications).
 */

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
