/**
 * ============================================================
 *  TRYLLEPAP — TRANSLATIONS
 *  Add new keys to both EN and DA objects simultaneously.
 * ============================================================
 */

export type Locale = "en" | "da";

export const translations = {
  en: {
    // Score bar
    round: "Round",
    of: "of",
    you: "You",

    // Battle log
    battleLog: "♠ Battle Log",

    // RPS
    ready: "Ready!",
    choosing: "Choosing...",
    waitingForOpponent: "Waiting for opponent...",
    draw: "DRAW!",
    youWin: "YOU WIN!",
    theyWin: "THEY WIN!",
    rock: "Rock",
    paper: "Paper",
    scissors: "Scissors",

    // Field
    yourDualist: "Your Dualist",
    dualist: "Dualist",
    passed: "Passed",
    noCards: "No cards",
    dragHint: "Drag cards here · click anywhere to cast spells",
    dragHintOver: "Release to cast spell",
    noSpellsCast: "No spells cast yet",
    resolving: "⚔ Resolving",
    yourTurn: "Your Turn",
    sTurn: "'s Turn",

    // Action buttons
    dualistBtn: "⚔ Dualist",
    spellBtn: "✦ Spell",
    passBtn: "Pass",

    // Inspector
    spellEffect: "✦ Spell Effect",
    dualistEffect: "⚔ Dualist Effect",
    placeAsDualist: "Place as Dualist",
    castAsSpell: "Cast as Spell",
    inspectHint: "Click a card or\nspell to inspect",
    spellPlayedNote: "Spell played on the board.",
    cardArtSoon: "Card art coming soon",
    instant: "Instant",
    flipEffect: "Flip Effect",
    categories: "Categories",

    // Results
    roundVictory: "Round Victory!",
    roundDraw: "Round Draw",
    roundLost: "Round Lost",
    nextRound: "Next Round →",
    victory: "Victory!",
    defeat: "Defeat",
    masteredMsg: "You have mastered TryllePap!",
    returnToHall: "Return to Hall",
    rounds: "rounds",

    // Loading
    loadingGame: "Loading game...",
  },
  da: {
    round: "Runde",
    of: "af",
    you: "Dig",

    battleLog: "♠ Kamplog",

    ready: "Klar!",
    choosing: "Vælger...",
    waitingForOpponent: "Venter på modstander...",
    draw: "UAFGJORT!",
    youWin: "DU VINDER!",
    theyWin: "DE VINDER!",
    rock: "Sten",
    paper: "Papir",
    scissors: "Saks",

    yourDualist: "Din Duellant",
    dualist: "Duellant",
    passed: "Pas",
    noCards: "Ingen kort",
    dragHint: "Træk kort hertil · klik overalt for at kaste trylleri",
    dragHintOver: "Slip for at kaste",
    noSpellsCast: "Ingen trylleformularer kastet endnu",
    resolving: "⚔ Afgøres",
    yourTurn: "Din Tur",
    sTurn: "s Tur",

    dualistBtn: "⚔ Duellant",
    spellBtn: "✦ Trylleri",
    passBtn: "Pas",

    spellEffect: "✦ Trylleriformular-effekt",
    dualistEffect: "⚔ Duellant-effekt",
    placeAsDualist: "Placer som Duellant",
    castAsSpell: "Kast som Trylleri",
    inspectHint: "Klik på et kort eller\ntrylleri for at inspicere",
    spellPlayedNote: "Trylleri spillet på brættet.",
    cardArtSoon: "Kortkunst kommer snart",
    instant: "Øjeblikkelig",
    flipEffect: "Vendingseffekt",
    categories: "Kategorier",

    roundVictory: "Rundesejer!",
    roundDraw: "Uafgjort Runde",
    roundLost: "Runde Tabt",
    nextRound: "Næste Runde →",
    victory: "Sejr!",
    defeat: "Nederlag",
    masteredMsg: "Du har mestret TryllePap!",
    returnToHall: "Tilbage til Hallen",
    rounds: "runder",

    loadingGame: "Indlæser spil...",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export interface CardTranslation {
  name: string;
  spellDescription: string;
  dualistDescription: string;
  categories: string[];
}

export const cardTranslations: Record<string, Record<Locale, CardTranslation>> = {
  conrad: {
    en: { name: "Conrad", spellDescription: "+1 power to your Dualist", dualistDescription: "-1 power to your own Dualist", categories: [] },
    da: { name: "Conrad", spellDescription: "+1 styrke til din Duellant", dualistDescription: "-1 styrke til din egen Duellant", categories: [] },
  },
  donrad: {
    en: { name: "Donrad", spellDescription: "Draw 1 card (Instant)", dualistDescription: "Draw 1 card (Flip Effect)", categories: [] },
    da: { name: "Donrad", spellDescription: "Træk 1 kort (Øjeblikkelig)", dualistDescription: "Træk 1 kort (Vendingseffekt)", categories: [] },
  },
  monrad: {
    en: { name: "Monrad", spellDescription: "Discard 1 card", dualistDescription: "Discard 1 card", categories: [] },
    da: { name: "Monrad", spellDescription: "Kassér 1 kort", dualistDescription: "Kassér 1 kort", categories: [] },
  },
friendly_troll: {
    en: {
      name: "Friendly Troll",
      spellDescription: "Your Dualist gets +2 if you have no cards in hand (Flip Effect)",
      dualistDescription: "The troll has +2 if you have no cards in hand (Flip Effect)",
      categories: ["Beast", "Troll"],
    },
    da: {
      name: "Venlig Trold",
      spellDescription: "Din duellant får +2, hvis du ikke har nogen kort på hånden (Vendingseffekt)",
      dualistDescription: "Trolden har +2, hvis du ikke har nogle kort på hånden (Vendingseffekt)",
      categories: ["Bæst", "Trold"],
    },
  },
  werewolf_student: {
    en: {
      name: "Werewolf Student",
      spellDescription: "Your dualist gets +1 power. (Flip Effect)",
      dualistDescription: "The student gets +1 for each Beast card thrown this round. (Flip Effect)",
      categories: ["House Fafner", "Student", "Beast", "Werewolf", "Ritual"],
    },
    da: {
      name: "Vareulveelev",
      spellDescription: "Din duellant får +1. (Vendingseffekt)",
      dualistDescription: "Eleven får +1 for hvert bæst, du har kastet. (Vendingseffekt)",
      categories: ["Hus Fafner", "Elev", "Bæst", "Vareulv", "Ritual"],
    },
lecture_magic_ecosystems: {
    en: {
      name: "Lecture in Magic Ecosystems",
      spellDescription: "Your dualist gets +1 for each Beast card in your cellar. (Flip Effect)",
      dualistDescription: "You lose the duel. Put up to 5 cards from the top of your library into the cellar. (Flip Effect)",
      categories: ["Subject", "Ritual"],
    },
    da: {
      name: "Undervisning i magiske økosystemer",
      spellDescription: "Din duellant får +1 for hvert Bæst i din kælder. (Vendingseffekt)",
      dualistDescription: "Du taber duellen. Læg op til 5 kort fra toppen af dit bibliotek ned i kælderen. (Vendingseffekt)",
      categories: ["Fag", "Ritual"],
    },
  },
};
