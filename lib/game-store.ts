import { GameState } from "./game";
import { Redis } from "@upstash/redis";

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

export async function getGameState(lobbyId: string): Promise<GameState | null> {
  const redis = getRedis();
  const key = `game:${lobbyId}`;
  const raw = redis ? await redis.get<string>(key) : memStore[key] ?? null;
  if (!raw) return null;
  if (typeof raw === "object") return raw as GameState;
  return JSON.parse(raw) as GameState;
}

export async function saveGameState(lobbyId: string, state: GameState): Promise<void> {
  const redis = getRedis();
  const key = `game:${lobbyId}`;
  const value = JSON.stringify(state);
  if (redis) {
    await redis.set(key, value, { ex: 60 * 60 * 6 }); // 6 hour expiry
  } else {
    memStore[key] = value;
  }
}
