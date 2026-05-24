"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getPusherClient } from "@/lib/pusher";
import { GameState } from "@/lib/game/state";
import { CARD_MAP } from "@/lib/game/cards";
import styles from "./game.module.css";

type RpsChoice = "rock" | "paper" | "scissors";

const RPS_EMOJI: Record<RpsChoice, string> = {
  rock: "🪨", paper: "📄", scissors: "✂️",
};
const RPS_LABELS: Record<RpsChoice, string> = {
  rock: "Rock", paper: "Paper", scissors: "Scissors",
};

interface PlacedSpell {
  instanceId: string;
  cardId: string;
  x: number; // percent of board width
  y: number; // percent of board height
  playerId: string;
}

export default function GamePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [inspectCard, setInspectCard] = useState<string | null>(null);
  const [inspectSource, setInspectSource] = useState<"hand" | "spell" | "board">("hand");
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // RPS
  const [rpsPhase, setRpsPhase] = useState<"choosing" | "waiting" | "revealing" | "done">("choosing");
  const [rpsMyChoice, setRpsMyChoice] = useState<RpsChoice | null>(null);
  const [rpsOppChoice, setRpsOppChoice] = useState<RpsChoice | null>(null);
  const [rpsWinner, setRpsWinner] = useState<string | "draw" | null>(null);
  const [rpsCountdown, setRpsCountdown] = useState<number | null>(null);
  const acknowledgedRps = useRef(false);

  // Drag
  const [dragCardId, setDragCardId] = useState<string | null>(null);
  const [dragOverDualist, setDragOverDualist] = useState(false);
  const [dragOverBoard, setDragOverBoard] = useState(false);

  // Placed spells on board (visual only — actual game state tracked server-side)
  const [placedSpells, setPlacedSpells] = useState<PlacedSpell[]>([]);
  const [inspectSpell, setInspectSpell] = useState<PlacedSpell | null>(null);

  // Log panel resize
  const [logWidth, setLogWidth] = useState(220);
  const logResizing = useRef(false);
  const logResizeStart = useRef(0);
  const logWidthStart = useRef(220);

  // Inspector panel resize
  const [inspectorWidth, setInspectorWidth] = useState(260);
  const inspResizing = useRef(false);
  const inspResizeStart = useRef(0);
  const inspWidthStart = useRef(260);

  const boardRef = useRef<HTMLDivElement>(null);
  const myUsernameRef = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session").then(r => r.json()).then(data => {
      if (!data.isLoggedIn) { router.push("/"); return; }
      setMyUsername(data.username);
      myUsernameRef.current = data.username;
    });
  }, [router]);

  const fetchState = useCallback(async () => {
    const res = await fetch(`/api/game/state?lobbyId=${id}`);
    if (res.ok) setGameState(await res.json());
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchState(); }, [fetchState]);

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
      if (count > 0) { setRpsCountdown(count); setTimeout(tick, 800); }
      else {
        setRpsCountdown(0); setRpsPhase("done");
        if (state.rpsResult === "draw") {
          setTimeout(() => { setRpsPhase("choosing"); setRpsMyChoice(null); setRpsOppChoice(null); setRpsWinner(null); setRpsCountdown(null); }, 2000);
        } else {
          setTimeout(() => { if (!acknowledgedRps.current) { acknowledgedRps.current = true; sendAction("acknowledge_rps", {}); } }, 2500);
        }
      }
    };
    setTimeout(tick, 800);
  }, [sendAction]);

  useEffect(() => {
    const channel = getPusherClient().subscribe(`game-${id}`);
    channel.bind("state-update", (state: GameState) => {
      setGameState(state);
      if (state.phase === "rps" && state.rpsResult && rpsPhase !== "revealing" && rpsPhase !== "done") runRpsReveal(state);
      if (state.phase === "playing") { setRpsPhase("choosing"); acknowledgedRps.current = false; }
      // Clear placed spells on new round
      if (state.phase === "round_result" || state.phase === "game_over") setPlacedSpells([]);
    });
    return () => { getPusherClient().unsubscribe(`game-${id}`); };
  }, [id, rpsPhase, runRpsReveal]);

  // ── Resize handlers ──────────────────────────────────────────────────────────
  const startLogResize = (e: React.MouseEvent) => {
    logResizing.current = true;
    logResizeStart.current = e.clientX;
    logWidthStart.current = logWidth;
    e.preventDefault();
  };
  const startInspResize = (e: React.MouseEvent) => {
    inspResizing.current = true;
    inspResizeStart.current = e.clientX;
    inspWidthStart.current = inspectorWidth;
    e.preventDefault();
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (logResizing.current) {
        const delta = e.clientX - logResizeStart.current;
        setLogWidth(Math.max(120, Math.min(400, logWidthStart.current + delta)));
      }
      if (inspResizing.current) {
        const delta = inspResizeStart.current - e.clientX;
        setInspectorWidth(Math.max(180, Math.min(420, inspWidthStart.current + delta)));
      }
    };
    const onUp = () => { logResizing.current = false; inspResizing.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  // ── Card actions ─────────────────────────────────────────────────────────────
  const handleRpsClick = (choice: RpsChoice) => {
    if (rpsPhase !== "choosing") return;
    setRpsMyChoice(choice); setRpsPhase("waiting");
    sendAction("rps", { choice });
  };

  const handlePlaySpell = useCallback((cardId: string, dropX?: number, dropY?: number) => {
    sendAction("play_spell", { cardId });
    // Place spell visually on the board
    const x = dropX !== undefined ? dropX : 30 + Math.random() * 40;
    const y = dropY !== undefined ? dropY : 20 + Math.random() * 60;
    setPlacedSpells(prev => [...prev, {
      instanceId: `${cardId}-${Date.now()}`,
      cardId,
      x, y,
      playerId: myUsernameRef.current!,
    }]);
    setSelectedCard(null); setInspectCard(null);
  }, [sendAction]);

  const handlePlaceDualist = useCallback((cardId: string) => {
    sendAction("place_dualist", { cardId });
    setSelectedCard(null); setInspectCard(null);
  }, [sendAction]);

  // ── Drag ────────────────────────────────────────────────────────────────────
  const onDragStart = (cardId: string) => { setDragCardId(cardId); setSelectedCard(cardId); };
  const onDragEnd = () => { setDragCardId(null); setDragOverDualist(false); setDragOverBoard(false); };

  const onDropDualist = () => {
    if (dragCardId) handlePlaceDualist(dragCardId);
    setDragOverDualist(false); setDragCardId(null);
  };

  const onDropBoard = (e: React.DragEvent) => {
    if (!dragCardId || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    handlePlaySpell(dragCardId, x, y);
    setDragOverBoard(false); setDragCardId(null);
  };

  if (loading || !gameState || !myUsername) {
    return (
      <main className={styles.main}>
        <div className={styles.loader}><div className={styles.loaderCard}>✦</div><p>Loading game...</p></div>
      </main>
    );
  }

  const me = gameState.players.find(p => p.id === myUsername);
  const opponent = gameState.players.find(p => p.id !== myUsername);
  if (!me || !opponent) return null;

  const isMyTurn = gameState.activePlayerId === myUsername;
  const phase = gameState.phase;

  // What to show in the inspector
  const activeInspectCardId = inspectSpell ? inspectSpell.cardId : inspectCard;
  const inspectedCardDef = activeInspectCardId ? CARD_MAP[activeInspectCardId] : null;

  return (
    <main className={styles.main}>
      <div className={styles.ambientBg} aria-hidden="true">
        <div className={styles.ambientOrb1} /><div className={styles.ambientOrb2} /><div className={styles.ambientOrb3} />
      </div>

      {/* Score Bar */}
      <header className={styles.scoreBar}>
        <div className={styles.playerScore}>
          <span className={styles.playerScoreName}>{opponent.username}</span>
          <div className={styles.roundPips}>
            {[0,1].map(i => <div key={i} className={`${styles.pip} ${i < opponent.roundsWon ? styles.pipFilled : ""}`} />)}
          </div>
        </div>
        <div className={styles.roundInfo}>
          <span className={styles.roundLabel}>Round</span>
          <span className={styles.roundNum}>{gameState.roundNumber}</span>
          <span className={styles.roundLabel}>of 3</span>
        </div>
        <div className={`${styles.playerScore} ${styles.playerScoreRight}`}>
          <div className={styles.roundPips}>
            {[0,1].map(i => <div key={i} className={`${styles.pip} ${i < me.roundsWon ? styles.pipFilled : ""}`} />)}
          </div>
          <span className={styles.playerScoreName}>You</span>
        </div>
      </header>

      {/* Main layout */}
      <div className={styles.gameLayout} style={{ gridTemplateColumns: `${logWidth}px 1fr ${inspectorWidth}px` }}>

        {/* Log Panel */}
        <aside className={styles.logPanel}>
          <div className={styles.logHeader}><span className={styles.logTitle}>♠ Battle Log</span></div>
          <div className={styles.logScroll}>
            {gameState.eventLog.map((entry, i) => (
              <p key={i} className={`${styles.logLine} ${i === gameState.eventLog.length - 1 ? styles.logLineLatest : ""}`}>{entry}</p>
            ))}
          </div>
          {/* Resize handle */}
          <div className={styles.resizeHandleRight} onMouseDown={startLogResize} />
        </aside>

        {/* Battlefield */}
        <div className={styles.battlefield}>

          {/* RPS */}
          {phase === "rps" && (
            <div className={styles.rpsContainer}>
              <div className={styles.rpsOpponent}>
                <p className={styles.rpsPlayerLabel}>{opponent.username}</p>
                <div className={`${styles.rpsChoiceDisplay} ${rpsPhase === "done" && rpsOppChoice ? styles.rpsChoiceRevealed : ""}`}>
                  {rpsPhase === "done" && rpsOppChoice ? <span className={styles.rpsEmoji}>{RPS_EMOJI[rpsOppChoice]}</span>
                    : opponent.rpsChoice ? <span className={styles.rpsEmojiHidden}>✊</span>
                    : <span className={styles.rpsEmojiWaiting}>···</span>}
                </div>
                <p className={styles.rpsStatusText}>{opponent.rpsChoice ? "Ready!" : "Choosing..."}</p>
              </div>
              <div className={styles.rpsCenter}>
                {rpsPhase === "revealing" && rpsCountdown !== null && rpsCountdown > 0
                  ? <div className={styles.rpsCountdown} key={rpsCountdown}>{rpsCountdown}</div>
                  : rpsPhase === "done"
                  ? <div className={styles.rpsResultBanner}>
                      {rpsWinner === "draw" ? <span className={styles.rpsDrawText}>DRAW!</span>
                        : rpsWinner === myUsername ? <span className={styles.rpsWinText}>YOU WIN!</span>
                        : <span className={styles.rpsLoseText}>THEY WIN!</span>}
                    </div>
                  : <div className={styles.rpsVs}>VS</div>}
              </div>
              <div className={styles.rpsMine}>
                <div className={`${styles.rpsChoiceDisplay} ${rpsMyChoice ? styles.rpsChoiceSelected : ""} ${rpsPhase === "done" && rpsMyChoice ? styles.rpsChoiceRevealed : ""}`}>
                  {rpsMyChoice ? <span className={styles.rpsEmoji}>{RPS_EMOJI[rpsMyChoice]}</span>
                    : <span className={styles.rpsEmojiWaiting}>?</span>}
                </div>
                {rpsPhase === "choosing" && (
                  <div className={styles.rpsButtons}>
                    {(["rock","paper","scissors"] as RpsChoice[]).map(choice => (
                      <button key={choice} className={styles.rpsBtn} onClick={() => handleRpsClick(choice)}>
                        <span className={styles.rpsBtnEmoji}>{RPS_EMOJI[choice]}</span>
                        <span className={styles.rpsBtnLabel}>{RPS_LABELS[choice]}</span>
                      </button>
                    ))}
                  </div>
                )}
                {rpsPhase === "waiting" && <p className={styles.rpsWaitText}>Waiting for opponent...</p>}
                <p className={styles.rpsPlayerLabel}>You</p>
              </div>
            </div>
          )}

          {/* Playing */}
          {(phase === "playing" || phase === "resolution") && (
            <div className={styles.playArea}>

              {/* Opponent strip */}
              <div className={styles.opponentStrip}>
                <div className={styles.opponentInfo}>
                  <span className={styles.stripLabel}>{opponent.username}</span>
                  {opponent.hasPassed && <span className={styles.passedBadge}>Passed</span>}
                </div>
                <div className={styles.opponentHandRow}>
                  {opponent.hand.map((_, i) => (
                    <div key={i} className={styles.opponentCard}><div className={styles.opponentCardInner}>♦</div></div>
                  ))}
                  {opponent.hand.length === 0 && <span className={styles.emptyHandNote}>No cards</span>}
                </div>
                {/* Opponent dualist */}
                <div className={styles.opponentDualistSlot}>
                  <span className={styles.dualistSlotLabel}>Dualist</span>
                  <div className={`${styles.dualistCard} ${opponent.dualist ? styles.dualistCardFilled : styles.dualistCardEmpty}`}>
                    {opponent.dualist ? (
                      phase === "resolution" ? (
                        <div className={styles.dualistCardInner}>
                          <span className={styles.dualistCardSuit}>♦</span>
                          <span className={styles.dualistCardName}>{CARD_MAP[opponent.dualist]?.name}</span>
                          <span className={styles.dualistCardPower}>{opponent.dualistPower}</span>
                        </div>
                      ) : (
                        <div className={styles.dualistCardInner}>
                          <span className={styles.dualistCardBack}>?</span>
                        </div>
                      )
                    ) : <span className={styles.dualistCardPlaceholder}>—</span>}
                  </div>
                </div>
              </div>

              {/* Turn badge */}
              <div className={styles.turnRow}>
                <div className={styles.centerLine} />
                <div className={`${styles.turnBadge} ${isMyTurn ? styles.turnBadgeMine : styles.turnBadgeOpp}`}>
                  {phase === "resolution" ? "⚔ Resolving" : isMyTurn ? "Your Turn" : `${opponent.username}'s Turn`}
                </div>
                <div className={styles.centerLine} />
              </div>

              {/* Main play board */}
              <div className={styles.boardAndDualist}>

                {/* My dualist slot — card shaped */}
                <div className={styles.myDualistArea}>
                  <span className={styles.dualistSlotLabel}>Your Dualist</span>
                  <div
                    className={`
                      ${styles.dualistCard}
                      ${me.dualist ? styles.dualistCardFilled : styles.dualistCardEmpty}
                      ${dragOverDualist && !me.dualist ? styles.dualistCardDragOver : ""}
                      ${!me.dualist && isMyTurn && phase === "playing" ? styles.dualistCardActive : ""}
                    `}
                    onDragOver={e => { e.preventDefault(); if (!me.dualist) setDragOverDualist(true); }}
                    onDragLeave={() => setDragOverDualist(false)}
                    onDrop={e => { e.preventDefault(); onDropDualist(); }}
                    onClick={() => { if (selectedCard && isMyTurn && !me.dualist && phase === "playing") handlePlaceDualist(selectedCard); }}
                  >
                    {me.dualist ? (
                      <div className={styles.dualistCardInner}>
                        <span className={styles.dualistCardSuit}>♦</span>
                        <span className={styles.dualistCardName}>{CARD_MAP[me.dualist]?.name}</span>
                        <span className={styles.dualistCardPower}>{me.dualistPower}</span>
                        <span className={styles.dualistCardEffectText}>{CARD_MAP[me.dualist]?.dualistDescription}</span>
                      </div>
                    ) : (
                      <div className={styles.dualistCardInner}>
                        <span className={styles.dualistCardSuit} style={{ opacity: 0.15 }}>♦</span>
                        <span className={styles.dualistDropHint}>
                          {!isMyTurn || phase !== "playing" ? "No Dualist"
                            : dragOverDualist ? "Drop here"
                            : selectedCard ? "Click to place"
                            : "Drag or select"}
                        </span>
                      </div>
                    )}
                  </div>
                  {me.hasPassed && <span className={styles.passedBadge}>Passed</span>}
                </div>

                {/* Open spell board */}
                <div
                  ref={boardRef}
                  className={`${styles.spellBoard} ${dragOverBoard ? styles.spellBoardDragOver : ""} ${isMyTurn && phase === "playing" ? styles.spellBoardActive : ""}`}
                  onDragOver={e => { e.preventDefault(); setDragOverBoard(true); }}
                  onDragLeave={() => setDragOverBoard(false)}
                  onDrop={e => { e.preventDefault(); onDropBoard(e); }}
                  onClick={e => {
                    // Click on empty board area with selected card = cast spell at that position
                    if (!selectedCard || !isMyTurn || phase !== "playing") return;
                    if ((e.target as HTMLElement).closest(`.${styles.spellToken}`)) return;
                    const rect = boardRef.current!.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    handlePlaySpell(selectedCard, x, y);
                  }}
                >
                  {/* Hint text */}
                  {isMyTurn && phase === "playing" && placedSpells.filter(s => s.playerId === myUsername).length === 0 && (
                    <div className={styles.boardHint}>
                      {dragOverBoard
                        ? <span className={styles.boardHintDrop}>Release to cast spell</span>
                        : <span className={styles.boardHintText}>Drag cards here or click to cast spells</span>}
                    </div>
                  )}

                  {/* Placed spell tokens */}
                  {placedSpells.map(spell => {
                    const card = CARD_MAP[spell.cardId];
                    const isMine = spell.playerId === myUsername;
                    const isInspected = inspectSpell?.instanceId === spell.instanceId;
                    return (
                      <div
                        key={spell.instanceId}
                        className={`${styles.spellToken} ${isMine ? styles.spellTokenMine : styles.spellTokenOpp} ${isInspected ? styles.spellTokenInspected : ""}`}
                        style={{ left: `${spell.x}%`, top: `${spell.y}%` }}
                        onClick={e => {
                          e.stopPropagation();
                          setInspectSpell(isInspected ? null : spell);
                          setInspectCard(null);
                        }}
                      >
                        {/* Future: replace with card image */}
                        <div className={styles.spellTokenArt}>{card?.name[0] ?? "?"}</div>
                        <div className={styles.spellTokenLabel}>{card?.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons */}
              {isMyTurn && phase === "playing" && (
                <div className={styles.actionRow}>
                  {selectedCard && (
                    <>
                      {!me.dualist && (
                        <button className={styles.dualistBtn} onClick={() => handlePlaceDualist(selectedCard)}>
                          ⚔ Place as Dualist
                        </button>
                      )}
                      <button className={styles.spellBtn} onClick={() => handlePlaySpell(selectedCard)}>
                        ✦ Cast as Spell
                      </button>
                    </>
                  )}
                  <button className={styles.passBtn} onClick={() => sendAction("pass")}>Pass Turn</button>
                </div>
              )}
            </div>
          )}

          {/* Round result */}
          {phase === "round_result" && (
            <div className={styles.resultOverlay}>
              <div className={styles.resultCard}>
                <div className={styles.resultSuits}>♠ ♥ ♦ ♣</div>
                <div className={styles.resultIcon}>{gameState.lastRoundWinner === myUsername ? "🏆" : gameState.lastRoundWinner === "draw" ? "🤝" : "💀"}</div>
                <h2 className={styles.resultTitle}>{gameState.lastRoundWinner === myUsername ? "Round Victory!" : gameState.lastRoundWinner === "draw" ? "Round Draw" : "Round Lost"}</h2>
                <div className={styles.resultPowers}>
                  <div className={styles.resultPowerBox}><span className={styles.resultPowerName}>{me.username}</span><span className={styles.resultPowerValue}>{me.dualistPower}</span></div>
                  <span className={styles.resultPowerVs}>vs</span>
                  <div className={styles.resultPowerBox}><span className={styles.resultPowerName}>{opponent.username}</span><span className={styles.resultPowerValue}>{opponent.dualistPower}</span></div>
                </div>
                <button className={styles.nextRoundBtn} onClick={() => { sendAction("next_round"); setPlacedSpells([]); }}>Next Round →</button>
              </div>
            </div>
          )}

          {/* Game over */}
          {phase === "game_over" && (
            <div className={styles.resultOverlay}>
              <div className={styles.resultCard}>
                <div className={styles.resultSuits}>♠ ♥ ♦ ♣</div>
                <div className={styles.resultIcon}>{gameState.matchWinner === myUsername ? "👑" : "💀"}</div>
                <h2 className={styles.resultTitle}>{gameState.matchWinner === myUsername ? "Victory!" : "Defeat"}</h2>
                <p className={styles.resultSubtitle}>{gameState.matchWinner === myUsername ? "You have mastered TryllePap!" : `${opponent.username} wins the match.`}</p>
                <div className={styles.resultPowers}>
                  <div className={styles.resultPowerBox}><span className={styles.resultPowerName}>{me.username}</span><span className={styles.resultPowerValue}>{me.roundsWon} rounds</span></div>
                  <span className={styles.resultPowerVs}>vs</span>
                  <div className={styles.resultPowerBox}><span className={styles.resultPowerName}>{opponent.username}</span><span className={styles.resultPowerValue}>{opponent.roundsWon} rounds</span></div>
                </div>
                <button className={styles.nextRoundBtn} onClick={() => router.push("/lobby")}>Return to Hall</button>
              </div>
            </div>
          )}
        </div>

        {/* Inspector panel */}
        <aside className={`${styles.inspectorPanel} ${inspectedCardDef ? styles.inspectorVisible : ""}`}>
          {/* Resize handle */}
          <div className={styles.resizeHandleLeft} onMouseDown={startInspResize} />

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
                {isMyTurn && phase === "playing" && !inspectSpell && (
                  <div className={styles.inspectorActions}>
                    {!me.dualist && (
                      <button className={styles.inspectorDualistBtn} onClick={() => handlePlaceDualist(inspectCard!)}>Place as Dualist</button>
                    )}
                    <button className={styles.inspectorSpellBtn} onClick={() => handlePlaySpell(inspectCard!)}>Cast as Spell</button>
                  </div>
                )}
                {inspectSpell && (
                  <p className={styles.inspectorSpellNote}>This spell was cast on the board.</p>
                )}
              </div>
              <button className={styles.inspectorClose} onClick={() => { setInspectCard(null); setInspectSpell(null); }}>✕</button>
            </div>
          ) : (
            <div className={styles.inspectorEmpty}>
              <span className={styles.inspectorEmptyIcon}>♦</span>
              <p>Click a card or<br />spell to inspect</p>
            </div>
          )}
        </aside>
      </div>

      {/* Hand */}
      {(phase === "playing" || phase === "rps") && (
        <div className={styles.handSection}>
          <div className={styles.handLabel}>
            Your Hand <span className={styles.handCount}>{me.hand.length} cards</span>
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
                  className={`${styles.handCard} ${isSelected ? styles.handCardSelected : ""} ${isInspected ? styles.handCardInspected : ""} ${disabled ? styles.handCardDisabled : ""}`}
                  style={{ "--card-index": i } as React.CSSProperties}
                  draggable={!disabled}
                  onDragStart={() => onDragStart(cardId)}
                  onDragEnd={onDragEnd}
                  onClick={() => {
                    setInspectCard(isInspected ? null : cardId);
                    setInspectSpell(null);
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
