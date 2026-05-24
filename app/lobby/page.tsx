"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { pusherClient } from "@/lib/pusher";
import styles from "./lobby.module.css";

interface LobbyEntry {
  id: string;
  name: string;
  hostUsername: string;
  players: string[];
  maxPlayers: number;
  status: string;
  hasPassword: boolean;
  createdAt: string;
}

export default function LobbyPage() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [lobbies, setLobbies] = useState<LobbyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Create lobby modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createError, setCreateError] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Join password modal
  const [joinTarget, setJoinTarget] = useState<LobbyEntry | null>(null);
  const [joinPassword, setJoinPassword] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  // Check session
  useEffect(() => {
    fetch("/api/auth/session")
      .then(r => r.json())
      .then(data => {
        if (!data.isLoggedIn) { router.push("/"); return; }
        setUsername(data.username);
      });
  }, [router]);

  // Fetch lobbies
  const fetchLobbies = useCallback(async () => {
    const res = await fetch("/api/lobbies/list");
    const data = await res.json();
    setLobbies(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLobbies(); }, [fetchLobbies]);

  // Realtime lobby list updates via Pusher
  useEffect(() => {
    const channel = pusherClient.subscribe("lobbies");

    channel.bind("lobby-created", (lobby: LobbyEntry) => {
      setLobbies(prev => [lobby, ...prev]);
    });
    channel.bind("lobby-updated", (update: Partial<LobbyEntry> & { id: string }) => {
      setLobbies(prev => prev.map(l => l.id === update.id ? { ...l, ...update } : l));
    });
    channel.bind("lobby-deleted", ({ id }: { id: string }) => {
      setLobbies(prev => prev.filter(l => l.id !== id));
    });

    return () => { pusherClient.unsubscribe("lobbies"); };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);
    try {
      const res = await fetch("/api/lobbies/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: createName, password: createPassword || null }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error); return; }
      router.push(`/lobby/${data.lobbyId}`);
    } catch {
      setCreateError("Network error.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoin = async (lobby: LobbyEntry, password?: string) => {
    setJoinLoading(true);
    setJoinError("");
    try {
      const res = await fetch("/api/lobbies/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lobbyId: lobby.id, password: password || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "This lobby requires a password.") {
          setJoinTarget(lobby);
          setJoinLoading(false);
          return;
        }
        setJoinError(data.error);
        setJoinLoading(false);
        return;
      }
      router.push(`/lobby/${lobby.id}`);
    } catch {
      setJoinError("Network error.");
      setJoinLoading(false);
    }
  };

  if (!username) return null;

  return (
    <main className={styles.main}>
      <div className={styles.bg} aria-hidden="true" />

      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => router.push("/")}>← Back</button>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>The Hall</h1>
            <p className={styles.subtitle}>Choose your table</p>
          </div>
          <button className={styles.createBtn} onClick={() => setShowCreate(true)}>
            + Create Lobby
          </button>
        </div>

        <div className={styles.divider}><span>♠ ✦ ♠</span></div>

        {/* Lobby list */}
        {loading ? (
          <div className={styles.emptyState}>
            <span className={styles.loadingDots}><span>·</span><span>·</span><span>·</span></span>
          </div>
        ) : lobbies.length === 0 ? (
          <div className={styles.emptyState}>
            <p className={styles.emptyIcon}>🃏</p>
            <p className={styles.emptyText}>No tables open yet.</p>
            <p className={styles.emptyHint}>Be the first to create one.</p>
          </div>
        ) : (
          <div className={styles.lobbyList}>
            {lobbies.map(lobby => (
              <div key={lobby.id} className={styles.lobbyCard}>
                <div className={styles.lobbyInfo}>
                  <div className={styles.lobbyName}>
                    {lobby.hasPassword && <span className={styles.lockIcon}>🔒</span>}
                    {lobby.name}
                  </div>
                  <div className={styles.lobbyMeta}>
                    Hosted by <span className={styles.host}>{lobby.hostUsername}</span>
                  </div>
                </div>
                <div className={styles.lobbyRight}>
                  <div className={styles.playerCount}>
                    <span className={lobby.players.length >= lobby.maxPlayers ? styles.full : styles.open}>
                      {lobby.players.length}/{lobby.maxPlayers}
                    </span>
                    <span className={styles.playerLabel}>players</span>
                  </div>
                  <button
                    className={styles.joinBtn}
                    disabled={lobby.players.length >= lobby.maxPlayers || lobby.players.includes(username)}
                    onClick={() => handleJoin(lobby)}
                  >
                    {lobby.players.includes(username)
                      ? "Joined"
                      : lobby.players.length >= lobby.maxPlayers
                      ? "Full"
                      : "Join"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {joinError && <p className={styles.globalError}>⚠ {joinError}</p>}
      </div>

      {/* Create lobby modal */}
      {showCreate && (
        <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div className={styles.modal}>
            <span className={styles.cornerTl}>♠</span>
            <span className={styles.cornerBr}>♦</span>
            <button className={styles.closeBtn} onClick={() => setShowCreate(false)}>✕</button>
            <h2 className={styles.modalTitle}>Create a Table</h2>
            <div className={styles.modalDivider} />
            <form onSubmit={handleCreate} className={styles.form} noValidate>
              <div className={styles.field}>
                <label className={styles.label}>Table Name</label>
                <input
                  className={styles.input}
                  type="text"
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  placeholder="e.g. Friday Night Duel"
                  autoFocus
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Password <span className={styles.optional}>(optional)</span></label>
                <input
                  className={styles.input}
                  type="password"
                  value={createPassword}
                  onChange={e => setCreatePassword(e.target.value)}
                  placeholder="Leave blank for open table"
                />
              </div>
              {createError && <p className={styles.error}>⚠ {createError}</p>}
              <button type="submit" className={styles.submitBtn} disabled={createLoading}>
                {createLoading ? "Creating..." : "Open Table"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Join password modal */}
      {joinTarget && (
        <div className={styles.overlay} onClick={e => { if (e.target === e.currentTarget) { setJoinTarget(null); setJoinPassword(""); setJoinError(""); }}}>
          <div className={styles.modal}>
            <span className={styles.cornerTl}>♠</span>
            <span className={styles.cornerBr}>♦</span>
            <button className={styles.closeBtn} onClick={() => { setJoinTarget(null); setJoinPassword(""); setJoinError(""); }}>✕</button>
            <h2 className={styles.modalTitle}>🔒 Password Required</h2>
            <p className={styles.modalSubtitle}>{joinTarget.name}</p>
            <div className={styles.modalDivider} />
            <form onSubmit={e => { e.preventDefault(); handleJoin(joinTarget, joinPassword); }} className={styles.form} noValidate>
              <div className={styles.field}>
                <label className={styles.label}>Table Password</label>
                <input
                  className={styles.input}
                  type="password"
                  value={joinPassword}
                  onChange={e => setJoinPassword(e.target.value)}
                  placeholder="Enter password"
                  autoFocus
                  required
                />
              </div>
              {joinError && <p className={styles.error}>⚠ {joinError}</p>}
              <button type="submit" className={styles.submitBtn} disabled={joinLoading}>
                {joinLoading ? "Joining..." : "Enter Table"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
