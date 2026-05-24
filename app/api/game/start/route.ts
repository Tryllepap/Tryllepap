import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";
import { getLobby, saveLobby } from "@/lib/lobbies";
import { saveGameState } from "@/lib/game-store";
import { createInitialState } from "@/lib/game";
import { pusherServer } from "@/lib/pusher-server";

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const { lobbyId } = await req.json();
    const lobby = await getLobby(lobbyId);

    if (!lobby) {
      return NextResponse.json({ error: "Lobby not found." }, { status: 404 });
    }
    if (lobby.hostUsername !== session.username) {
      return NextResponse.json({ error: "Only the host can start the game." }, { status: 403 });
    }
    if (lobby.players.length < 2) {
      return NextResponse.json({ error: "Need 2 players to start." }, { status: 400 });
    }

    // Initialize game state
    const gameState = createInitialState(
      lobbyId,
      { id: lobby.players[0], username: lobby.players[0] },
      { id: lobby.players[1], username: lobby.players[1] }
    );
    await saveGameState(lobbyId, gameState);

    // Mark lobby as in-game
    lobby.status = "ingame";
    await saveLobby(lobby);

    // Tell both players to navigate to the game
    await pusherServer.trigger(`lobby-${lobbyId}`, "game-started", {
      gameId: lobbyId,
    });
    await pusherServer.trigger("lobbies", "lobby-updated", {
      id: lobby.id,
      status: "ingame",
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[game/start]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
