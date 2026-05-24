/**
 * ============================================================
 *  GAME STATE
 *  Defines the shape of a live game and pure helper functions
 *  that produce new states without mutating the original.
 *
 *  All state transitions happen through these helpers so that
 *  adding new mechanics only requires new helper functions.
 * ============================================================
 */

import { STARTING_HAND_SIZE, MAX_HAND_SIZE } from "./rules";
import { buildDeck, CARD_MAP } from "./cards";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RpsChoice = "rock" | "paper" | "scissors";
export type GamePhase =
  | "rps"           // Rock paper scissors to determine first player
  | "playing"       // Normal turn play
  | "resolution"    // Both passed — resolving round
  | "round_result"  // Showing round result before next round
  | "game_over";    // Match finished

export interface PlayerState {
  id: string;
  username: string;
  hand: string[];          // Card ids in hand
  deck: string[];          // Remaining draw pile
  discard: string[];       // Discarded cards
  dualist: string | null;  // Card id placed as Dualist this round
  dualistPower: number;    // Current Dualist power (base + modifiers)
  roundsWon: number;       // Rounds won this match
  hasPassed: boolean;      // Has passed this round
  rpsChoice: RpsChoice | null;
  // Log of played spell card ids this round (in order played)
  spellsPlayed: string[];
}

export interface GameState {
  id: string;              // Lobby/game id
  players: PlayerState[];  // Always length 2; index 0 = first player
  phase: GamePhase;
  activePlayerId: string;  // Whose turn it is
  roundNumber: number;
  // Log of events for the UI to display
  eventLog: string[];
  // Winner of the match (null until game_over)
  matchWinner: string | null;
  // Winner of last resolved round (null | playerId | "draw")
  lastRoundWinner: string | "draw" | null;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

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
  });

  return {
    id: gameId,
    players: [makePlayer(player1), makePlayer(player2)],
    phase: "rps",
    activePlayerId: player1.id,
    roundNumber: 1,
    eventLog: ["Match started. Play Rock, Paper, or Scissors to decide who goes first."],
    matchWinner: null,
    lastRoundWinner: null,
  };
}

// ─── Pure state helpers ───────────────────────────────────────────────────────
// These never mutate — they always return a new GameState.

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

/** Draw n cards from a player's deck into their hand */
export function drawCards(state: GameState, playerId: string, n: number): GameState {
  return updatePlayer(state, playerId, player => {
    let deck = [...player.deck];
    let hand = [...player.hand];
    let discard = [...player.discard];

    for (let i = 0; i < n; i++) {
      if (hand.length >= MAX_HAND_SIZE) break;
      if (deck.length === 0) {
        // Reshuffle discard into deck
        if (discard.length === 0) break;
        deck = [...discard].sort(() => Math.random() - 0.5);
        discard = [];
      }
      hand.push(deck.shift()!);
    }

    return { ...player, hand, deck, discard };
  });
}

/** Discard n random cards from a player's hand */
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

/** Remove a specific card from a player's hand */
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

/** Apply a power delta to a player's current Dualist */
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

/** Deal starting hand to both players */
export function dealStartingHands(state: GameState): GameState {
  let s = state;
  for (const player of state.players) {
    s = drawCards(s, player.id, STARTING_HAND_SIZE);
  }
  return s;
}

/** Reset per-round state for both players, keeping match scores */
export function resetForNewRound(state: GameState, firstPlayerId: string): GameState {
  return {
    ...state,
    phase: "playing",
    activePlayerId: firstPlayerId,
    lastRoundWinner: null,
    players: state.players.map(p => ({
      ...p,
      dualist: null,
      dualistPower: 0,
      hasPassed: false,
      spellsPlayed: [],
    })),
  };
}
