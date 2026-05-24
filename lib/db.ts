import { User } from "./session";
import { Redis } from "@upstash/redis";

// In-memory fallback for local dev without KV credentials
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

async function kvSet(key: string, value: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(key, value);
    return;
  }
  memStore[key] = value;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const raw = await kvGet(`user:${username.toLowerCase()}`);
  if (!raw) return null;
  // Upstash may auto-parse JSON, so handle both string and object
  if (typeof raw === "object") return raw as User;
  return JSON.parse(raw) as User;
}

export async function createUser(user: User): Promise<void> {
  await kvSet(`user:${user.username.toLowerCase()}`, JSON.stringify(user));
}

export async function updateUser(user: User): Promise<void> {
  await kvSet(`user:${user.username.toLowerCase()}`, JSON.stringify(user));
}

export async function usernameExists(username: string): Promise<boolean> {
  const raw = await kvGet(`user:${username.toLowerCase()}`);
  return raw !== null;
}
