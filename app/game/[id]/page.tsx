"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getPusherClient } from "@/lib/pusher";
import { GameState } from "@/lib/game/state";
import { CARD_MAP } from "@/lib/game/cards";
import { translations, cardTranslations, Locale } from "@/lib/i18n";
import styles from "./game.module.css";

type RpsChoice = "rock" | "paper" | "scissors";
const RPS_EMOJI: Record<RpsChoice, string> = { rock: "🪨", paper: "📄", scissors: "✂️" };

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
  const [locale, setLocale] = useState<Locale>("en");

  const t = translations[locale];

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
          setTimeout(() => {
            setRpsPhase("choosing"); setRpsMyChoice(null);
            setRpsOppChoice(null); setRpsWinner(null); setRpsCountdown(null);
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
      if (state.phase === "rps" && state.rpsResult && rpsPhase !== "revealing" && rpsPhase !== "done") runRpsReveal(state);
      if (state.phase === "playing") { setRpsPhase("choosing"); acknowledgedRps.current = false; }
      if (state.phase === "round_result" || state.phase === "game_over") setPlacedSpells([]);
    });
    return () => { getPusherClient().unsubscribe(`game-${id}`); };
  }, [id, rpsPhase, runRpsReveal]);

  // Resize listeners
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

  const onDropDualist = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (dragCardId) handlePlaceDualist(dragCardId);
    setDragOverDualist(false); setDragCardId(null);
  };

  const onDropMyBoard = (e: React.DragEvent) => {
    e.preventDefault();
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
        <div className={styles.loader}>
          <div className={styles.loaderCard}>✦</div>
          <p>{t.loadingGame}</p>
        </div>
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
  const inspectedCardTx = activeInspectCardId ? cardTranslations[activeInspectCardId]?.[locale] : null;

  const mySpells = placedSpells.filter(s => s.playerId === myUsername);
  const oppSpells = placedSpells.filter(s => s.playerId !== myUsername);

  const cardName = (cardId: string) =>
    cardTranslations[cardId]?.[locale]?.name ?? CARD_MAP[cardId]?.name ?? cardId;

  const rpsLabels: Record<RpsChoice, string> = {
    rock: t.rock, paper: t.paper, scissors: t.scissors,
  };

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
            {[0,1].map(i => <div key={i} className={`${styles.pip} ${i < opponent.roundsWon ? styles.pipFilled : ""}`} />)}
          </div>
        </div>
        <div className={styles.roundInfo}>
          <span className={styles.roundLabel}>{t.round}</span>
          <span className={styles.roundNum}>{gameState.roundNumber}</span>
          <span className={styles.roundLabel}>{t.of} 3</span>
        </div>
        <div className={`${styles.playerScore} ${styles.playerScoreRight}`}>
          <div className={styles.roundPips}>
            {[0,1].map(i => <div key={i} className={`${styles.pip} ${i < me.roundsWon ? styles.pipFilled : ""}`} />)}
          </div>
          <span className={styles.playerScoreName}>{t.you}</span>
        </div>

        {/* Language toggle */}
        <button
          className={styles.langToggle}
          onClick={() => setLocale(l => l === "en" ? "da" : "en")}
          title={locale === "en" ? "Switch to Danish" : "Skift til engelsk"}
          aria-label="Toggle language"
        >
          {locale === "en" ? "🇬🇧" : "🇩🇰"}
        </button>
      </header>

      {/* ── Three column layout ── */}
      <div
        className={styles.gameLayout}
        style={{ gridTemplateColumns: `${logWidth}px 1fr ${inspectorWidth}px` }}
      >
        {/* Log */}
        <aside className={styles.logPanel}>
          <div className={styles.logHeader}><span className={styles.logTitle}>{t.battleLog}</span></div>
          <div className={styles.logScroll}>
            {gameState.eventLog.map((entry, i) => (
              <p key={i} className={`${styles.logLine} ${i === gameState.eventLog.length - 1 ? styles.logLineLatest : ""}`}>{entry}</p>
            ))}
          </div>
          <div
            className={styles.resizeHandleRight}
            onMouseDown={e => {
              logResizing.current = true;
              logResizeStart.current = e.clientX;
              logWidthStart.current = logWidth;
              e.preventDefault();
            }}
          />
        </aside>

        {/* Battlefield */}
        <div className={styles.battlefield}>

          {/* ── RPS ── */}
          {phase === "rps" && (
            <div className={styles.rpsContainer}>
              <div className={styles.rpsOpponent}>
                <p className={styles.rpsPlayerLabel}>{opponent.username}</p>
                <div className={`${styles.rpsChoiceDisplay} ${rpsPhase === "done" && rpsOppChoice ? styles.rpsChoiceRevealed : ""}`}>
                  {rpsPhase === "done" && rpsOppChoice
                    ? <span className={styles.rpsEmoji}>{RPS_EMOJI[rpsOppChoice]}</span>
                    : opponent.rpsChoice
                    ? <span className={styles.rpsEmojiHidden}>✊</span>
                    : <span className={styles.rpsEmojiWaiting}>···</span>}
                </div>
                <p className={styles.rpsStatusText}>{opponent.rpsChoice ? t.ready : t.choosing}</p>
              </div>
              <div className={styles.rpsCenter}>
                {rpsPhase === "revealing" && rpsCountdown !== null && rpsCountdown > 0
                  ? <div className={styles.rpsCountdown} key={rpsCountdown}>{rpsCountdown}</div>
                  : rpsPhase === "done"
                  ? <div className={styles.rpsResultBanner}>
                      {rpsWinner === "draw"
                        ? <span className={styles.rpsDrawText}>{t.draw}</span>
                        : rpsWinner === myUsername
                        ? <span className={styles.rpsWinText}>{t.youWin}</span>
                        : <span className={styles.rpsLoseText}>{t.theyWin}</span>}
                    </div>
                  : <div className={styles.rpsVs}>VS</div>}
              </div>
              <div className={styles.rpsMine}>
                <div className={`${styles.rpsChoiceDisplay} ${rpsMyChoice ? styles.rpsChoiceSelected : ""} ${rpsPhase === "done" && rpsMyChoice ? styles.rpsChoiceRevealed : ""}`}>
                  {rpsMyChoice
                    ? <span className={styles.rpsEmoji}>{RPS_EMOJI[rpsMyChoice]}</span>
                    : <span className={styles.rpsEmojiWaiting}>?</span>}
                </div>
                {rpsPhase === "choosing" && (
                  <div className={styles.rpsButtons}>
                    {(["rock","paper","scissors"] as RpsChoice[]).map(c => (
                      <button key={c} className={styles.rpsBtn} onClick={() => handleRpsClick(c)}>
                        <span className={styles.rpsBtnEmoji}>{RPS_EMOJI[c]}</span>
                        <span className={styles.rpsBtnLabel}>{rpsLabels[c]}</span>
                      </button>
                    ))}
                  </div>
                )}
                {rpsPhase === "waiting" && <p className={styles.rpsWaitText}>{t.waitingForOpponent}</p>}
                <p className={styles.rpsPlayerLabel}>{t.you}</p>
              </div>
            </div>
          )}

          {/* ── Playing field ── */}
          {(phase === "playing" || phase === "resolution") && (
            <div className={styles.field}>

              {/* ══ OPPONENT HALF ══ */}
              <div className={styles.oppHalf}>
                <div className={styles.oppHandRow}>
                  {opponent.hand.map((_, i) => (
                    <div key={i} className={styles.oppHandCard}><span>♦</span></div>
                  ))}
                  {opponent.hand.length === 0 && <span className={styles.emptyHandNote}>{t.noCards}</span>}
                </div>
                <div className={styles.playerNameRow}>
                  <span className={styles.fieldPlayerName}>{opponent.username}</span>
                  {opponent.hasPassed && <span className={styles.passedBadge}>{t.passed}</span>}
                </div>
                <div className={styles.oppBoard}>
                  <div className={styles.dualistAnchor}>
                    <div className={`${styles.dualistSlot} ${opponent.dualist ? styles.dualistSlotFilled : ""}`}>
                      {opponent.dualist ? (
                        phase === "resolution" ? (
                          <div className={styles.dsInner}>
                            <span className={styles.dsSuit}>♦</span>
                            <span className={styles.dsName}>{cardName(opponent.dualist)}</span>
                            <span className={styles.dsPower}>{opponent.dualistPower}</span>
                          </div>
                        ) : (
                          <div className={styles.dsInner}><span className={styles.dsBack}>?</span></div>
                        )
                      ) : <span className={styles.dsEmpty}>—</span>}
                    </div>
                    <span className={styles.dualistLabel}>{t.dualist}</span>
                  </div>
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
                        <div className={styles.spellTokenLabel}>{cardName(spell.cardId)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ══ DIVIDER ══ */}
              <div className={styles.fieldDivider}>
                <div className={styles.dividerLine} />
                <div className={`${styles.turnBadge} ${isMyTurn ? styles.turnBadgeMine : styles.turnBadgeOpp}`}>
                  {phase === "resolution" ? t.resolving
                    : isMyTurn ? t.yourTurn
                    : `${opponent.username}${t.sTurn}`}
                </div>
                <div className={styles.dividerLine} />
              </div>

              {/* ══ MY HALF ══ */}
              <div className={styles.myHalf}>
                <div
                  ref={myBoardRef}
                  className={`${styles.myBoard} ${dragOverMyBoard ? styles.myBoardOver : ""} ${isMyTurn && phase === "playing" ? styles.myBoardActive : ""}`}
                  onDragOver={e => { e.preventDefault(); setDragOverMyBoard(true); }}
                  onDragLeave={e => { if (!myBoardRef.current?.contains(e.relatedTarget as Node)) setDragOverMyBoard(false); }}
                  onDrop={onDropMyBoard}
                  onClick={e => {
                    if (!selectedCard || !isMyTurn || phase !== "playing") return;
                    const target = e.target as HTMLElement;
                    if (target.closest(`.${styles.spellToken}`) || target.closest(`.${styles.dualistAnchor}`)) return;
                    const rect = myBoardRef.current!.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    handlePlaySpell(selectedCard, x, y);
                  }}
                >
                  {/* Board hint */}
                  {isMyTurn && phase === "playing" && mySpells.length === 0 && !me.dualist && (
                    <div className={styles.boardHint}>
                      <span>{dragOverMyBoard ? t.dragHintOver : t.dragHint}</span>
                    </div>
                  )}

                  {/* My dualist */}
                  <div className={styles.dualistAnchor}>
                    <span className={styles.dualistLabel}>{t.yourDualist}</span>
                    <div
                      className={`
                        ${styles.dualistSlot}
                        ${me.dualist ? styles.dualistSlotFilled : ""}
                        ${dragOverDualist && !me.dualist ? styles.dualistSlotOver : ""}
                        ${!me.dualist && isMyTurn && phase === "playing" ? styles.dualistSlotActive : ""}
                      `}
                      onDragOver={e => { e.preventDefault(); e.stopPropagation(); if (!me.dualist) setDragOverDualist(true); }}
                      onDragLeave={() => setDragOverDualist(false)}
                      onDrop={onDropDualist}
                      onClick={e => {
                        e.stopPropagation();
                        if (selectedCard && isMyTurn && !me.dualist && phase === "playing") handlePlaceDualist(selectedCard);
                      }}
                    >
{me.dualist ? (
  <div className={styles.dsInner}>
    {CARD_MAP[me.dualist]?.image
      ? <img src={CARD_MAP[me.dualist].image} alt={cardName(me.dualist)} className={styles.dsImage} />
      : <>
          <span className={styles.dsSuit}>♦</span>
          <span className={styles.dsName}>{cardName(me.dualist)}</span>
          <span className={styles.dsPower}>{me.dualistPower}</span>
          <span className={styles.dsEffect}>{cardTranslations[me.dualist]?.[locale]?.dualistDescription ?? CARD_MAP[me.dualist]?.dualistDescription}</span>
        </>
    }
  </div>
                      ) : (
                        <div className={styles.dsInner}>
                          <span className={styles.dsEmpty}>
                            {!isMyTurn || phase !== "playing" ? "—"
                              : dragOverDualist ? "Drop"
                              : selectedCard ? "Click"
                              : "♦"}
                          </span>
                          <span className={styles.dsHint}>
                            {isMyTurn && phase === "playing" ? t.yourDualist : ""}
                          </span>
                        </div>
                      )}
                    </div>
                    {me.hasPassed && <span className={styles.passedBadge}>{t.passed}</span>}
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
                        <div className={styles.spellTokenLabel}>{cardName(spell.cardId)}</div>
                      </div>
                    );
                  })}
                </div>

                {/* My name + action buttons */}
                <div className={styles.playerNameRow}>
                  <span className={styles.fieldPlayerName}>{t.you}</span>
                  {isMyTurn && phase === "playing" && (
                    <div className={styles.actionBtns}>
                      {selectedCard && !me.dualist && (
                        <button className={styles.dualistBtn} onClick={() => handlePlaceDualist(selectedCard)}>{t.dualistBtn}</button>
                      )}
                      {selectedCard && (
                        <button className={styles.spellBtn} onClick={() => handlePlaySpell(selectedCard)}>{t.spellBtn}</button>
                      )}
                      <button className={styles.passBtn} onClick={() => sendAction("pass")}>{t.passBtn}</button>
                    </div>
                  )}
                </div>

                {/* My hand */}
                <div className={styles.myHand}>
                  {me.hand.map((cardId, i) => {
                    const card = CARD_MAP[cardId];
                    if (!card) return null;
                    const tx = cardTranslations[cardId]?.[locale];
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
{card.image
  ? <img src={card.image} alt={card.name} className={styles.handCardImage} />
  : <>
      <div className={styles.handCardGlow} />
      <div className={styles.handCardTop}>
        <span className={styles.handCardName}>{tx?.name ?? card.name}</span>
        <span className={styles.handCardPower}>{card.basePower}</span>
      </div>
      <div className={styles.handCardSuit}>♦</div>
      <div className={styles.handCardBottom}>
        <div className={styles.handCardEffectRow}>
          <span className={styles.handCardEffectTag}>{card.isInstant ? t.instant : "Spell"}</span>
          <span className={styles.handCardEffectDesc}>{tx?.spellDescription ?? card.spellDescription}</span>
        </div>
        <div className={styles.handCardEffectRow}>
          <span className={styles.handCardEffectTag}>{card.isFlipEffect ? t.flipEffect : "Dualist"}</span>
          <span className={styles.handCardEffectDesc}>{tx?.dualistDescription ?? card.dualistDescription}</span>
        </div>
      </div>
      {card.categories.length > 0 && (
        <div className={styles.handCardCategories}>
          {(tx?.categories ?? card.categories).map(cat => (
            <span key={cat} className={styles.categoryTag}>{cat}</span>
          ))}
        </div>
      )}
    </>
}
                      </div>
                    );
                  })}
                  {me.hand.length === 0 && phase === "playing" && <p className={styles.emptyHand}>{t.noCards}</p>}
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
                <h2 className={styles.resultTitle}>{gameState.lastRoundWinner === myUsername ? t.roundVictory : gameState.lastRoundWinner === "draw" ? t.roundDraw : t.roundLost}</h2>
                <div className={styles.resultPowers}>
                  <div className={styles.resultPowerBox}><span className={styles.resultPowerName}>{me.username}</span><span className={styles.resultPowerValue}>{me.dualistPower}</span></div>
                  <span className={styles.resultPowerVs}>vs</span>
                  <div className={styles.resultPowerBox}><span className={styles.resultPowerName}>{opponent.username}</span><span className={styles.resultPowerValue}>{opponent.dualistPower}</span></div>
                </div>
                <button className={styles.nextRoundBtn} onClick={() => { sendAction("next_round"); setPlacedSpells([]); }}>{t.nextRound}</button>
              </div>
            </div>
          )}

          {/* Game over */}
          {phase === "game_over" && (
            <div className={styles.resultOverlay}>
              <div className={styles.resultCard}>
                <div className={styles.resultSuits}>♠ ♥ ♦ ♣</div>
                <div className={styles.resultIcon}>{gameState.matchWinner === myUsername ? "👑" : "💀"}</div>
                <h2 className={styles.resultTitle}>{gameState.matchWinner === myUsername ? t.victory : t.defeat}</h2>
                <p className={styles.resultSubtitle}>{gameState.matchWinner === myUsername ? t.masteredMsg : `${opponent.username} wins the match.`}</p>
                <div className={styles.resultPowers}>
                  <div className={styles.resultPowerBox}><span className={styles.resultPowerName}>{me.username}</span><span className={styles.resultPowerValue}>{me.roundsWon} {t.rounds}</span></div>
                  <span className={styles.resultPowerVs}>vs</span>
                  <div className={styles.resultPowerBox}><span className={styles.resultPowerName}>{opponent.username}</span><span className={styles.resultPowerValue}>{opponent.roundsWon} {t.rounds}</span></div>
                </div>
                <button className={styles.nextRoundBtn} onClick={() => router.push("/lobby")}>{t.returnToHall}</button>
              </div>
            </div>
          )}
        </div>

        {/* Inspector */}
        <aside className={`${styles.inspectorPanel} ${inspectedCardDef ? styles.inspectorVisible : ""}`}>
          <div
            className={styles.resizeHandleLeft}
            onMouseDown={e => {
              inspResizing.current = true;
              inspResizeStart.current = e.clientX;
              inspWidthStart.current = inspectorWidth;
              e.preventDefault();
            }}
          />
          {inspectedCardDef ? (
            <div className={styles.inspectorCard}>
             <div className={styles.inspectorImageSlot}>
  {inspectedCardDef.image
    ? <img src={inspectedCardDef.image} alt={inspectedCardTx?.name ?? inspectedCardDef.name} className={styles.inspectorImage} />
    : <><span className={styles.inspectorImagePlaceholder}>{(inspectedCardTx?.name ?? inspectedCardDef.name)[0]}</span>
        <span className={styles.inspectorImageNote}>{t.cardArtSoon}</span></>
  }
              </div>
              <div className={styles.inspectorBody}>
                <div className={styles.inspectorHeader}>
                  <h3 className={styles.inspectorName}>{inspectedCardTx?.name ?? inspectedCardDef.name}</h3>
                  <span className={styles.inspectorPower}>{inspectedCardDef.basePower}</span>
                </div>
                {inspectedCardDef.categories.length > 0 && (
                  <div className={styles.inspectorCategories}>
                    <span className={styles.inspectorCategoriesLabel}>{t.categories}:</span>
                    {(inspectedCardTx?.categories ?? inspectedCardDef.categories).map(cat => (
                      <span key={cat} className={styles.categoryTag}>{cat}</span>
                    ))}
                  </div>
                )}
                <div className={styles.inspectorDivider} />
                <div className={styles.inspectorEffect}>
                  <span className={styles.inspectorEffectLabel}>
                    {inspectedCardDef.isInstant ? `✦ ${t.instant}` : t.spellEffect}
                  </span>
                  <p className={styles.inspectorEffectText}>{inspectedCardTx?.spellDescription ?? inspectedCardDef.spellDescription}</p>
                </div>
                <div className={styles.inspectorEffect}>
                  <span className={styles.inspectorEffectLabel}>
                    {inspectedCardDef.isFlipEffect ? `⚔ ${t.flipEffect}` : t.dualistEffect}
                  </span>
                  <p className={styles.inspectorEffectText}>{inspectedCardTx?.dualistDescription ?? inspectedCardDef.dualistDescription}</p>
                </div>
                {isMyTurn && phase === "playing" && !inspectSpell && inspectCard && (
                  <div className={styles.inspectorActions}>
                    {!me.dualist && (
                      <button className={styles.inspectorDualistBtn} onClick={() => handlePlaceDualist(inspectCard)}>{t.placeAsDualist}</button>
                    )}
                    <button className={styles.inspectorSpellBtn} onClick={() => handlePlaySpell(inspectCard)}>{t.castAsSpell}</button>
                  </div>
                )}
                {inspectSpell && <p className={styles.inspectorSpellNote}>{t.spellPlayedNote}</p>}
              </div>
              <button className={styles.inspectorClose} onClick={() => { setInspectCard(null); setInspectSpell(null); }}>✕</button>
            </div>
          ) : (
            <div className={styles.inspectorEmpty}>
              <span className={styles.inspectorEmptyIcon}>♦</span>
              <p>{t.inspectHint.split("\n").map((line, i) => <span key={i}>{line}<br/></span>)}</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
