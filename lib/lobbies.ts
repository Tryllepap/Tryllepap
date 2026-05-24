import { Redis } from "@upstash/redis";

export interface Lobby {
  id: string;
  name: string;
  hostUsername: string;
  passwordHash: string | null;
  players: string[];
  maxPlayers: number;
  status: "waiting" | "starting" | "ingame";
  createdAt: string;
}

const memStore: Record<string, string> = {};

function getRedis(): Redis | null {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  }
  return null;
}

async function kvGet(key: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    const val = await redis.get<string>(key);
    return val ?? null;
  }
  return memStore[key] ?? null;
}

async function kvSet(key: string, value: string, exSeconds?: number): Promise<void> {
  const redis = getRedis();
  if (redis) {
    if (exSeconds) {
      await redis.set(key, value, { ex: exSeconds });
    } else {
      await redis.set(key, value);
    }
    return;
  }
  memStore[key] = value;
}

async function kvDelete(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(key);
    return;
  }
  delete memStore[key];
}

async function kvKeys(pattern: string): Promise<string[]> {
  const redis = getRedis();
  if (redis) {
    return redis.keys(pattern);
  }
  return Object.keys(memStore).filter(k => k.startsWith(pattern.replace("*", "")));
}

export async function getLobby(id: string): Promise<Lobby | null> {
  const raw = await kvGet(`lobby:${id}`);
  if (!raw) return null;
  if (typeof raw === "object") return raw as Lobby;
  return JSON.parse(raw) as Lobby;
}

export async function saveLobby(lobby: Lobby): Promise<void> {
  // Lobbies expire after 2 hours automatically
  await kvSet(`lobby:${lobby.id}`, JSON.stringify(lobby), 60 * 60 * 2);
}

export async function deleteLobby(id: string): Promise<void> {
  await kvDelete(`lobby:${id}`);
}

export async function getAllLobbies(): Promise<Lobby[]> {
  const keys = await kvKeys("lobby:*");
  if (keys.length === 0) return [];
  const redis = getRedis();
  const lobbies: Lobby[] = [];
  for (const key of keys) {
    const raw = redis
      ? await redis.get<string>(key)
      : memStore[key] ?? null;
    if (!raw) continue;
    const lobby = typeof raw === "object" ? (raw as Lobby) : JSON.parse(raw as string) as Lobby;
    if (lobby.status !== "ingame") lobbies.push(lobby);
  }
  return lobbies.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
