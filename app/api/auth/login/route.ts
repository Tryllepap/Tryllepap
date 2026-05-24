import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";
import { getUserByUsername } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
    }

    const user = await getUserByUsername(username);
    if (!user) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    session.userId = user.id;
    session.username = user.username;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({ success: true, username: user.username });
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
