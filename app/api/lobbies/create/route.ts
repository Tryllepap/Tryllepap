import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { sessionOptions, SessionData } from "@/lib/session";
import { saveLobby, Lobby } from "@/lib/lobbies";
import { pusherServer } from "@/lib/pusher";

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const { name, password } = await req.json();

    if (!name || name.trim().length < 2) {
      return NextResponse.json({ error: "Lobby name must be at least 2 characters." }, { status: 400 });
    }
    if (name.trim().length > 30) {
      return NextResponse.json({ error: "Lobby name must be under 30 characters." }, { status: 400 });
    }

    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const lobby: Lobby = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: name.trim(),
      hostUsername: session.username,
      passwordHash,
      players: [session.username],
      maxPlayers: 2,
      status: "waiting",
      createdAt: new Date().toISOString(),
    };

    await saveLobby(lobby);

    // Notify all clients a new lobby was created
    await pusherServer.trigger("lobbies", "lobby-created", {
      id: lobby.id,
      name: lobby.name,
      hostUsername: lobby.hostUsername,
      players: lobby.players,
      maxPlayers: lobby.maxPlayers,
      status: lobby.status,
      hasPassword: passwordHash !== null,
      createdAt: lobby.createdAt,
    });

    return NextResponse.json({ success: true, lobbyId: lobby.id });
  } catch (err) {
    console.error("[lobbies/create]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
