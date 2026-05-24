"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getPusherClient } from "@/lib/pusher";
import { GameState } from "@/lib/game/state";
import { CARD_MAP } from "@/lib/game/cards";
import styles from "./game.module.css";

type RpsChoice = "rock" | "paper" | "scissors";
const RPS_EMOJI: Record<RpsChoice, string> = { rock: "🪨", paper: "📄", scissors: "✂️" };
const RPS_LABELS: Record<RpsChoice, string> = { rock: "Rock", paper: "Paper", scissors: "Scissors" };

interface PlacedSpell {
  instanceId: string;
  cardId: string;
  x: number;
  y: number;
  playerId: string;
}

export default function GamePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [inspectCard, setInspectCard] = useState<string | null>(null);
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
  const [dragOverMyBoard, setDragOverMyBoard] = useState(false);

  // Placed spells
  const [placedSpells, setPlacedSpells] = useState<PlacedSpell[]>([]);
  const [inspectSpell, setInspectSpell] = useState<PlacedSpell | null>(null);

  // Log resize
  const [logWidth, setLogWidth] = useState(200);
  const logResizing = useRef(false);
  const logResizeStart = useRef(0);
  const logWidthStart = useRef(200);

  // Inspector resize
  const [inspectorWidth, setInspectorWidth] = useState(240);
  const inspResizing = useRef(false);
  const inspResizeStart = useRef(0);
  const inspWidthStart = useRef(240);

  const myBoardRef = useRef<HTMLDivElement>(null);
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
      if (state.phase === "round_result" || state.phase === "game_over") setPlacedSpells([]);
    });
    return () => { getPusherClient().unsubscribe(`game-${id}`); };
  }, [id, rpsPhase, runRpsReveal]);

  // Resize
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (logResizing.current) setLogWidth(Math.max(120, Math.min(360, logWidthStart.current + (e.clientX - logResizeStart.current))));
      if (inspResizing.current) setInspectorWidth(Math.max(160, Math.min(400, inspWidthStart.current + (inspResizeStart.current - e.clientX))));
    };
    const onUp = () => { logResizing.current = false; inspResizing.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const handleRpsClick = (choice: RpsChoice) => {
    if (rpsPhase !== "choosing") return;
    setRpsMyChoice(choice); setRpsPhase("waiting");
    sendAction("rps", { choice });
  };

  const handlePlaySpell = useCallback((cardId: string, dropX?: number, dropY?: number) => {
    sendAction("play_spell", { cardId });
    const x = dropX !== undefined ? dropX : 20 + Math.random() * 60;
    const y = dropY !== undefined ? dropY : 15 + Math.random() * 70;
    setPlacedSpells(prev => [...prev, {
      instanceId: `${cardId}-${Date.now()}`,
      cardId, x, y,
      playerId: myUsernameRef.current!,
    }]);
    setSelectedCard(null); setInspectCard(null);
  }, [sendAction]);

  const handlePlaceDualist = useCallback((cardId: string) => {
    sendAction("place_dualist", { cardId });
    setSelectedCard(null); setInspectCard(null);
  }, [sendAction]);

  const onDragStart = (cardId: string) => { setDragCardId(cardId); setSelectedCard(cardId); };
  const onDragEnd = () => { setDragCardId(null); setDragOverDualist(false); setDragOverMyBoard(false); };

  const onDropDualist = () => {
    if (dragCardId) handlePlaceDualist(dragCardId);
    setDragOverDualist(false); setDragCardId(null);
  };

  const onDropMyBoard = (e: React.DragEvent) => {
    if (!dragCardId || !myBoardRef.current) return;
    const rect = myBoardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    handlePlaySpell(dragCardId, x, y);
    setDragOverMyBoard(false); setDragCardId(null);
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

  const activeInspectCardId = inspectSpell ? inspectSpell.cardId : inspectCard;
  const inspectedCardDef = activeInspectCardId ? CARD_MAP[activeInspectCardId] : null;

  // Spells split by side
  const mySpells = placedSpells.filter(s => s.playerId === myUsername);
  const oppSpells = placedSpells.filter(s => s.playerId !== myUsername);

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

      {/* Main layout: log | field | inspector */}
      <div
        className={styles.gameLayout}
        style={{ gridTemplateColumns: `${logWidth}px 1fr ${inspectorWidth}px` }}
      >
        {/* Log */}
        <aside className={styles.logPanel}>
          <div className={styles.logHeader}><span className={styles.logTitle}>♠ Battle Log</span></div>
          <div className={styles.logScroll}>
            {gameState.eventLog.map((e, i) => (
              <p key={i} className={`${styles.logLine} ${i === gameState.eventLog.length - 1 ? styles.logLineLatest : ""}`}>{e}</p>
            ))}
          </div>
          <div className={styles.resizeHandleRight} onMouseDown={e => { logResizing.current = true; logResizeStart.current = e.clientX; logWidthStart.current = logWidth; e.preventDefault(); }} />
        </aside>

        {/* Battlefield */}
        <div className={styles.battlefield}>

          {/* ── RPS ── */}
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
                    {(["rock","paper","scissors"] as RpsChoice[]).map(c => (
                      <button key={c} className={styles.rpsBtn} onClick={() => handleRpsClick(c)}>
                        <span className={styles.rpsBtnEmoji}>{RPS_EMOJI[c]}</span>
                        <span className={styles.rpsBtnLabel}>{RPS_LABELS[c]}</span>
                      </button>
                    ))}
                  </div>
                )}
                {rpsPhase === "waiting" && <p className={styles.rpsWaitText}>Waiting for opponent...</p>}
                <p className={styles.rpsPlayerLabel}>You</p>
              </div>
            </div>
          )}

          {/* ── Playing field ── */}
          {(phase === "playing" || phase === "resolution") && (
            <div className={styles.field}>

              {/* ── OPPONENT HALF ── */}
              <div className={styles.oppHalf}>
                {/* Opponent hand — face down, top center */}
                <div className={styles.oppHandRow}>
                  {opponent.hand.map((_, i) => (
                    <div key={i} className={styles.oppHandCard}><span>♦</span></div>
                  ))}
                  {opponent.hand.length === 0 && <span className={styles.emptyHandNote}>No cards</span>}
                </div>

                {/* Opponent name + passed badge */}
                <div className={styles.oppNameRow}>
                  <span className={styles.fieldPlayerName}>{opponent.username}</span>
                  {opponent.hasPassed && <span className={styles.passedBadge}>Passed</span>}
                </div>

                {/* Opponent board — spell drop zone / display */}
                <div className={styles.oppBoard}>
                  {/* Opponent dualist — center of their half */}
                  <div className={styles.oppDualistAnchor}>
                    <div className={`${styles.dualistSlot} ${opponent.dualist ? styles.dualistSlotFilled : ""}`}>
                      {opponent.dualist ? (
                        phase === "resolution" ? (
                          <div className={styles.dualistSlotInner}>
                            <span className={styles.dsCardSuit}>♦</span>
                            <span className={styles.dsCardName}>{CARD_MAP[opponent.dualist]?.name}</span>
                            <span className={styles.dsCardPower}>{opponent.dualistPower}</span>
                          </div>
                        ) : (
                          <div className={styles.dualistSlotInner}>
                            <span className={styles.dsCardBack}>?</span>
                          </div>
                        )
                      ) : <span className={styles.dsEmpty}>—</span>}
                    </div>
                    <span className={styles.dualistLabel}>Dualist</span>
                  </div>

                  {/* Opponent spells */}
                  {oppSpells.map(spell => {
                    const card = CARD_MAP[spell.cardId];
                    const isInspected = inspectSpell?.instanceId === spell.instanceId;
                    return (
                      <div
                        key={spell.instanceId}
                        className={`${styles.spellToken} ${styles.spellTokenOpp} ${isInspected ? styles.spellTokenInspected : ""}`}
                        style={{ left: `${spell.x}%`, top: `${spell.y}%` }}
                        onClick={e => { e.stopPropagation(); setInspectSpell(isInspected ? null : spell); setInspectCard(null); }}
                      >
                        <div className={styles.spellTokenArt}>{card?.name[0] ?? "?"}</div>
                        <div className={styles.spellTokenLabel}>{card?.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── DIVIDER ── */}
              <div className={styles.fieldDivider}>
                <div className={styles.fieldDividerLine} />
                <div className={`${styles.turnBadge} ${isMyTurn ? styles.turnBadgeMine : styles.turnBadgeOpp}`}>
                  {phase === "resolution" ? "⚔ Resolving"
                    : isMyTurn ? "Your Turn"
                    : `${opponent.username}'s Turn`}
                </div>
                <div className={styles.fieldDividerLine} />
              </div>

              {/* ── MY HALF ── */}
              <div className={styles.myHalf}>
                {/* My board — spells + dualist center */}
                <div
                  ref={myBoardRef}
                  className={`${styles.myBoard} ${dragOverMyBoard ? styles.myBoardDragOver : ""} ${isMyTurn && phase === "playing" ? styles.myBoardActive : ""}`}
                  onDragOver={e => { e.preventDefault(); setDragOverMyBoard(true); }}
                  onDragLeave={() => setDragOverMyBoard(false)}
                  onDrop={e => { e.preventDefault(); onDropMyBoard(e); }}
                  onClick={e => {
                    if (!selectedCard || !isMyTurn || phase !== "playing") return;
                    if ((e.target as HTMLElement).closest(`.${styles.spellToken}`) || (e.target as HTMLElement).closest(`.${styles.dualistSlot}`)) return;
                    const rect = myBoardRef.current!.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    handlePlaySpell(selectedCard, x, y);
                  }}
                >
                  {/* Hint */}
                  {isMyTurn && phase === "playing" && mySpells.length === 0 && !me.dualist && (
                    <div className={styles.boardHint}>
                      <span>{dragOverMyBoard ? "Release to cast" : "Drag cards here · click to cast spells"}</span>
                    </div>
                  )}

                  {/* My dualist — center of my half */}
                  <div className={styles.myDualistAnchor}>
                    <span className={styles.dualistLabel}>Your Dualist</span>
                    <div
                      className={`
                        ${styles.dualistSlot}
                        ${me.dualist ? styles.dualistSlotFilled : ""}
                        ${dragOverDualist && !me.dualist ? styles.dualistSlotDragOver : ""}
                        ${!me.dualist && isMyTurn && phase === "playing" ? styles.dualistSlotActive : ""}
                      `}
                      onDragOver={e => { e.preventDefault(); e.stopPropagation(); if (!me.dualist) setDragOverDualist(true); }}
                      onDragLeave={() => setDragOverDualist(false)}
                      onDrop={e => { e.preventDefault(); e.stopPropagation(); onDropDualist(); }}
                      onClick={e => { e.stopPropagation(); if (selectedCard && isMyTurn && !me.dualist && phase === "playing") handlePlaceDualist(selectedCard); }}
                    >
                      {me.dualist ? (
                        <div className={styles.dualistSlotInner}>
                          <span className={styles.dsCardSuit}>♦</span>
                          <span className={styles.dsCardName}>{CARD_MAP[me.dualist]?.name}</span>
                          <span className={styles.dsCardPower}>{me.dualistPower}</span>
                          <span className={styles.dsCardEffect}>{CARD_MAP[me.dualist]?.dualistDescription}</span>
                        </div>
                      ) : (
                        <div className={styles.dualistSlotInner}>
                          <span className={styles.dsEmpty} style={{ opacity: 0.2 }}>♦</span>
                          <span className={styles.dsHint}>
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

                  {/* My spells */}
                  {mySpells.map(spell => {
                    const card = CARD_MAP[spell.cardId];
                    const isInspected = inspectSpell?.instanceId === spell.instanceId;
                    return (
                      <div
                        key={spell.instanceId}
                        className={`${styles.spellToken} ${styles.spellTokenMine} ${isInspected ? styles.spellTokenInspected : ""}`}
                        style={{ left: `${spell.x}%`, top: `${spell.y}%` }}
                        onClick={e => { e.stopPropagation(); setInspectSpell(isInspected ? null : spell); setInspectCard(null); }}
                      >
                        <div className={styles.spellTokenArt}>{card?.name[0] ?? "?"}</div>
                        <div className={styles.spellTokenLabel}>{card?.name}</div>
                      </div>
                    );
                  })}
                </div>

                {/* My name + action buttons */}
                <div className={styles.myNameRow}>
                  <span className={styles.fieldPlayerName}>You</span>
                  {isMyTurn && phase === "playing" && (
                    <div className={styles.actionBtns}>
                      {selectedCard && !me.dualist && (
                        <button className={styles.dualistBtn} onClick={() => handlePlaceDualist(selectedCard)}>⚔ Place as Dualist</button>
                      )}
                      {selectedCard && (
                        <button className={styles.spellBtn} onClick={() => handlePlaySpell(selectedCard)}>✦ Cast as Spell</button>
                      )}
                      <button className={styles.passBtn} onClick={() => sendAction("pass")}>Pass Turn</button>
                    </div>
                  )}
                </div>

                {/* My hand — bottom center, floating above the field */}
                <div className={styles.myHand}>
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
                  {me.hand.length === 0 && phase === "playing" && (
                    <p className={styles.emptyHand}>No cards in hand</p>
                  )}
                </div>
              </div>
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

        {/* Inspector */}
        <aside className={`${styles.inspectorPanel} ${inspectedCardDef ? styles.inspectorVisible : ""}`}>
          <div className={styles.resizeHandleLeft} onMouseDown={e => { inspResizing.current = true; inspResizeStart.current = e.clientX; inspWidthStart.current = inspectorWidth; e.preventDefault(); }} />
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
                {isMyTurn && phase === "playing" && !inspectSpell && inspectCard && (
                  <div className={styles.inspectorActions}>
                    {!me.dualist && <button className={styles.inspectorDualistBtn} onClick={() => handlePlaceDualist(inspectCard)}>Place as Dualist</button>}
                    <button className={styles.inspectorSpellBtn} onClick={() => handlePlaySpell(inspectCard)}>Cast as Spell</button>
                  </div>
                )}
                {inspectSpell && <p className={styles.inspectorSpellNote}>Spell played on the board.</p>}
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
    </main>
  );
}
