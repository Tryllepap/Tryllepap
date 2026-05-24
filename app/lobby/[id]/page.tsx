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
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(async data => {
        if (!data.isLoggedIn) { router.push("/"); return; }
        const me = data.username;
        setUsername(me);

        // Fetch lobby state first
        const listRes = await fetch("/api/lobbies/list");
        const list = await listRes.json();
        const lobby = list.find((l: { id: string }) => l.id === id);

        if (lobby) {
          // Already in lobby — no need to join again
          if (lobby.players.includes(me)) {
            setPlayers(lobby.players);
            setHostUsername(lobby.hostUsername);
            setLobbyName(lobby.name);
            setLoading(false);
            return;
          }

          // Not in lobby yet — join it
          const res = await fetch("/api/lobbies/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lobbyId: id }),
          });
          const joinData = await res.json();

          if (!res.ok) {
            setError(joinData.error || "Could not join lobby.");
            setLoading(false);
            return;
          }

          // Re-fetch updated lobby
          const listRes2 = await fetch("/api/lobbies/list");
          const list2 = await listRes2.json();
          const updated = list2.find((l: { id: string }) => l.id === id);
          if (updated) {
            setPlayers(updated.players);
            setHostUsername(updated.hostUsername);
            setLobbyName(updated.name);
          }
          setLoading(false);
        } else {
          // Lobby not in list at all
          setError("Lobby not found or has already started.");
          setLoading(false);
        }
      })
      .catch(() => {
        setError("Something went wrong. Please try again.");
        setLoading(false);
      });
  }, [id, router]);

  // Realtime updates
  useEffect(() => {
    const channel = getPusherClient().subscribe(`lobby-${id}`);

    channel.bind("player-joined", (data: { players: string[] }) => {
      setPlayers(data.players);
    });
    channel.bind("player-left", (data: { players: string[]; newHost: string }) => {
      setPlayers(data.players);
      setHostUsername(data.newHost);
    });
    channel.bind("lobby-closed", () => {
      setClosed(true);
    });
    channel.bind("game-started", () => {
      router.push(`/game/${id}`);
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

  const handleStartGame = useCallback(async () => {
    setStarting(true);
    const res = await fetch("/api/game/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lobbyId: id }),
    });
    if (res.ok) {
      router.push(`/game/${id}`);
    } else {
      const data = await res.json();
      setError(data.error || "Failed to start game.");
      setStarting(false);
    }
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

  if (error) {
    return (
      <main className={styles.main}>
        <div className={styles.closedBox}>
          <p className={styles.closedIcon}>⚠</p>
          <p className={styles.closedText}>{error}</p>
          <button className={styles.returnBtn} onClick={() => router.push("/lobby")}>
            Return to Hall
          </button>
        </div>
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
            <button
              className={styles.startBtn}
              onClick={handleStartGame}
              disabled={starting}
            >
              {starting ? "Starting..." : "⚔ Start Duel"}
            </button>
          ) : (
            <p className={styles.waitingText}>Waiting for host to start the duel...</p>
          )}
        </div>
      </div>
    </main>
  );
}
