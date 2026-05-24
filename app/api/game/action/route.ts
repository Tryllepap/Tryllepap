import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, SessionData } from "@/lib/session";
import { getGameState, saveGameState } from "@/lib/game-store";
import { pusherServer } from "@/lib/pusher-server";
import {
  submitRpsChoice,
  acknowledgeRps,
  playSpellCard,
  placeDualist,
  passAction,
  startNextRound,
  RpsChoice,
} from "@/lib/game";

export async function POST(req: NextRequest) {
  try {
    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    if (!session.isLoggedIn) {
      return NextResponse.json({ error: "Not logged in." }, { status: 401 });
    }

    const { lobbyId, action, payload } = await req.json();
    if (!lobbyId || !action) {
      return NextResponse.json({ error: "Missing lobbyId or action." }, { status: 400 });
    }

    let state = await getGameState(lobbyId);
    if (!state) {
      return NextResponse.json({ error: "Game not found." }, { status: 404 });
    }

    const playerId = session.username;

    switch (action) {
      case "rps":
        state = submitRpsChoice(state, playerId, payload.choice as RpsChoice);
        break;
      case "acknowledge_rps":
        state = acknowledgeRps(state);
        break;
      case "play_spell":
        state = playSpellCard(state, playerId, payload.cardId);
        break;
      case "place_dualist":
        state = placeDualist(state, playerId, payload.cardId);
        break;
      case "pass":
        state = passAction(state, playerId);
        break;
      case "next_round":
        state = startNextRound(state);
        break;
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    await saveGameState(lobbyId, state);
    await pusherServer.trigger(`game-${lobbyId}`, "state-update", state);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[game/action]", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
