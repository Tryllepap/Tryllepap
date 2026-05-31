import { MAX_HAND_SIZE } from "./rules";
import { buildDeck } from "./cards";

export type RpsChoice = "rock" | "paper" | "scissors";
export type GamePhase =
  | "rps"
  | "rps_reveal"
  | "playing"
  | "resolution"
  | "round_result"
  | "game_over";

export interface BoardSpell {
  instanceId: string;
  cardId: string;
  x: number;
  y: number;
}

export interface PlayerState {
  id: string;
  username: string;
  hand: string[];
  deck: string[];
  discard: string[];
  dualist: string | null;
  dualistPower: number;
  roundsWon: number;
  hasPassed: boolean;
  rpsChoice: RpsChoice | null;
  spellsPlayed: string[];
  spellsOnBoard: BoardSpell[];
  pendingLibraryToCellar: boolean; // true = player must choose how many cards to send to cellar
}

export interface GameState {
  id: string;
  players: PlayerState[];
  phase: GamePhase;
  activePlayerId: string;
  roundNumber: number;
  eventLog: string[];
  matchWinner: string | null;
  lastRoundWinner: string | "draw" | null;
  rpsResult?: "draw" | string;
  rpsWinnerId?: string;
  previousFirstPlayerId?: string;
}

export function createInitialState(
  gameId: string,
  player1: { id: string; username: string },
  player2: { id: string; username: string }
): GameState {
const makePlayer = (p: { id: string; username: string }): PlayerState => ({
  id: p.id,
  username: p.username,
  hand: [],
  deck: buildDeck(3),
  discard: [],
  dualist: null,
  dualistPower: 0,
  roundsWon: 0,
  hasPassed: false,
  rpsChoice: null,
  spellsPlayed: [],
  spellsOnBoard: [],
  pendingLibraryToCellar: false,
});

  return {
    id: gameId,
    players: [makePlayer(player1), makePlayer(player2)],
    phase: "rps",
    activePlayerId: player1.id,
    roundNumber: 1,
    eventLog: ["Match started — play Rock, Paper, or Scissors to decide who goes first."],
    matchWinner: null,
    lastRoundWinner: null,
    previousFirstPlayerId: undefined,
  };
}

export function getPlayer(state: GameState, playerId: string): PlayerState {
  return state.players.find(p => p.id === playerId)!;
}

export function updatePlayer(
  state: GameState,
  playerId: string,
  updater: (p: PlayerState) => PlayerState
): GameState {
  return {
    ...state,
    players: state.players.map(p => p.id === playerId ? updater(p) : p),
  };
}

export function addLog(state: GameState, message: string): GameState {
  return { ...state, eventLog: [...state.eventLog, message] };
}

export function drawCards(state: GameState, playerId: string, n: number): GameState {
  return updatePlayer(state, playerId, player => {
    let deck = [...player.deck];
    let hand = [...player.hand];
    let discard = [...player.discard];
    for (let i = 0; i < n; i++) {
      if (hand.length >= MAX_HAND_SIZE) break;
      if (deck.length === 0) {
        if (discard.length === 0) break;
        deck = [...discard].sort(() => Math.random() - 0.5);
        discard = [];
      }
      hand.push(deck.shift()!);
    }
    return { ...player, hand, deck, discard };
  });
}

export function discardCards(state: GameState, playerId: string, n: number): GameState {
  return updatePlayer(state, playerId, player => {
    if (player.hand.length === 0) return player;
    const hand = [...player.hand];
    const discard = [...player.discard];
    const count = Math.min(n, hand.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * hand.length);
      discard.push(...hand.splice(idx, 1));
    }
    return { ...player, hand, discard };
  });
}

export function removeCardFromHand(
  state: GameState,
  playerId: string,
  cardId: string
): GameState {
  return updatePlayer(state, playerId, player => {
    const idx = player.hand.indexOf(cardId);
    if (idx === -1) return player;
    const hand = [...player.hand];
    hand.splice(idx, 1);
    return { ...player, hand };
  });
}

export function applyPowerDelta(
  state: GameState,
  playerId: string,
  delta: number
): GameState {
  return updatePlayer(state, playerId, player => ({
    ...player,
    dualistPower: player.dualistPower + delta,
  }));
}

export function resetForNewRound(state: GameState, firstPlayerId: string): GameState {
  return {
    ...state,
    phase: "playing",
    activePlayerId: firstPlayerId,
    lastRoundWinner: null,
    previousFirstPlayerId: firstPlayerId,
    players: state.players.map(p => ({
      ...p,
      dualist: null,
      dualistPower: 0,
      hasPassed: false,
      spellsPlayed: [],
      spellsOnBoard: [],
      pendingLibraryToCellar: false,
    })),
  };
}
