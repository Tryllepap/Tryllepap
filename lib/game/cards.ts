/**
 * ============================================================
 *  CARD REGISTRY
 *  All cards are defined here.
 *  To add a new card:
 *    1. Define it as a CardDefinition below.
 *    2. Add it to the CARD_REGISTRY array.
 *    3. Document its effects in lib/game/rules.ts
 * ============================================================
 */

import { GameState, applyPowerDelta, drawCards, discardCards } from "./state";

export interface CardDefinition {
  id: string;
  name: string;
  basePower: number;
  // Short text shown on card face
  spellDescription: string;
  dualistDescription: string;
  // Effect functions — receive full game state + acting player id
  // Must return the NEW game state (treat state as immutable)
  spellEffect:   (state: GameState, playerId: string) => GameState;
  dualistEffect: (state: GameState, playerId: string) => GameState;
}

// ─── Helper: get opponent id ─────────────────────────────────────────────────
export function getOpponentId(state: GameState, playerId: string): string {
  return state.players.find(p => p.id !== playerId)!.id;
}

// ─── Card Definitions ─────────────────────────────────────────────────────────

/**
 * CONRAD
 * Spell:   +1 power to your Dualist
 * Dualist: -1 power to your own Dualist
 */
const Conrad: CardDefinition = {
  id: "conrad",
  name: "Conrad",
  basePower: 1,
  spellDescription: "+1 power to your Dualist",
  dualistDescription: "-1 power to your own Dualist",
  spellEffect: (state, playerId) => {
    // Add +1 to the acting player's current Dualist power
    return applyPowerDelta(state, playerId, +1);
  },
  dualistEffect: (state, playerId) => {
    // Subtract 1 from the acting player's own Dualist power
    return applyPowerDelta(state, playerId, -1);
  },
};

/**
 * DONRAD
 * Spell:   Draw 1 card
 * Dualist: Draw 1 card
 */
const Donrad: CardDefinition = {
  id: "donrad",
  name: "Donrad",
  basePower: 1,
  spellDescription: "Draw 1 card",
  dualistDescription: "Draw 1 card",
  spellEffect: (state, playerId) => {
    return drawCards(state, playerId, 1);
  },
  dualistEffect: (state, playerId) => {
    return drawCards(state, playerId, 1);
  },
};

/**
 * MONRAD
 * Spell:   Discard 1 card
 * Dualist: Discard 1 card
 * Note: discards a random card from the player's hand for now.
 *       Future: let player choose which card to discard.
 */
const Monrad: CardDefinition = {
  id: "monrad",
  name: "Monrad",
  basePower: 0,
  spellDescription: "Discard 1 card",
  dualistDescription: "Discard 1 card",
  spellEffect: (state, playerId) => {
    return discardCards(state, playerId, 1);
  },
  dualistEffect: (state, playerId) => {
    return discardCards(state, playerId, 1);
  },
};

// ─── Registry ─────────────────────────────────────────────────────────────────
// Add new cards to this array. Order does not matter.
export const CARD_REGISTRY: CardDefinition[] = [
  Conrad,
  Donrad,
  Monrad,
];

// Fast lookup by id
export const CARD_MAP: Record<string, CardDefinition> = Object.fromEntries(
  CARD_REGISTRY.map(c => [c.id, c])
);

// Build a shuffled deck of n copies of each card
export function buildDeck(copiesPerCard = 3): string[] {
  const deck: string[] = [];
  for (const card of CARD_REGISTRY) {
    for (let i = 0; i < copiesPerCard; i++) {
      deck.push(card.id);
    }
  }
  return shuffleDeck(deck);
}

export function shuffleDeck(deck: string[]): string[] {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
