"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getPusherClient } from "@/lib/pusher";
import { GameState, CardDefinition } from "@/lib/game";
import { CARD_MAP } from "@/lib/game/cards";
import styles from "./game.module.css";

type RpsChoice = "rock" | "paper" | "scissors";

export default function GamePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch session
  useEffect(() => {
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(data => {
        if (!data.isLoggedIn) { router.push("/"); return; }
        setMyUsername(data.username);
      });
  }, [router]);

  // Fetch initial game state
  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/game/state?lobbyId=${id}`);
    if (res.ok) {
      const data = await res.json();
      setGameState(data);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchState(); }, [fetchState]);

  // Realtime state updates
  useEffect(() => {
    const channel = getPusherClient().subscribe(`game-${id}`);
    channel.bind("state-update", (state: GameState) => {
      setGameState(state);
    });
    return () => { getPusherClient().unsubscribe(`game-${id}`); };
  }, [id]);

  const sendAction = useCallback(async (action: string, payload: object = {}) => {
    await fetch("/api/game/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lobbyId: id, action, payload }),
    });
  }, [id]);

  if (loading || !gameState || !myUsername) {
    return (
      <main className={styles.main}>
        <div className={styles.loadingDots}><span>·</span><span>·</span><span>·</span></div>
      </main>
    );
  }

  const me = gameState.players.find(p => p.id === myUsername);
  const opponent = gameState.players.find(p => p.id !== myUsername);
  if (!me || !opponent) return null;

  const isMyTurn = gameState.activePlayerId === myUsername;
  const phase = gameState.phase;

  return (
    <main className={styles.main}>
      <div className={styles.bg} aria-hidden="true" />
      <div className={styles.gameContainer}>

        {/* ── Top bar ── */}
        <div className={styles.topBar}>
          <div className={styles.scoreBox}>
            <span className={styles.scoreName}>{opponent.username}</span>
            <span className={styles.scoreValue}>{opponent.roundsWon} wins</span>
          </div>
          <div className={styles.roundBadge}>Round {gameState.roundNumber}</div>
          <div className={styles.scoreBox}>
            <span className={styles.scoreName}>You</span>
            <span className={styles.scoreValue}>{me.roundsWon} wins</span>
          </div>
        </div>

        {/* ── RPS Phase ── */}
        {phase === "rps" && (
          <div className={styles.rpsArea}>
            <h2 className={styles.phaseTitle}>Rock · Paper · Scissors</h2>
            <p className={styles.phaseSubtitle}>Choose to decide who goes first</p>
            {me.rpsChoice ? (
              <p className={styles.waitText}>You chose <strong>{me.rpsChoice}</strong>. Waiting for opponent...</p>
            ) : (
              <div className={styles.rpsButtons}>
                {(["rock", "paper", "scissors"] as RpsChoice[]).map(choice => (
                  <button key={choice} className={styles.rpsBtn} onClick={() => sendAction("rps", { choice })}>
                    {choice === "rock" ? "🪨" : choice === "paper" ? "📄" : "✂️"}
                    <span>{choice}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Playing Phase ── */}
        {(phase === "playing" || phase === "resolution") && (
          <div className={styles.boardArea}>

            {/* Opponent field */}
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>{opponent.username}'s field</div>
              <div className={styles.dualistSlot}>
                {opponent.dualist ? (
                  <div className={`${styles.cardSlot} ${styles.cardFaceDown}`}>
                    <span>?</span>
                    <span className={styles.cardSlotLabel}>Dualist</span>
                  </div>
                ) : (
                  <div className={`${styles.cardSlot} ${styles.cardSlotEmpty}`}>
                    <span>No Dualist</span>
                  </div>
                )}
              </div>
              <div className={styles.handCount}>Hand: {opponent.hand.length} cards</div>
            </div>

            {/* Turn indicator */}
            <div className={styles.turnIndicator}>
              {phase === "resolution" ? (
                <span className={styles.resolvingBadge}>⚔ Resolving Round...</span>
              ) : isMyTurn ? (
                <span className={styles.myTurnBadge}>Your Turn</span>
              ) : (
                <span className={styles.waitingBadge}>Waiting for {opponent.username}...</span>
              )}
            </div>

            {/* My field */}
            <div className={styles.fieldRow}>
              <div className={styles.fieldLabel}>Your field</div>
              <div className={styles.dualistSlot}>
                {me.dualist ? (
                  <div className={`${styles.cardSlot} ${styles.cardPlaced}`}>
                    <span className={styles.cardName}>{CARD_MAP[me.dualist]?.name}</span>
                    <span className={styles.cardPower}>PWR {me.dualistPower}</span>
                    <span className={styles.cardSlotLabel}>Dualist</span>
                  </div>
                ) : (
                  <div
                    className={`${styles.cardSlot} ${styles.cardSlotEmpty} ${selectedCard && isMyTurn ? styles.cardSlotHighlight : ""}`}
                    onClick={() => {
                      if (selectedCard && isMyTurn && !me.dualist) {
                        sendAction("place_dualist", { cardId: selectedCard });
                        setSelectedCard(null);
                      }
                    }}
                  >
                    <span>{selectedCard && isMyTurn ? "Place as Dualist" : "No Dualist"}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons */}
            {isMyTurn && phase === "playing" && (
              <div className={styles.actionButtons}>
                {selectedCard && (
                  <button
                    className={styles.spellBtn}
                    onClick={() => { sendAction("play_spell", { cardId: selectedCard }); setSelectedCard(null); }}
                  >
                    Cast as Spell
                  </button>
                )}
                <button className={styles.passBtn} onClick={() => sendAction("pass")}>
                  Pass Turn
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Round Result ── */}
        {phase === "round_result" && (
          <div className={styles.resultArea}>
            <div className={styles.resultBox}>
              <span className={styles.resultIcon}>
                {gameState.lastRoundWinner === myUsername ? "🏆" : gameState.lastRoundWinner === "draw" ? "🤝" : "💀"}
              </span>
              <h2 className={styles.resultTitle}>
                {gameState.lastRoundWinner === myUsername
                  ? "You win the round!"
                  : gameState.lastRoundWinner === "draw"
                  ? "Round Draw"
                  : `${opponent.username} wins the round!`}
              </h2>
              <p className={styles.resultScores}>
                {me.username} {me.dualistPower} — {opponent.dualistPower} {opponent.username}
              </p>
              <button className={styles.nextRoundBtn} onClick={() => sendAction("next_round")}>
                Next Round →
              </button>
            </div>
          </div>
        )}

        {/* ── Game Over ── */}
        {phase === "game_over" && (
          <div className={styles.resultArea}>
            <div className={styles.resultBox}>
              <span className={styles.resultIcon}>
                {gameState.matchWinner === myUsername ? "👑" : "💀"}
              </span>
              <h2 className={styles.resultTitle}>
                {gameState.matchWinner === myUsername ? "Victory!" : `${opponent.username} wins the match!`}
              </h2>
              <p className={styles.resultScores}>
                Final score — {me.username}: {me.roundsWon} | {opponent.username}: {opponent.roundsWon}
              </p>
              <button className={styles.nextRoundBtn} onClick={() => router.push("/lobby")}>
                Return to Hall
              </button>
            </div>
          </div>
        )}

        {/* ── Event Log ── */}
        <div className={styles.eventLog}>
          {[...gameState.eventLog].reverse().slice(0, 5).map((e, i) => (
            <p key={i} className={styles.logEntry}>{e}</p>
          ))}
        </div>

        {/* ── Hand ── */}
        {(phase === "playing" || phase === "rps") && (
          <div className={styles.handArea}>
            <div className={styles.handLabel}>Your Hand ({me.hand.length})</div>
            <div className={styles.hand}>
              {me.hand.map((cardId, i) => {
                const card = CARD_MAP[cardId];
                if (!card) return null;
                return (
                  <div
                    key={`${cardId}-${i}`}
                    className={`${styles.card} ${selectedCard === cardId ? styles.cardSelected : ""} ${!isMyTurn || phase !== "playing" ? styles.cardDisabled : ""}`}
                    onClick={() => {
                      if (!isMyTurn || phase !== "playing") return;
                      setSelectedCard(selectedCard === cardId ? null : cardId);
                    }}
                  >
                    <div className={styles.cardHeader}>
                      <span className={styles.cardNameSmall}>{card.name}</span>
                      <span className={styles.cardPowerSmall}>{card.basePower}</span>
                    </div>
                    <div className={styles.cardEffects}>
                      <div className={styles.cardEffect}>
                        <span className={styles.effectLabel}>Spell</span>
                        <span className={styles.effectText}>{card.spellDescription}</span>
                      </div>
                      <div className={styles.cardEffect}>
                        <span className={styles.effectLabel}>Dualist</span>
                        <span className={styles.effectText}>{card.dualistDescription}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {me.hand.length === 0 && (
                <p className={styles.emptyHand}>No cards in hand</p>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
