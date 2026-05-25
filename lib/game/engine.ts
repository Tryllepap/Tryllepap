/**
 * ============================================================
 *  GAME ENGINE
 *
 *  TURN SWITCHING RULE:
 *    Every time a player plays a card (spell or dualist),
 *    the active turn passes to the opponent immediately.
 *
 *  END OF ROUND DRAW RULE:
 *    After every round resolves, both players draw 2 cards.
 *
 *  FIRST PLAYER ALTERNATION:
 *    Round 1: decided by RPS.
 *    Round 2+: whoever did NOT go first last round goes first.
 *    (If previous round was a draw on first player, same player goes first.)
 *
 *  FLIP EFFECT:
 *    Cards marked isFlipEffect=true fire their dualistEffect at reveal
 *    time (resolution), not when placed. All other dualist effects also
 *    fire at resolution — isFlipEffect is a UI/description label only;
 *    the engine already resolves all dualist effects at resolution.
 *
 *  INSTANT SPELL:
 *    Cards marked isInstant=true fire immediately on cast.
 *    All spell effects fire immediately — isInstant is a label only.
 * ============================================================
 */

import {
  GameState, GamePhase, RpsChoice, PlayerState,
  getPlayer, updatePlayer, addLog,
  drawCards, removeCardFromHand,
  resetForNewRound,
} from "./state";
import { CARD_MAP } from "./cards";
import { MATCH_WIN_ROUNDS, END_OF_ROUND_DRAW } from "./rules";

// ─── RPS ──────────────────────────────────────────────────────────────────────

export function submitRpsChoice(
  state: GameState,
  playerId: string,
  choice: RpsChoice
): GameState {
  const player = getPlayer(state, playerId);
  if (player.rpsChoice) return state;

  let s = updatePlayer(state, playerId, p => ({ ...p, rpsChoice: choice }));
  s = addLog(s, `${player.username} made their choice...`);

  const [p1, p2] = s.players;
  if (!p1.rpsChoice || !p2.rpsChoice) return s;

  const winner = resolveRps(p1, p2);

  if (winner === "draw") {
    s = addLog(s, `Both chose ${p1.rpsChoice} — Draw! Play again.`);
    s = updatePlayer(s, p1.id, p => ({ ...p, rpsChoice: null }));
    s = updatePlayer(s, p2.id, p => ({ ...p, rpsChoice: null }));
    s = { ...s, rpsResult: "draw" };
    return s;
  }

  const winnerPlayer = getPlayer(s, winner);
  const loserPlayer = s.players.find(p => p.id !== winner)!;
  s = addLog(s, `${winnerPlayer.username} (${winnerPlayer.rpsChoice}) beats ${loserPlayer.username} (${loserPlayer.rpsChoice})!`);
  s = addLog(s, `${winnerPlayer.username} goes first!`);
  s = { ...s, rpsResult: winner, rpsWinnerId: winner };
  return s;
}

/** Called by client after RPS animation finishes — deals hands and starts game */
export function acknowledgeRps(state: GameState): GameState {
  if (!state.rpsWinnerId) return state;
  if (state.phase !== "rps") return state;

  let s = { ...state };

  // Deal starting hands
  for (const p of s.players) {
    s = drawCards(s, p.id, 4);
  }

  s = {
    ...s,
    phase: "playing" as GamePhase,
    activePlayerId: state.rpsWinnerId,
    previousFirstPlayerId: state.rpsWinnerId,
    rpsResult: undefined,
    rpsWinnerId: undefined,
  };
  s = addLog(s, `── Round 1 begins. ${getPlayer(s, state.rpsWinnerId).username} goes first. ──`);
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

// ─── Play spell card ──────────────────────────────────────────────────────────

export function playSpellCard(
  state: GameState,
  playerId: string,
  cardId: string,
  x = 20 + Math.random() * 60,
  y = 15 + Math.random() * 70
): GameState {
  if (state.phase !== "playing") return state;
  if (state.activePlayerId !== playerId) return state;

  const player = getPlayer(state, playerId);
  if (!player.hand.includes(cardId)) return state;

  const cardDef = CARD_MAP[cardId];
  if (!cardDef) return state;

let s = removeCardFromHand(state, playerId, cardId);
s = updatePlayer(s, playerId, p => ({
  ...p,
  discard: [...p.discard, cardId],
  spellsPlayed: [...p.spellsPlayed, cardId],
  spellsOnBoard: [...p.spellsOnBoard, {
    instanceId: `${cardId}-${Date.now()}`,
    cardId,
    x,
    y,
  }],
}));

  const effectLabel = cardDef.isInstant ? " (Instant)" : "";
  s = cardDef.spellEffect(s, playerId);
  s = addLog(s, `${player.username} cast ${cardDef.name} as a spell${effectLabel} — ${cardDef.spellDescription}.`);

  const opponent = s.players.find(p => p.id !== playerId)!;
  if (!opponent.hasPassed) {
    s = { ...s, activePlayerId: opponent.id };
    s = addLog(s, `Turn passes to ${opponent.username}.`);
  }

  return s;
}

// ─── Place Dualist ────────────────────────────────────────────────────────────

export function placeDualist(
  state: GameState,
  playerId: string,
  cardId: string
): GameState {
  if (state.phase !== "playing") return state;
  if (state.activePlayerId !== playerId) return state;

  const player = getPlayer(state, playerId);
  if (player.dualist !== null) return state;
  if (!player.hand.includes(cardId)) return state;

  const cardDef = CARD_MAP[cardId];
  if (!cardDef) return state;

  let s = removeCardFromHand(state, playerId, cardId);
  s = updatePlayer(s, playerId, p => ({
    ...p,
    dualist: cardId,
    dualistPower: cardDef.basePower,
  }));

  const flipLabel = cardDef.isFlipEffect ? " (Flip Effect)" : "";
  s = addLog(s, `${player.username} placed ${cardDef.name} face-down as their Dualist${flipLabel}.`);

  const opponent = s.players.find(p => p.id !== playerId)!;
  if (!opponent.hasPassed) {
    s = { ...s, activePlayerId: opponent.id };
    s = addLog(s, `Turn passes to ${opponent.username}.`);
  }

  return s;
}

// ─── Pass ─────────────────────────────────────────────────────────────────────

export function passAction(state: GameState, playerId: string): GameState {
  if (state.phase !== "playing") return state;
  if (state.activePlayerId !== playerId) return state;

  let s = updatePlayer(state, playerId, p => ({ ...p, hasPassed: true }));
  s = addLog(s, `${getPlayer(state, playerId).username} passed.`);

  const bothPassed = s.players.every(p => p.hasPassed);
  if (bothPassed) {
    return resolveRound(s);
  }

  const opponent = s.players.find(p => p.id !== playerId)!;
  s = { ...s, activePlayerId: opponent.id };
  return s;
}

// ─── Round resolution ─────────────────────────────────────────────────────────

function resolveRound(state: GameState): GameState {
  let s = { ...state, phase: "resolution" as GamePhase };
  s = addLog(s, "── Round Resolution ──");

  for (const p of s.players) {
    if (p.dualist) {
      const card = CARD_MAP[p.dualist];
      s = addLog(s, `${p.username} reveals: ${card.name} (base power ${card.basePower}).`);
    } else {
      s = addLog(s, `${p.username} has no Dualist — power 0.`);
    }
  }

  // Apply dualist effects (Flip Effects fire here)
  for (const p of s.players) {
    if (p.dualist) {
      const card = CARD_MAP[p.dualist];
      const flipLabel = card.isFlipEffect ? " [Flip Effect]" : "";
      s = card.dualistEffect(s, p.id);
      s = addLog(s, `${p.username}'s Dualist effect${flipLabel}: ${card.dualistDescription}.`);
    }
  }

  const [p1, p2] = s.players;
  const pow1 = p1.dualistPower;
  const pow2 = p2.dualistPower;
  s = addLog(s, `Final — ${p1.username}: ${pow1} | ${p2.username}: ${pow2}`);

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
    s = addLog(s, "Round draw — no points awarded.");
  }

  s = { ...s, lastRoundWinner: roundWinner };

  const matchWinner = s.players.find(p => p.roundsWon >= MATCH_WIN_ROUNDS);
  if (matchWinner) {
    s = addLog(s, `${matchWinner.username} wins the match!`);
    s = { ...s, phase: "game_over", matchWinner: matchWinner.id };
    return s;
  }

  s = { ...s, phase: "round_result" };
  return s;
}

/** Start next round — alternate who goes first each round */
export function startNextRound(state: GameState): GameState {
  if (state.phase !== "round_result") return state;

  // Alternate: whoever went first last round sits out, the other goes first
  let firstPlayerId: string;
  if (state.previousFirstPlayerId) {
    // Give first to the player who did NOT go first last round
    firstPlayerId = state.players.find(p => p.id !== state.previousFirstPlayerId)!.id;
  } else {
    // Fallback: loser of the round goes first (original behaviour)
    firstPlayerId = state.lastRoundWinner && state.lastRoundWinner !== "draw"
      ? state.players.find(p => p.id !== state.lastRoundWinner)!.id
      : state.activePlayerId;
  }

  let s = resetForNewRound(state, firstPlayerId);
  s = { ...s, roundNumber: state.roundNumber + 1 };

  for (const p of s.players) {
    s = drawCards(s, p.id, END_OF_ROUND_DRAW);
  }

  s = addLog(s, `Both players draw ${END_OF_ROUND_DRAW} cards.`);
  s = addLog(s, `── Round ${s.roundNumber} begins. ${getPlayer(s, firstPlayerId).username} goes first. ──`);
  return s;
}
