"use client";

import { useState, useEffect } from "react";
import { CARD_MAP } from "@/lib/game/cards";
import { PlayerState } from "@/lib/game/state";
import { cardTranslations, Locale } from "@/lib/i18n";
import { AnimationLevel } from "@/lib/settings";
import styles from "./DualistReveal.module.css";

interface Props {
  me: PlayerState;
  opponent: PlayerState;
  myUsername: string;
  locale: Locale;
  animLevel: AnimationLevel;
  onComplete: () => void;
}

export default function DualistReveal({ me, opponent, locale, animLevel, onComplete }: Props) {
  const [step, setStep] = useState<"flip_opp" | "flip_me" | "effects" | "result">("flip_opp");
  const [myPower, setMyPower] = useState(0);
  const [oppPower, setOppPower] = useState(0);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);
  const [winner, setWinner] = useState<"me" | "opp" | "draw" | null>(null);

  const myCard  = me.dualist       ? CARD_MAP[me.dualist]       : null;
  const oppCard = opponent.dualist ? CARD_MAP[opponent.dualist] : null;
  const myCardTx  = me.dualist       ? cardTranslations[me.dualist]?.[locale]       : null;
  const oppCardTx = opponent.dualist ? cardTranslations[opponent.dualist]?.[locale] : null;

  const fast = animLevel === "minimal";
  const delay = (ms: number) => new Promise<void>(r => setTimeout(r, fast ? Math.min(ms * 0.15, 100) : ms));

  useEffect(() => {
    async function run() {
      // 1. Flip opponent card
      await delay(400);
      setStep("flip_opp");
      setOppPower(oppCard?.basePower ?? 0);
      await delay(900);

      // 2. Flip my card
      setStep("flip_me");
      setMyPower(myCard?.basePower ?? 0);
      await delay(900);

      // 3. Effects
      setStep("effects");

      if (oppCard && opponent.dualistPower !== (oppCard.basePower ?? 0)) {
        setActiveEffect(`${opponent.username}'s ${oppCardTx?.name ?? oppCard.name}: ${oppCardTx?.dualistDescription ?? oppCard.dualistDescription}`);
        await delay(900);
        setOppPower(opponent.dualistPower);
        await delay(700);
        setActiveEffect(null);
        await delay(400);
      }

      if (myCard && me.dualistPower !== (myCard.basePower ?? 0)) {
        setActiveEffect(`${me.username}'s ${myCardTx?.name ?? myCard.name}: ${myCardTx?.dualistDescription ?? myCard.dualistDescription}`);
        await delay(900);
        setMyPower(me.dualistPower);
        await delay(700);
        setActiveEffect(null);
        await delay(400);
      }

      // 4. Result
      setStep("result");
      if      (me.dualistPower > opponent.dualistPower) setWinner("me");
      else if (opponent.dualistPower > me.dualistPower) setWinner("opp");
      else                                               setWinner("draw");

      await delay(2800);
      onComplete();
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showOpp = step === "flip_opp" || step === "flip_me" || step === "effects" || step === "result";
  const showMe  = step === "flip_me"  || step === "effects" || step === "result";

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.headerSuits}>♠ ♥ ♦ ♣</span>
          <h2 className={styles.headerTitle}>Dualists Revealed</h2>
          <span className={styles.headerSuits}>♣ ♦ ♥ ♠</span>
        </div>

        <div className={styles.cardsRow}>
          {/* Opponent */}
          <div className={styles.cardSlot}>
            <span className={styles.cardSlotLabel}>{opponent.username}</span>
            <div className={styles.cardWrap}>
              {showOpp ? (
                <div className={`${styles.revealedCard} ${styles.revealedCardOpp}`}>
                  {oppCard?.image
                    ? <img src={oppCard.image} alt={oppCardTx?.name ?? oppCard.name} className={styles.cardImg} />
                    : <div className={styles.cardNoImg}><span className={styles.cardNoImgName}>{oppCardTx?.name ?? oppCard?.name ?? "?"}</span></div>}
                  <div className={styles.cardFooter}>
                    <span className={styles.cardFooterName}>{oppCardTx?.name ?? oppCard?.name}</span>
                    <span className={styles.cardFooterBase}>{oppCard?.basePower ?? 0}</span>
                  </div>
                </div>
              ) : (
                <div className={styles.faceDownCard}><span>?</span></div>
              )}
            </div>
            <div className={`${styles.powerBadge} ${step === "result" ? (winner === "opp" ? styles.powerWin : winner === "draw" ? styles.powerDraw : styles.powerLose) : ""}`}>
              {oppPower}
            </div>
          </div>

          {/* VS / effect */}
          <div className={styles.vsCol}>
            <div className={styles.vsText}>VS</div>
            {activeEffect && (
              <div className={styles.effectBanner}>
                <span className={styles.effectBannerText}>{activeEffect}</span>
              </div>
            )}
          </div>

          {/* Me */}
          <div className={styles.cardSlot}>
            <span className={styles.cardSlotLabel}>You</span>
            <div className={styles.cardWrap}>
              {showMe ? (
                <div className={`${styles.revealedCard} ${styles.revealedCardMe}`}>
                  {myCard?.image
                    ? <img src={myCard.image} alt={myCardTx?.name ?? myCard.name} className={styles.cardImg} />
                    : <div className={styles.cardNoImg}><span className={styles.cardNoImgName}>{myCardTx?.name ?? myCard?.name ?? "?"}</span></div>}
                  <div className={styles.cardFooter}>
                    <span className={styles.cardFooterName}>{myCardTx?.name ?? myCard?.name}</span>
                    <span className={styles.cardFooterBase}>{myCard?.basePower ?? 0}</span>
                  </div>
                </div>
              ) : (
                <div className={styles.faceDownCard}><span>?</span></div>
              )}
            </div>
            <div className={`${styles.powerBadge} ${step === "result" ? (winner === "me" ? styles.powerWin : winner === "draw" ? styles.powerDraw : styles.powerLose) : ""}`}>
              {myPower}
            </div>
          </div>
        </div>

        {step === "result" && winner && (
          <div className={`${styles.resultBanner} ${winner === "me" ? styles.resultWin : winner === "draw" ? styles.resultDraw : styles.resultLose}`}>
            {winner === "me" ? "🏆 You win the round!" : winner === "draw" ? "🤝 Draw!" : `💀 ${opponent.username} wins the round!`}
          </div>
        )}
      </div>
    </div>
  );
}
