import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { sessionOptions, SessionData } from "@/lib/session";
import { getLobby, saveLobby } from "@/lib/lobbies";
import { pusherServer } from "@/lib/pusher-server";

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const { lobbyId, password } = await req.json();
    const lobby = await getLobby(lobbyId);

    if (!lobby) {
      return NextResponse.json({ error: "Lobby not found." }, { status: 404 });
    }
    if (lobby.status !== "waiting") {
      return NextResponse.json({ error: "This lobby is no longer available." }, { status: 400 });
    }
    if (lobby.players.length >= lobby.maxPlayers) {
      return NextResponse.json({ error: "Lobby is full." }, { status: 400 });
    }
    if (lobby.players.includes(session.username)) {
      // Already in lobby — just redirect them
      return NextResponse.json({ success: true, lobbyId });
    }
    if (lobby.passwordHash) {
      if (!password) {
        return NextResponse.json({ error: "This lobby requires a password." }, { status: 403 });
      }
      const valid = await bcrypt.compare(password, lobby.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "Incorrect password." }, { status: 403 });
      }
    }

    lobby.players.push(session.username);
    await saveLobby(lobby);
    // When lobby is full, initialize the game state
if (lobby.players.length === lobby.maxPlayers) {
  const { createInitialState } = await import("@/lib/game");
  const { saveGameState } = await import("@/lib/game-store");
  const gameState = createInitialState(
    lobby.id,
    { id: lobby.players[0], username: lobby.players[0] },
    { id: lobby.players[1], username: lobby.players[1] }
  );
  await saveGameState(lobby.id, gameState);
}

    await pusherServer.trigger(`lobby-${lobbyId}`, "player-joined", {
      players: lobby.players,
    });
    await pusherServer.trigger("lobbies", "lobby-updated", {
      id: lobby.id,
      players: lobby.players,
      status: lobby.status,
    });

    return NextResponse.json({ success: true, lobbyId });
  } catch (err) {
    console.error("[lobbies/join]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
