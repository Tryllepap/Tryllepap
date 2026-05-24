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
 *
 * TURN STRUCTURE
 * ──────────────
 * During their turn a player may do any combination of:
 *   1. Place 1 card face-down as their "Dualist" (once per round).
 *      → Uses the card's DUALIST effect on resolution.
 *   2. Play any number of spell cards from hand.
 *      → Uses the card's SPELL effect immediately.
 *   3. Press "Pass" to end their turn.
 *
 * PASS SYSTEM
 * ───────────
 * - When a player presses Pass, their turn ends.
 * - Opponent then takes their turn.
 * - When BOTH players have passed in the same round:
 *     → Round resolves (see ROUND RESOLUTION below).
 *
 * ROUND RESOLUTION (order of operations)
 * ────────────────────────────────────────
 *   1. Both Dualist cards are revealed.
 *   2. Dualist effects activate (in turn-order: first-player first).
 *   3. Spell effects are applied (in the order they were played).
 *   4. Final Dualist power totals are calculated.
 *   5. Higher power wins the round.
 *   6. Equal power = round draw (neither player scores).
 *
 * CARD STRUCTURE
 * ──────────────
 * Every card must have:
 *   - id:            unique string identifier
 *   - name:          display name
 *   - basePower:     numeric base power (used when played as Dualist)
 *   - description:   flavour / rules text shown to player
 *   - spellEffect:   function(state, playerId) → GameState
 *   - dualistEffect: function(state, playerId) → GameState
 *
 * FUTURE MECHANICS (add here when implemented)
 * ─────────────────────────────────────────────
 * - [ ] Deck building / custom decks
 * - [ ] Card rarity system
 * - [ ] Persistent card unlocks via gameData
 * - [ ] Multi-target spell effects
 * - [ ] Shields / damage negation
 * - [ ] Counter-spell mechanics
 * - [ ] Round bonuses for winning streaks
 */

export const MATCH_WIN_ROUNDS = 2;   // Rounds needed to win a match
export const STARTING_HAND_SIZE = 4; // Cards drawn at match start
export const MAX_HAND_SIZE = 10;     // Maximum cards in hand
