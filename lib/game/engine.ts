/**
 * ============================================================
 *  GAME ENGINE
 *  All legal game actions flow through this file.
 *  Each action takes the current GameState and returns a new one.
 *
 *  To add a new action:
 *    1. Write a pure function here that returns GameState.
 *    2. Call it from the API route handler.
 *    3. Document any new rules in lib/game/rules.ts.
 * ============================================================
 */

import { GameState, GamePhase, RpsChoice, PlayerState,
         getPlayer, updatePlayer, addLog,
         drawCards, removeCardFromHand, applyPowerDelta,
         resetForNewRound } from "./state";
import { CARD_MAP } from "./cards";
import { MATCH_WIN_ROUNDS } from "./rules";

// ─── RPS ──────────────────────────────────────────────────────────────────────

/** A player submits their RPS choice */
export function submitRpsChoice(
  state: GameState,
  playerId: string,
  choice: RpsChoice
): GameState {
  let s = updatePlayer(state, playerId, p => ({ ...p, rpsChoice: choice }));

  const [p1, p2] = s.players;
  if (!p1.rpsChoice || !p2.rpsChoice) return s; // Waiting for other player

  // Both submitted — resolve
  const winner = resolveRps(p1, p2);
  if (winner === "draw") {
    // Reset choices and try again
    s = addLog(s, `Both players chose ${p1.rpsChoice}. Draw — play again!`);
    s = updatePlayer(s, p1.id, p => ({ ...p, rpsChoice: null }));
    s = updatePlayer(s, p2.id, p => ({ ...p, rpsChoice: null }));
    return s;
  }

  const loser = s.players.find(p => p.id !== winner)!;
  s = addLog(s, `${getPlayer(s, winner).username} wins Rock Paper Scissors and goes first!`);

  // Deal starting hands and begin
  s = dealStartingHandsOnce(s);
  s = { ...s, phase: "playing", activePlayerId: winner };
  return s;
}

function resolveRps(p1: PlayerState, p2: PlayerState): string | "draw" {
  const beats: Record<RpsChoice, RpsChoice> = {
    rock: "scissors",
    scissors: "paper",
    paper: "rock",
  };
  if (p1.rpsChoice === p2.rpsChoice) return "draw";
  return beats[p1.rpsChoice!] === p2.rpsChoice ? p1.id : p2.id;
}

// Only deal once (guard against double-dealing on reconnect)
let handsDealt = false;
function dealStartingHandsOnce(state: GameState): GameState {
  if (handsDealt) return state;
  handsDealt = true;
  let s = state;
  for (const p of s.players) {
    s = drawCards(s, p.id, 4);
  }
  return s;
}

// ─── Play spell card ──────────────────────────────────────────────────────────

/** A player plays a card from hand as a spell */
export function playSpellCard(
  state: GameState,
  playerId: string,
  cardId: string
): GameState {
  if (state.phase !== "playing") return state;
  if (state.activePlayerId !== playerId) return state;

  const player = getPlayer(state, playerId);
  if (!player.hand.includes(cardId)) return state;

  const cardDef = CARD_MAP[cardId];
  if (!cardDef) return state;

  // Remove card from hand
  let s = removeCardFromHand(state, playerId, cardId);

  // Move to discard
  s = updatePlayer(s, playerId, p => ({
    ...p,
    discard: [...p.discard, cardId],
    spellsPlayed: [...p.spellsPlayed, cardId],
  }));

  // Apply spell effect
  s = cardDef.spellEffect(s, playerId);
  s = addLog(s, `${player.username} played ${cardDef.name} as a spell (${cardDef.spellDescription}).`);

  return s;
}

// ─── Place Dualist ────────────────────────────────────────────────────────────

/** A player places a card face-down as their Dualist */
export function placeDualist(
  state: GameState,
  playerId: string,
  cardId: string
): GameState {
  if (state.phase !== "playing") return state;
  if (state.activePlayerId !== playerId) return state;

  const player = getPlayer(state, playerId);
  if (player.dualist !== null) return state; // Already placed a Dualist this round
  if (!player.hand.includes(cardId)) return state;

  const cardDef = CARD_MAP[cardId];
  if (!cardDef) return state;

  let s = removeCardFromHand(state, playerId, cardId);
  s = updatePlayer(s, playerId, p => ({
    ...p,
    dualist: cardId,
    dualistPower: cardDef.basePower,
  }));
  s = addLog(s, `${player.username} placed a card face-down as their Dualist.`);

  return s;
}

// ─── Pass ─────────────────────────────────────────────────────────────────────

/** A player presses Pass */
export function passAction(state: GameState, playerId: string): GameState {
  if (state.phase !== "playing") return state;
  if (state.activePlayerId !== playerId) return state;

  let s = updatePlayer(state, playerId, p => ({ ...p, hasPassed: true }));
  s = addLog(s, `${getPlayer(state, playerId).username} passed.`);

  const bothPassed = s.players.every(p => p.hasPassed);
  if (bothPassed) {
    return resolveRound(s);
  }

  // Switch active player
  const opponent = s.players.find(p => p.id !== playerId)!;
  s = { ...s, activePlayerId: opponent.id };
  return s;
}

// ─── Round resolution ─────────────────────────────────────────────────────────

/**
 * Both players passed — resolve the round.
 * Order of operations (see rules.ts):
 *   1. Reveal Dualists
 *   2. Apply Dualist effects (first-player first)
 *   3. Final power comparison
 *   4. Award round win or draw
 *   5. Check for match winner
 */
function resolveRound(state: GameState): GameState {
  let s = { ...state, phase: "resolution" as GamePhase };
  s = addLog(s, "── Round Resolution ──");

  // 1. Reveal
  for (const p of s.players) {
    if (p.dualist) {
      const card = CARD_MAP[p.dualist];
      s = addLog(s, `${p.username} reveals their Dualist: ${card.name} (base power ${card.basePower}).`);
    } else {
      s = addLog(s, `${p.username} has no Dualist! (power 0)`);
    }
  }

  // 2. Dualist effects — first player's Dualist fires first
  for (const p of s.players) {
    if (p.dualist) {
      const card = CARD_MAP[p.dualist];
      s = card.dualistEffect(s, p.id);
      s = addLog(s, `${p.username}'s Dualist effect: ${card.dualistDescription}.`);
    }
  }

  // 3. Calculate final powers
  const [p1, p2] = s.players;
  const pow1 = p1.dualistPower;
  const pow2 = p2.dualistPower;
  s = addLog(s, `Final powers — ${p1.username}: ${pow1} | ${p2.username}: ${pow2}`);

  // 4. Award round
  let roundWinner: string | "draw";
  if (pow1 > pow2) {
    roundWinner = p1.id;
    s = updatePlayer(s, p1.id, p => ({ ...p, roundsWon: p.roundsWon + 1 }));
    s = addLog(s, `${p1.username} wins the round!`);
  } else if (pow2 > pow1) {
    roundWinner = p2.id;
    s = updatePlayer(s, p2.id, p => ({ ...p, roundsWon: p.roundsWon + 1 }));
    s = addLog(s, `${p2.username} wins the round!`);
  } else {
    roundWinner = "draw";
    s = addLog(s, "Round is a draw — no points awarded.");
  }

  s = { ...s, lastRoundWinner: roundWinner };

  // 5. Check for match winner
  const matchWinner = s.players.find(p => p.roundsWon >= MATCH_WIN_ROUNDS);
  if (matchWinner) {
    s = addLog(s, `${matchWinner.username} wins the match!`);
    s = { ...s, phase: "game_over", matchWinner: matchWinner.id };
    return s;
  }

  s = { ...s, phase: "round_result" };
  return s;
}

/** Called after both players acknowledge the round result — start next round */
export function startNextRound(state: GameState): GameState {
  if (state.phase !== "round_result") return state;

  // Loser of last round goes first next round (or same if draw)
  let firstPlayerId = state.activePlayerId;
  if (state.lastRoundWinner && state.lastRoundWinner !== "draw") {
    // Loser goes first
    firstPlayerId = state.players.find(p => p.id !== state.lastRoundWinner)!.id;
  }

  let s = resetForNewRound(state, firstPlayerId);
  s = { ...s, roundNumber: state.roundNumber + 1 };
  s = addLog(s, `── Round ${s.roundNumber} begins. ${getPlayer(s, firstPlayerId).username} goes first. ──`);
  return s;
}
