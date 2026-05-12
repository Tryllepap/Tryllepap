/**
 * Protected welcome page (/welcome)
 *
 * Server component: reads session + user profile from DB, then renders either:
 *   a) A username-selection form  (first visit)
 *   b) A personalised greeting    (returning user)
 *
 * TODO: Add onboarding steps (choose avatar, tutorial) after username is set.
 * TODO: Link to the game lobby / dashboard once those exist.
 */

import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/db";
import { UsernameForm } from "./username-form";

export default async function WelcomePage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect("/");
  }

  const userId = (session.user as any).id as string;
  const profile = getUserProfile(userId);
  const username = profile?.username ?? null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        {username ? (
          <>
            <div className="text-5xl select-none" aria-hidden>♠ ♥ ♦ ♣</div>
            <h1 className="text-3xl font-bold">Welcome back, {username}!</h1>
            <p className="text-neutral-400 text-sm">
              More features are on the way. Stay tuned.
            </p>
            {/* TODO: Replace with a link to the game lobby */}
            <p className="text-neutral-600 text-xs">
              Signed in as {session.user.email}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold">Almost there!</h1>
            <p className="text-neutral-400 text-sm">
              Choose a username to get started. You can change it later.
            </p>
            <UsernameForm />
          </>
        )}
      </div>
    </main>
  );
}
