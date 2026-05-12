"use client";

/**
 * Handles the username-submission form on /welcome.
 * On success, refreshes the page so the server component re-reads the DB.
 *
 * TODO: Add an avatar-picker step after username is set.
 * TODO: Debounce a username-availability check as the user types.
 */

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export function UsernameForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return;
      }

      setSuccess(data.username);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-6 py-5 text-center space-y-2">
        <p className="text-lg font-semibold">Welcome, {success}!</p>
        <p className="text-sm text-neutral-400">More features coming soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="username" className="block text-sm font-medium mb-1 text-left">
          Username
        </label>
        <input
          id="username"
          type="text"
          required
          minLength={3}
          maxLength={20}
          pattern="[a-zA-Z0-9_]+"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. card_shark_42"
          className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2.5 text-sm placeholder-neutral-600 focus:border-neutral-500 focus:outline-none focus:ring-1 focus:ring-neutral-500"
        />
        <p className="mt-1 text-xs text-neutral-600">
          3–20 characters. Letters, numbers, and underscores only.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-400 text-left" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-white py-2.5 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Saving…" : "Set username"}
      </button>
    </form>
  );
}
