import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData, defaultGameData, User } from "@/lib/session";
import { getUserByUsername, createUser } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { username, password, confirmPassword } = await req.json();

    if (!username || !password || !confirmPassword) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }
    if (username.length < 3 || username.length > 20) {
      return NextResponse.json(
        { error: "Username must be between 3 and 20 characters." },
        { status: 400 }
      );
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return NextResponse.json(
        { error: "Username may only contain letters, numbers, and underscores." },
        { status: 400 }
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    const existing = await getUserByUsername(username);
    if (existing) {
      return NextResponse.json(
        { error: "That username is already taken." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const newUser: User = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      username,
      passwordHash,
      gameData: defaultGameData,
      createdAt: new Date().toISOString(),
    };
    await createUser(newUser);

    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    session.userId = newUser.id;
    session.username = newUser.username;
    session.isLoggedIn = true;
    await session.save();

    return NextResponse.json({ success: true, username: newUser.username }, { status: 201 });
  } catch (err) {
    console.error("[register]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
