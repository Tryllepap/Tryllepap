"use client";

/**
 * Custom sign-in page — replaces NextAuth's default UI.
 *
 * TODO: Add OAuth buttons (Google, Discord) when those providers are configured.
 */

import { signIn } from "next-auth/react";
import { useState, FormEvent } from "react";
import Link from "next/link";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn("email", {
        email,
        callbackUrl: "/welcome",
        redirect: false,
      });

      if (result?.error) {
        setError("Something went wrong. Please try again.");
      } else {
        window.location.href = "/auth/verify-request";
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <Link href="/" className="text-3xl font-bold">
            Card Game
          </Link>
          <p className="mt-2 text-sm text-neutral-400">
            Enter your email to receive a magic sign-in link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm placeholder-neutral-600 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Sending link…" : "Send magic link"}
          </button>
        </form>

        <p className="text-center text-xs text-neutral-600">
          No account needed — we'll create one automatically.
        </p>

        {/* TODO: OAuth provider buttons */}
      </div>
    </main>
  );
}
