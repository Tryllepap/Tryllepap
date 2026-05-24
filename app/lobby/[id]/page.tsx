"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { getPusherClient } from "@/lib/pusher";
import styles from "./room.module.css";

export default function LobbyRoom() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [username, setUsername] = useState<string | null>(null);
  const [players, setPlayers] = useState<string[]>([]);
  const [hostUsername, setHostUsername] = useState<string>("");
  const [lobbyName, setLobbyName] = useState<string>("");
  const [closed, setClosed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showComingSoon, setShowComingSoon] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(async data => {
        if (!data.isLoggedIn) { router.push("/"); return; }
        setUsername(data.username);

        const res = await fetch("/api/lobbies/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lobbyId: id }),
        });
        if (!res.ok) { router.push("/lobby"); return; }

        const listRes = await fetch("/api/lobbies/list");
        const list = await listRes.json();
        const lobby = list.find((l: { id: string }) => l.id === id);
        if (lobby) {
          setPlayers(lobby.players);
          setHostUsername(lobby.hostUsername);
          setLobbyName(lobby.name);
        }
        setLoading(false);
      });
  }, [id, router]);

  useEffect(() => {
    const channel = getPusherClient().subscribe(`lobby-${id}`);

    channel.bind("player-joined", (data: { players: string[]; gameStarting?: boolean }) => {
      setPlayers(data.players);
      if (data.gameStarting) {
        router.push(`/game/${id}`);
      }
    });
    channel.bind("player-left", (data: { players: string[]; newHost: string }) => {
      setPlayers(data.players);
      setHostUsername(data.newHost);
    });
    channel.bind("lobby-closed", () => {
      setClosed(true);
    });

    return () => { getPusherClient().unsubscribe(`lobby-${id}`); };
  }, [id, router]);

  const handleLeave = useCallback(async () => {
    await fetch("/api/lobbies/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lobbyId: id }),
    });
    router.push("/lobby");
  }, [id, router]);

  useEffect(() => {
    const handler = () => {
      navigator.sendBeacon("/api/lobbies/leave", JSON.stringify({ lobbyId: id }));
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [id]);

  if (loading) {
    return (
      <main className={styles.main}>
        <div className={styles.loadingDots}><span>·</span><span>·</span><span>·</span></div>
      </main>
    );
  }

  if (closed) {
    return (
      <main className={styles.main}>
        <div className={styles.closedBox}>
          <p className={styles.closedIcon}>🃏</p>
          <p className={styles.closedText}>The table has been closed.</p>
          <button className={styles.returnBtn} onClick={() => router.push("/lobby")}>
            Return to Hall
          </button>
        </div>
      </main>
    );
  }

  const isHost = username === hostUsername;
  const isFull = players.length >= 2;

  return (
    <main className={styles.main}>
      <div className={styles.bg} aria-hidden="true" />

      <div className={styles.container}>
        <div className={styles.header}>
          <button className={styles.leaveBtn} onClick={handleLeave}>← Leave</button>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>{lobbyName || "Table"}</h1>
            <p className={styles.subtitle}>
              {isHost ? "You are the host" : `Hosted by ${hostUsername}`}
            </p>
          </div>
          <div className={styles.headerSpacer} />
        </div>

        <div className={styles.divider}><span>♥ ✦ ♥</span></div>

        <div className={styles.playersSection}>
          <h2 className={styles.sectionLabel}>Players at the Table</h2>
          <div className={styles.playerSlots}>
            {[0, 1].map(i => (
              <div key={i} className={`${styles.playerSlot} ${players[i] ? styles.slotFilled : styles.slotEmpty}`}>
                {players[i] ? (
                  <>
                    <span className={styles.suitIcon}>{i === 0 ? "♠" : "♥"}</span>
                    <span className={styles.playerName}>{players[i]}</span>
                    {players[i] === hostUsername && <span className={styles.hostBadge}>Host</span>}
                  </>
                ) : (
                  <>
                    <span className={styles.emptySlotIcon}>·</span>
                    <span className={styles.emptySlotText}>Waiting for player...</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.actionArea}>
          {!isFull ? (
            <div className={styles.waitingBox}>
              <div className={styles.waitingDots}><span>·</span><span>·</span><span>·</span></div>
              <p className={styles.waitingText}>Waiting for an opponent to join...</p>
            </div>
          ) : isHost ? (
            <button className={styles.startBtn} onClick={() => router.push(`/game/${id}`)}>
              ⚔ Start Duel
            </button>
          ) : (
            <p className={styles.waitingText}>Waiting for host to start the duel...</p>
          )}
        </div>
      </div>

      {showComingSoon && (
        <div className={styles.overlay} onClick={() => setShowComingSoon(false)}>
          <div className={styles.comingSoonBox}>
            <span className={styles.cornerTl}>♠</span>
            <span className={styles.cornerBr}>♦</span>
            <p className={styles.comingSoonIcon}>⚔</p>
            <h2 className={styles.comingSoonTitle}>Duel Coming Soon</h2>
            <p className={styles.comingSoonText}>
              The game mechanics are being forged.<br />
              Check back soon, challenger.
            </p>
            <button className={styles.dismissBtn} onClick={() => setShowComingSoon(false)}>
              Return to Table
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
