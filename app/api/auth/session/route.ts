import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";

export async function GET() {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (session.isLoggedIn) {
    return NextResponse.json({ isLoggedIn: true, username: session.username });
  }
  return NextResponse.json({ isLoggedIn: false });
}
