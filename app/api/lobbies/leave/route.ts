import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";
import { getLobby, saveLobby, deleteLobby } from "@/lib/lobbies";
import { pusherServer } from "@/lib/pusher-server";

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const { lobbyId } = await req.json();
    const lobby = await getLobby(lobbyId);
    if (!lobby) return NextResponse.json({ success: true });

    lobby.players = lobby.players.filter(p => p !== session.username);

    if (lobby.players.length === 0 || lobby.hostUsername === session.username) {
      await deleteLobby(lobbyId);
      await pusherServer.trigger("lobbies", "lobby-deleted", { id: lobbyId });
      await pusherServer.trigger(`lobby-${lobbyId}`, "lobby-closed", {});
    } else {
      // Pass host to next player if host leaves
      if (lobby.hostUsername === session.username) {
        lobby.hostUsername = lobby.players[0];
      }
      await saveLobby(lobby);
      await pusherServer.trigger(`lobby-${lobbyId}`, "player-left", {
        players: lobby.players,
        newHost: lobby.hostUsername,
      });
      await pusherServer.trigger("lobbies", "lobby-updated", {
        id: lobby.id,
        players: lobby.players,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[lobbies/leave]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
