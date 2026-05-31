/**
 * ============================================================
 *  CARD REGISTRY
 * ============================================================
 */

import { GameState, applyPowerDelta, drawCards, discardCards, getPlayer } from "./state";

export interface CardDefinition {
  id: string;
  name: string;
  basePower: number;
  categories: string[];           // e.g. ["Beast", "Troll"]
  spellDescription: string;
  dualistDescription: string;
  image?: string;                 // path relative to /public, e.g. "/cards/friendly_troll.jpg"
  isFlipEffect?: boolean;         // true = dualist effect fires on reveal, not on placement
  isInstant?: boolean;            // true = spell effect fires immediately with no delay
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
  categories: [],
  spellDescription: "+1 power to your Dualist",
  dualistDescription: "-1 power to your own Dualist",
  spellEffect: (state, playerId) => applyPowerDelta(state, playerId, +1),
  dualistEffect: (state, playerId) => applyPowerDelta(state, playerId, -1),
};

/**
 * DONRAD
 * Spell:   Draw 1 card (Instant)
 * Dualist: Draw 1 card (Flip Effect)
 */
const Donrad: CardDefinition = {
  id: "donrad",
  name: "Donrad",
  basePower: 1,
  categories: [],
  isInstant: true,
  isFlipEffect: true,
  spellDescription: "Draw 1 card (Instant)",
  dualistDescription: "Draw 1 card (Flip Effect)",
  spellEffect: (state, playerId) => drawCards(state, playerId, 1),
  dualistEffect: (state, playerId) => drawCards(state, playerId, 1),
};

/**
 * MONRAD
 * Spell:   Discard 1 card
 * Dualist: Discard 1 card
 */
const Monrad: CardDefinition = {
  id: "monrad",
  name: "Monrad",
  basePower: 0,
  categories: [],
  spellDescription: "Discard 1 card",
  dualistDescription: "Discard 1 card",
  spellEffect: (state, playerId) => discardCards(state, playerId, 1),
  dualistEffect: (state, playerId) => discardCards(state, playerId, 1),
};

/**
 * WEREWOLF STUDENT / VAREULVEELEV
 * Spell:   Your dualist gets +1 power. (Flip Effect)
 * Dualist: The student gets +1 for each Beast card thrown this round. (Flip Effect)
 * Categories: House Fafner, Student, Beast, Werewolf, Ritual
 */
const WerewolfStudent: CardDefinition = {
  id: "werewolf_student",
  name: "Werewolf Student",
  basePower: 1,
  categories: ["House Fafner", "Student", "Beast", "Werewolf", "Ritual"],
  image: "/cards/werewolf-student.jpg",
  isFlipEffect: true,
  spellDescription: "Your dualist gets +1 power. (Flip Effect)",
  dualistDescription: "The student gets +1 for each Beast card thrown this round. (Flip Effect)",
  spellEffect: (state, playerId) => {
    // Flip Effect — applies at resolution, not immediately on cast
    return applyPowerDelta(state, playerId, +1);
  },
  dualistEffect: (state, playerId) => {
    // Count Beast cards the player has thrown on the board this round
    const player = getPlayer(state, playerId);
    const beastCount = (player.spellsOnBoard ?? []).filter(spell => {
      const card = CARD_MAP[spell.cardId];
      return card?.categories?.includes("Beast");
    }).length;
    return applyPowerDelta(state, playerId, beastCount);
  },
};

/**
 * FRIENDLY TROLL
 * Spell:   Your dualist gets +2 if you have no cards in hand (Flip Effect)
 * Dualist: +2 if you have no cards in hand (Flip Effect)
 * Categories: Beast, Troll
 */
const FriendlyTroll: CardDefinition = {
  id: "friendly_troll",
  name: "Friendly Troll",
  basePower: 4,
  categories: ["Beast", "Troll"],
  image: "/cards/friendly_troll.jpg",
  isFlipEffect: true,
  spellDescription: "Your Dualist gets +2 if you have no cards in hand (Flip Effect)",
  dualistDescription: "The troll has +2 if you have no cards in hand (Flip Effect)",
  spellEffect: (state, playerId) => {
    const player = getPlayer(state, playerId);
    if (player.hand.length === 0) {
      return applyPowerDelta(state, playerId, +2);
    }
    return state;
  },
  dualistEffect: (state, playerId) => {
    const player = getPlayer(state, playerId);
    if (player.hand.length === 0) {
      return applyPowerDelta(state, playerId, +2);
    }
    return state;
  },
};

// ─── Registry ─────────────────────────────────────────────────────────────────
export const CARD_REGISTRY: CardDefinition[] = [
  Conrad,
  Donrad,
  Monrad,
  FriendlyTroll,
  WerewolfStudent,
];

export const CARD_MAP: Record<string, CardDefinition> = Object.fromEntries(
  CARD_REGISTRY.map(c => [c.id, c])
);

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
