/**
 * POST /api/username — save or update the current user's username.
 *
 * TODO: Add rate limiting to prevent username squatting.
 * TODO: Add profanity / reserved-word filtering before going public.
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { upsertUsername, isUsernameTaken } from "@/lib/db";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export async function POST(request: Request) {
  const session = await getServerSession();

  if (!session?.user || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;

  let body: { username?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const username = body.username?.trim();

  if (!username || !USERNAME_REGEX.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3–20 characters and contain only letters, numbers, or underscores." },
      { status: 422 }
    );
  }

  if (isUsernameTaken(username, userId)) {
    return NextResponse.json(
      { error: "That username is already taken." },
      { status: 409 }
    );
  }

  upsertUsername(userId, username);

  return NextResponse.json({ ok: true, username });
}
