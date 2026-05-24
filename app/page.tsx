"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import styles from "./page.module.css";

const AuthModal = dynamic(() => import("@/components/AuthModal"), { ssr: false });

const SUITS = ["♠", "♥", "♦", "♣"];
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  suit: SUITS[i % 4],
  left: `${5 + (i * 17.3) % 90}%`,
  delay: `${(i * 1.37) % 12}s`,
  duration: `${14 + (i * 2.1) % 10}s`,
  size: `${0.8 + (i * 0.15) % 1.2}rem`,
  opacity: 0.04 + (i * 0.008) % 0.1,
}));

type ModalMode = "login" | "register" | null;

export default function Home() {
  const router = useRouter();
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(data => { if (data.isLoggedIn) setUsername(data.username); })
      .catch(() => {})
      .finally(() => setSessionLoading(false));
  }, []);

  const handleAuthSuccess = useCallback((name: string) => {
    setUsername(name);
    setModalMode(null);
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUsername(null);
  };

  return (
    <main className={styles.main}>
      <div className={styles.particles} aria-hidden="true">
        {PARTICLES.map(p => (
          <span
            key={p.id}
            className={`${styles.particle} ${p.suit === "♥" || p.suit === "♦" ? styles.particleRed : ""}`}
            style={{
              left: p.left,
              animationDelay: p.delay,
              animationDuration: p.duration,
              fontSize: p.size,
              opacity: p.opacity,
            }}
          >
            {p.suit}
          </span>
        ))}
      </div>

      <div className={styles.vignette} aria-hidden="true" />

      <div className={styles.content}>
        <div className={styles.suitsRow} aria-hidden="true">
          <span className={styles.suitBlack}>♠</span>
          <span className={styles.ornament}>— ✦ —</span>
          <span className={styles.suitRed}>♥</span>
        </div>

        <div className={styles.titleBlock}>
          <h1 className={styles.title}>TryllePap</h1>
          <p className={styles.subtitle}>The Art of the Card</p>
        </div>

        <div className={styles.ornamentalLine} aria-hidden="true">
          <span className={styles.suitRed}>♦</span>
          <span className={styles.suitBlack}>♣</span>
        </div>

        <div className={styles.authArea}>
          {sessionLoading ? (
            <div className={styles.sessionLoader}>
              <span>·</span><span>·</span><span>·</span>
            </div>
          ) : username ? (
            <div className={styles.loggedIn}>
              <p className={styles.welcomeText}>
                Welcome back, <span className={styles.usernameHighlight}>{username}</span>
              </p>
              <div className={styles.buttonGroup}>
                <button className={styles.btnPrimary} onClick={() => router.push("/lobby")}>
                  Browse Lobbies
                </button>
                <button className={styles.btnGhost} onClick={handleLogout}>
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.buttonGroup}>
              <button className={styles.btnPrimary} onClick={() => setModalMode("login")}>
                Sign In
              </button>
              <button className={styles.btnGhost} onClick={() => setModalMode("register")}>
                Create Account
              </button>
            </div>
          )}
        </div>

        <div className={styles.suitsRowBottom} aria-hidden="true">
          <span className={styles.suitRed}>♦</span>
          <span className={styles.ornament}>— ✦ —</span>
          <span className={styles.suitBlack}>♣</span>
        </div>
      </div>

      {modalMode && (
        <AuthModal
          initialMode={modalMode}
          onClose={() => setModalMode(null)}
          onSuccess={handleAuthSuccess}
        />
      )}
    </main>
  );
}
