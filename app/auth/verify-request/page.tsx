/**
 * Shown after the magic-link email has been dispatched.
 */

import Link from "next/link";

export default function VerifyRequestPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="max-w-sm space-y-6">
        <div className="text-5xl" aria-hidden>✉️</div>
        <h1 className="text-2xl font-bold">Check your email</h1>
        <p className="text-neutral-400 text-sm leading-relaxed">
          We've sent a sign-in link to your email address. Click the link in
          the email to continue — it expires in 24 hours.
        </p>
        <p className="text-neutral-600 text-xs">
          Didn't get it? Check your spam folder, or{" "}
          <Link href="/auth/signin" className="underline hover:text-neutral-300">
            try again
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
