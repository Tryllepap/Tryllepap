import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";
import { getGameState, saveGameState } from "@/lib/game-store";
import { getLobby } from "@/lib/lobbies";
import { createInitialState } from "@/lib/game";

export async function GET(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const lobbyId = searchParams.get("lobbyId");
    if (!lobbyId) return NextResponse.json({ error: "Missing lobbyId." }, { status: 400 });

    let state = await getGameState(lobbyId);

    // Create initial state if not yet created
    if (!state) {
      const lobby = await getLobby(lobbyId);
      if (!lobby || lobby.players.length < 2) {
        return NextResponse.json({ error: "Lobby not ready." }, { status: 400 });
      }
      state = createInitialState(
        lobbyId,
        { id: lobby.players[0], username: lobby.players[0] },
        { id: lobby.players[1], username: lobby.players[1] }
      );
      await saveGameState(lobbyId, state);
    }

    return NextResponse.json(state);
  } catch (err) {
    console.error("[game/state]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
