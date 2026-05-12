/**
 * Landing page (/)
 *
 * Public page. Shows the site title, description, and a sign-in button.
 * If the user is already signed in, redirect them to /welcome.
 *
 * TODO: Add game screenshots / feature highlights when content is ready.
 * TODO: Add a leaderboard preview or "coming soon" teaser section.
 */

import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const session = await getServerSession();

  if (session) {
    redirect("/welcome");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="max-w-lg space-y-6">
        <div className="flex justify-center gap-4 text-4xl select-none" aria-hidden>
          <span>♠</span>
          <span className="text-red-500">♥</span>
          <span className="text-red-500">♦</span>
          <span>♣</span>
        </div>

        <h1 className="text-5xl font-bold tracking-tight">Card Game</h1>

        <p className="text-lg text-neutral-400 leading-relaxed">
          A multiplayer card game for friends. Collect, trade, and battle with
          unique cards — all in your browser. Early access coming soon.
        </p>

        <Link
          href="/auth/signin"
          className="inline-block rounded-lg bg-white px-8 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Sign in with email
        </Link>

        <p className="text-xs text-neutral-600">
          No password required — we'll email you a magic link.
        </p>
      </div>

      {/* TODO: Add a "How it works" section below the fold */}
      {/* TODO: Add social links / Discord invite */}
    </main>
  );
}
