/**
 * ============================================================
 *  TRYLLEPAP — OFFICIAL GAME RULES
 *  This file is the single source of truth for all game rules.
 *  Add new rules, mechanics, and card effects here first.
 * ============================================================
 *
 * MATCH STRUCTURE
 * ───────────────
 * - A match is played until one player wins 2 rounds.
 * - Each round consists of turns until both players pass.
 *
 * ROUND START
 * ───────────
 * - First round: winner determined by Rock Paper Scissors.
 * - Subsequent rounds: loser of previous round goes first.
 *   (If draw, same player goes first again.)
 * - Both players draw 4 cards at the start of the match.
 * - Both players draw 2 cards at the start of each new round.
 *
 * TURN STRUCTURE
 * ──────────────
 * During their turn a player may:
 *   1. Place 1 card face-down as their "Dualist" (once per round).
 *      → Turn immediately passes to opponent after placing.
 *   2. Play any number of spell cards from hand.
 *      → Turn immediately passes to opponent after each spell.
 *   3. Press "Pass" to end their turn.
 *
 * PASS SYSTEM
 * ───────────
 * - When a player presses Pass, their turn ends.
 * - Opponent then takes their turn.
 * - When BOTH players have passed → round resolves.
 *
 * ROUND RESOLUTION (order of operations)
 * ────────────────────────────────────────
 *   1. Both Dualist cards are revealed.
 *   2. Dualist effects activate (first-player first).
 *   3. Spell effects are applied (in the order they were played).
 *   4. Final Dualist power totals are calculated.
 *   5. Higher power wins the round.
 *   6. Equal power = round draw.
 *
 * CARD STRUCTURE
 * ──────────────
 * Every card must have:
 *   - id, name, basePower, spellDescription, dualistDescription
 *   - spellEffect(state, playerId) → GameState
 *   - dualistEffect(state, playerId) → GameState
 *
 * FUTURE MECHANICS
 * ─────────────────
 * - [ ] Deck building / custom decks
 * - [ ] Card rarity system
 * - [ ] Persistent card unlocks via gameData
 * - [ ] Multi-target spell effects
 * - [ ] Shields / damage negation
 * - [ ] Counter-spell mechanics
 */

export const MATCH_WIN_ROUNDS = 2;
export const STARTING_HAND_SIZE = 4;
export const MAX_HAND_SIZE = 10;
export const END_OF_ROUND_DRAW = 2;
