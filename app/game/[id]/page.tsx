"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getPusherClient } from "@/lib/pusher";
import { GameState } from "@/lib/game/state";
import { CARD_MAP } from "@/lib/game/cards";
import styles from "./game.module.css";

type RpsChoice = "rock" | "paper" | "scissors";

const RPS_EMOJI: Record<RpsChoice, string> = {
  rock: "🪨",
  paper: "📄",
  scissors: "✂️",
};

const RPS_LABELS: Record<RpsChoice, string> = {
  rock: "Rock",
  paper: "Paper",
  scissors: "Scissors",
};

export default function GamePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [inspectCard, setInspectCard] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // RPS animation state
  const [rpsPhase, setRpsPhase] = useState<"choosing" | "waiting" | "revealing" | "done">("choosing");
  const [rpsMyChoice, setRpsMyChoice] = useState<RpsChoice | null>(null);
  const [rpsOppChoice, setRpsOppChoice] = useState<RpsChoice | null>(null);
  const [rpsWinner, setRpsWinner] = useState<string | "draw" | null>(null);
  const [rpsCountdown, setRpsCountdown] = useState<number | null>(null);
  const acknowledgedRps = useRef(false);

  // Drag state
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dragOverDualist, setDragOverDualist] = useState(false);
  const [dragOverSpell, setDragOverSpell] = useState(false);

  // Spell cast animation
  const [castingSpell, setCastingSpell] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const myUsernameRef = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(data => {
        if (!data.isLoggedIn) { router.push("/"); return; }
        setMyUsername(data.username);
        myUsernameRef.current = data.username;
      });
  }, [router]);

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/game/state?lobbyId=${id}`);
    if (res.ok) {
      const data = await res.json();
      setGameState(data);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchState(); }, [fetchState]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [gameState?.eventLog]);

  const sendAction = useCallback(async (action: string, payload: object = {}) => {
    await fetch("/api/game/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lobbyId: id, action, payload }),
    });
  }, [id]);

  const runRpsReveal = useCallback((state: GameState) => {
    const me = myUsernameRef.current;
    if (!me) return;
    const opp = state.players.find(p => p.id !== me);
    if (!opp) return;

    setRpsOppChoice(opp.rpsChoice);
    setRpsWinner(state.rpsResult === "draw" ? "draw" : state.rpsResult || null);
    setRpsPhase("revealing");

    let count = 3;
    setRpsCountdown(count);

    const tick = () => {
      count--;
      if (count > 0) {
        setRpsCountdown(count);
        setTimeout(tick, 800);
      } else {
        setRpsCountdown(0);
        setRpsPhase("done");

        if (state.rpsResult === "draw") {
          setTimeout(() => {
            setRpsPhase("choosing");
            setRpsMyChoice(null);
            setRpsOppChoice(null);
            setRpsWinner(null);
            setRpsCountdown(null);
          }, 2000);
        } else {
          setTimeout(() => {
            if (!acknowledgedRps.current) {
              acknowledgedRps.current = true;
              sendAction("acknowledge_rps", {});
            }
          }, 2500);
        }
      }
    };
    setTimeout(tick, 800);
  }, [sendAction]);

  useEffect(() => {
    const channel = getPusherClient().subscribe(`game-${id}`);
    channel.bind("state-update", (state: GameState) => {
      setGameState(state);
      if (state.phase === "rps" && state.rpsResult && rpsPhase !== "revealing" && rpsPhase !== "done") {
        runRpsReveal(state);
      }
      if (state.phase === "playing") {
        setRpsPhase("choosing");
        acknowledgedRps.current = false;
      }
    });
    return () => { getPusherClient().unsubscribe(`game-${id}`); };
  }, [id, rpsPhase, runRpsReveal]);

  const handleRpsClick = (choice: RpsChoice) => {
    if (rpsPhase !== "choosing") return;
    setRpsMyChoice(choice);
    setRpsPhase("waiting");
    sendAction("rps", { choice });
  };

  const handlePlaySpell = useCallback((cardId: string) => {
    setCastingSpell(true);
    setTimeout(() => setCastingSpell(false), 600);
    sendAction("play_spell", { cardId });
    setSelectedCard(null);
    setInspectCard(null);
  }, [sendAction]);

  const handlePlaceDualist = useCallback((cardId: string) => {
    sendAction("place_dualist", { cardId });
    setSelectedCard(null);
    setInspectCard(null);
  }, [sendAction]);

  const onDragStart = (cardId: string) => { setDragCardId(cardId); setSelectedCard(cardId); };
  const onDragEnd = () => { setDragCardId(null); setDragOverDualist(false); setDragOverSpell(false); };

  const onDropDualist = () => {
    if (dragCardId) handlePlaceDualist(dragCardId);
    setDragOverDualist(false);
    setDragCardId(null);
  };

  const onDropSpell = () => {
    if (dragCardId) handlePlaySpell(dragCardId);
    setDragOverSpell(false);
    setDragCardId(null);
  };

  if (loading || !gameState || !myUsername) {
    return (
      <main className={styles.main}>
        <div className={styles.loader}>
          <div className={styles.loaderCard}>✦</div>
          <p>Loading game...</p>
        </div>
      </main>
    );
  }

  const me = gameState.players.find(p => p.id === myUsername);
  const opponent = gameState.players.find(p => p.id !== myUsername);
  if (!me || !opponent) return null;

  const isMyTurn = gameState.activePlayerId === myUsername;
  const phase = gameState.phase;
  const inspectedCardDef = inspectCard ? CARD_MAP[inspectCard] : null;

  return (
    <main className={styles.main}>
      <div className={styles.ambientBg} aria-hidden="true">
        <div className={styles.ambientOrb1} />
        <div className={styles.ambientOrb2} />
        <div className={styles.ambientOrb3} />
      </div>

      {/* ── Score Bar ── */}
      <header className={styles.scoreBar}>
        <div className={styles.playerScore}>
          <span className={styles.playerScoreName}>{opponent.username}</span>
          <div className={styles.roundPips}>
            {[0,1].map(i => (
              <div key={i} className={`${styles.pip} ${i < opponent.roundsWon ? styles.pipFilled : ""}`} />
            ))}
          </div>
        </div>
        <div className={styles.roundInfo}>
          <span className={styles.roundLabel}>Round</span>
          <span className={styles.roundNum}>{gameState.roundNumber}</span>
          <span className={styles.roundLabel}>of 3</span>
        </div>
        <div className={`${styles.playerScore} ${styles.playerScoreRight}`}>
          <div className={styles.roundPips}>
            {[0,1].map(i => (
              <div key={i} className={`${styles.pip} ${i < me.roundsWon ? styles.pipFilled : ""}`} />
            ))}
          </div>
          <span className={styles.playerScoreName}>You</span>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className={styles.gameLayout}>

        {/* LEFT: Log */}
        <aside className={styles.logPanel}>
          <div className={styles.logHeader}>
            <span className={styles.logTitle}>♠ Battle Log</span>
          </div>
          <div className={styles.logScroll} ref={logRef}>
            {gameState.eventLog.map((entry, i) => (
              <p key={i} className={`${styles.logLine} ${i === gameState.eventLog.length - 1 ? styles.logLineLatest : ""}`}>
                {entry}
              </p>
            ))}
          </div>
        </aside>

        {/* CENTER: Battlefield */}
        <div className={styles.battlefield}>

          {/* RPS Phase */}
          {phase === "rps" && (
            <div className={styles.rpsContainer}>
              <div className={styles.rpsOpponent}>
                <p className={styles.rpsPlayerLabel}>{opponent.username}</p>
                <div className={`${styles.rpsChoiceDisplay} ${rpsPhase === "done" && rpsOppChoice ? styles.rpsChoiceRevealed : ""}`}>
                  {rpsPhase === "done" && rpsOppChoice ? (
                    <span className={styles.rpsEmoji}>{RPS_EMOJI[rpsOppChoice]}</span>
                  ) : opponent.rpsChoice ? (
                    <span className={styles.rpsEmojiHidden}>✊</span>
                  ) : (
                    <span className={styles.rpsEmojiWaiting}>···</span>
                  )}
                </div>
                <p className={styles.rpsStatusText}>
                  {opponent.rpsChoice ? "Ready!" : "Choosing..."}
                </p>
              </div>

              <div className={styles.rpsCenter}>
                {rpsPhase === "revealing" && rpsCountdown !== null && rpsCountdown > 0 ? (
                  <div className={styles.rpsCountdown} key={rpsCountdown}>{rpsCountdown}</div>
                ) : rpsPhase === "done" ? (
                  <div className={styles.rpsResultBanner}>
                    {rpsWinner === "draw" ? (
                      <span className={styles.rpsDrawText}>DRAW!</span>
                    ) : rpsWinner === myUsername ? (
                      <span className={styles.rpsWinText}>YOU WIN!</span>
                    ) : (
                      <span className={styles.rpsLoseText}>THEY WIN!</span>
                    )}
                  </div>
                ) : (
                  <div className={styles.rpsVs}>VS</div>
                )}
              </div>

              <div className={styles.rpsMine}>
                <div className={`${styles.rpsChoiceDisplay} ${rpsMyChoice ? styles.rpsChoiceSelected : ""} ${rpsPhase === "done" && rpsMyChoice ? styles.rpsChoiceRevealed : ""}`}>
                  {rpsMyChoice ? (
                    <span className={styles.rpsEmoji}>{RPS_EMOJI[rpsMyChoice]}</span>
                  ) : (
                    <span className={styles.rpsEmojiWaiting}>?</span>
                  )}
                </div>
                {rpsPhase === "choosing" && (
                  <div className={styles.rpsButtons}>
                    {(["rock", "paper", "scissors"] as RpsChoice[]).map(choice => (
                      <button key={choice} className={styles.rpsBtn} onClick={() => handleRpsClick(choice)}>
                        <span className={styles.rpsBtnEmoji}>{RPS_EMOJI[choice]}</span>
                        <span className={styles.rpsBtnLabel}>{RPS_LABELS[choice]}</span>
                      </button>
                    ))}
                  </div>
                )}
                {rpsPhase === "waiting" && (
                  <p className={styles.rpsWaitText}>Waiting for opponent...</p>
                )}
                <p className={styles.rpsPlayerLabel}>You</p>
              </div>
            </div>
          )}

          {/* Playing / Resolution */}
          {(phase === "playing" || phase === "resolution") && (
            <div className={styles.playArea}>

              {/* Opponent side */}
              <div className={styles.opponentSide}>
                <div className={styles.sideLabel}>{opponent.username}</div>
                <div className={styles.opponentHand}>
                  {opponent.hand.map((_, i) => (
                    <div key={i} className={styles.opponentCard}>
                      <div className={styles.opponentCardInner}>♦</div>
                    </div>
                  ))}
                  {opponent.hand.length === 0 && <span className={styles.emptyHandNote}>No cards</span>}
                </div>
                <div className={styles.dualistRow}>
                  <span className={styles.dualistRowLabel}>Dualist</span>
                  <div className={`${styles.dualistZone} ${opponent.dualist ? styles.dualistZoneFilled : ""}`}>
                    {opponent.dualist ? (
                      phase === "resolution" ? (
                        <div className={styles.dualistCardRevealed}>
                          <span className={styles.dualistCardName}>{CARD_MAP[opponent.dualist]?.name}</span>
                          <span className={styles.dualistCardPower}>{opponent.dualistPower}</span>
                        </div>
                      ) : (
                        <div className={styles.dualistCardFaceDown}><span>?</span></div>
                      )
                    ) : (
                      <span className={styles.dualistEmpty}>—</span>
                    )}
                  </div>
                  {opponent.hasPassed && <span className={styles.passedBadge}>Passed</span>}
                </div>
              </div>

              {/* Center divider */}
              <div className={styles.centerDivider}>
                <div className={styles.centerLine} />
                <div className={`${styles.turnBadge} ${isMyTurn ? styles.turnBadgeMine : styles.turnBadgeOpp}`}>
                  {phase === "resolution" ? "⚔ Resolving"
                    : isMyTurn ? "Your Turn"
                    : `${opponent.username}'s Turn`}
                </div>
                <div className={styles.centerLine} />
              </div>

              {/* My side */}
              <div className={styles.mySide}>
                <div className={styles.dualistRow}>
                  <span className={styles.dualistRowLabel}>Your Dualist</span>
                  <div
                    className={`
                      ${styles.dualistZone}
                      ${me.dualist ? styles.dualistZoneFilled : ""}
                      ${dragOverDualist && !me.dualist ? styles.dualistZoneDragOver : ""}
                      ${!me.dualist && isMyTurn ? styles.dualistZoneActive : ""}
                    `}
                    onDragOver={e => { e.preventDefault(); if (!me.dualist) setDragOverDualist(true); }}
                    onDragLeave={() => setDragOverDualist(false)}
                    onDrop={e => { e.preventDefault(); onDropDualist(); }}
                    onClick={() => {
                      if (selectedCard && isMyTurn && !me.dualist) handlePlaceDualist(selectedCard);
                    }}
                  >
                    {me.dualist ? (
                      <div className={styles.dualistCardPlaced}>
                        <span className={styles.dualistCardName}>{CARD_MAP[me.dualist]?.name}</span>
                        <span className={styles.dualistCardPower}>{me.dualistPower}</span>
                        <span className={styles.dualistCardEffect}>{CARD_MAP[me.dualist]?.dualistDescription}</span>
                      </div>
                    ) : (
                      <div className={styles.dualistDropHint}>
                        {isMyTurn
                          ? dragOverDualist ? "Drop to place"
                          : selectedCard ? "Click to place as Dualist"
                          : "Drag or select a card"
                          : "No Dualist placed"}
                      </div>
                    )}
                  </div>
                  {me.hasPassed && <span className={styles.passedBadge}>Passed</span>}
                </div>

                {isMyTurn && phase === "playing" && (
                  <div
                    className={`${styles.spellZone} ${dragOverSpell ? styles.spellZoneDragOver : ""}`}
                    onDragOver={e => { e.preventDefault(); setDragOverSpell(true); }}
                    onDragLeave={() => setDragOverSpell(false)}
                    onDrop={e => { e.preventDefault(); onDropSpell(); }}
                    onClick={() => { if (selectedCard) handlePlaySpell(selectedCard); }}
                  >
                    <span className={styles.spellZoneIcon}>{castingSpell ? "✨" : "✦"}</span>
                    <span className={styles.spellZoneText}>
                      {dragOverSpell ? "Release to cast"
                        : selectedCard ? "Click to cast as Spell"
                        : "Drag here to cast a Spell"}
                    </span>
                  </div>
                )}

                {isMyTurn && phase === "playing" && (
                  <div className={styles.actionRow}>
                    <button className={styles.passBtn} onClick={() => sendAction("pass")}>
                      Pass Turn
                    </button>
                  </div>
                )}
                <div className={styles.sideLabel}>You</div>
              </div>
            </div>
          )}

          {/* Round Result */}
          {phase === "round_result" && (
            <div className={styles.resultOverlay}>
              <div className={styles.resultCard}>
                <div className={styles.resultSuits} aria-hidden="true">♠ ♥ ♦ ♣</div>
                <div className={styles.resultIcon}>
                  {gameState.lastRoundWinner === myUsername ? "🏆"
                    : gameState.lastRoundWinner === "draw" ? "🤝" : "💀"}
                </div>
                <h2 className={styles.resultTitle}>
                  {gameState.lastRoundWinner === myUsername ? "Round Victory!"
                    : gameState.lastRoundWinner === "draw" ? "Round Draw"
                    : "Round Lost"}
                </h2>
                <div className={styles.resultPowers}>
                  <div className={styles.resultPowerBox}>
                    <span className={styles.resultPowerName}>{me.username}</span>
                    <span className={styles.resultPowerValue}>{me.dualistPower}</span>
                  </div>
                  <span className={styles.resultPowerVs}>vs</span>
                  <div className={styles.resultPowerBox}>
                    <span className={styles.resultPowerName}>{opponent.username}</span>
                    <span className={styles.resultPowerValue}>{opponent.dualistPower}</span>
                  </div>
                </div>
                <button className={styles.nextRoundBtn} onClick={() => sendAction("next_round")}>
                  Next Round →
                </button>
              </div>
            </div>
          )}

          {/* Game Over */}
          {phase === "game_over" && (
            <div className={styles.resultOverlay}>
              <div className={styles.resultCard}>
                <div className={styles.resultSuits} aria-hidden="true">♠ ♥ ♦ ♣</div>
                <div className={styles.resultIcon}>
                  {gameState.matchWinner === myUsername ? "👑" : "💀"}
                </div>
                <h2 className={styles.resultTitle}>
                  {gameState.matchWinner === myUsername ? "Victory!" : "Defeat"}
                </h2>
                <p className={styles.resultSubtitle}>
                  {gameState.matchWinner === myUsername
                    ? "You have mastered TryllePap!"
                    : `${opponent.username} wins the match.`}
                </p>
                <div className={styles.resultPowers}>
                  <div className={styles.resultPowerBox}>
                    <span className={styles.resultPowerName}>{me.username}</span>
                    <span className={styles.resultPowerValue}>{me.roundsWon} rounds</span>
                  </div>
                  <span className={styles.resultPowerVs}>vs</span>
                  <div className={styles.resultPowerBox}>
                    <span className={styles.resultPowerName}>{opponent.username}</span>
                    <span className={styles.resultPowerValue}>{opponent.roundsWon} rounds</span>
                  </div>
                </div>
                <button className={styles.nextRoundBtn} onClick={() => router.push("/lobby")}>
                  Return to Hall
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Card Inspector */}
        <aside className={`${styles.inspectorPanel} ${inspectCard ? styles.inspectorVisible : ""}`}>
          {inspectedCardDef ? (
            <div className={styles.inspectorCard}>
              <div className={styles.inspectorImageSlot}>
                <span className={styles.inspectorImagePlaceholder}>{inspectedCardDef.name[0]}</span>
                <span className={styles.inspectorImageNote}>Card art coming soon</span>
              </div>
              <div className={styles.inspectorBody}>
                <div className={styles.inspectorHeader}>
                  <h3 className={styles.inspectorName}>{inspectedCardDef.name}</h3>
                  <span className={styles.inspectorPower}>{inspectedCardDef.basePower}</span>
                </div>
                <div className={styles.inspectorDivider} />
                <div className={styles.inspectorEffect}>
                  <span className={styles.inspectorEffectLabel}>✦ Spell Effect</span>
                  <p className={styles.inspectorEffectText}>{inspectedCardDef.spellDescription}</p>
                </div>
                <div className={styles.inspectorEffect}>
                  <span className={styles.inspectorEffectLabel}>⚔ Dualist Effect</span>
                  <p className={styles.inspectorEffectText}>{inspectedCardDef.dualistDescription}</p>
                </div>
                {isMyTurn && phase === "playing" && (
                  <div className={styles.inspectorActions}>
                    {!me.dualist && (
                      <button className={styles.inspectorDualistBtn} onClick={() => handlePlaceDualist(inspectCard!)}>
                        Place as Dualist
                      </button>
                    )}
                    <button className={styles.inspectorSpellBtn} onClick={() => handlePlaySpell(inspectCard!)}>
                      Cast as Spell
                    </button>
                  </div>
                )}
              </div>
              <button className={styles.inspectorClose} onClick={() => setInspectCard(null)}>✕</button>
            </div>
          ) : (
            <div className={styles.inspectorEmpty}>
              <span className={styles.inspectorEmptyIcon}>♦</span>
              <p>Click a card<br />to inspect it</p>
            </div>
          )}
        </aside>
      </div>

      {/* Hand */}
      {(phase === "playing" || phase === "rps") && (
        <div className={styles.handSection}>
          <div className={styles.handLabel}>
            Your Hand
            <span className={styles.handCount}>{me.hand.length} cards</span>
          </div>
          <div className={styles.hand}>
            {me.hand.map((cardId, i) => {
              const card = CARD_MAP[cardId];
              if (!card) return null;
              const isSelected = selectedCard === cardId;
              const isInspected = inspectCard === cardId;
              const disabled = !isMyTurn || phase !== "playing";
              return (
                <div
                  key={`${cardId}-${i}`}
                  className={`
                    ${styles.handCard}
                    ${isSelected ? styles.handCardSelected : ""}
                    ${isInspected ? styles.handCardInspected : ""}
                    ${disabled ? styles.handCardDisabled : ""}
                  `}
                  style={{ "--card-index": i } as React.CSSProperties}
                  draggable={!disabled}
                  onDragStart={() => onDragStart(cardId)}
                  onDragEnd={onDragEnd}
                  onClick={() => {
                    setInspectCard(isInspected ? null : cardId);
                    if (!disabled) setSelectedCard(isSelected ? null : cardId);
                  }}
                >
                  <div className={styles.handCardGlow} />
                  <div className={styles.handCardTop}>
                    <span className={styles.handCardName}>{card.name}</span>
                    <span className={styles.handCardPower}>{card.basePower}</span>
                  </div>
                  <div className={styles.handCardSuit}>♦</div>
                  <div className={styles.handCardBottom}>
                    <div className={styles.handCardEffectRow}>
                      <span className={styles.handCardEffectTag}>Spell</span>
                      <span className={styles.handCardEffectDesc}>{card.spellDescription}</span>
                    </div>
                    <div className={styles.handCardEffectRow}>
                      <span className={styles.handCardEffectTag}>Dualist</span>
                      <span className={styles.handCardEffectDesc}>{card.dualistDescription}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {me.hand.length === 0 && <p className={styles.emptyHand}>No cards in hand</p>}
          </div>
        </div>
      )}
    </main>
  );
}
