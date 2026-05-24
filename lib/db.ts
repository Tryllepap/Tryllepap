import { User } from "./session";

const memStore: Record<string, string> = {};

async function kvGet(key: string): Promise<string | null> {
  if (process.env.KV_REST_API_URL) {
    const { kv } = await import("@vercel/kv");
    return kv.get<string>(key);
  }
  return memStore[key] ?? null;
}

async function kvSet(key: string, value: string): Promise<void> {
  if (process.env.KV_REST_API_URL) {
    const { kv } = await import("@vercel/kv");
    await kv.set(key, value);
    return;
  }
  memStore[key] = value;
}

export async function getUserByUsername(username: string): Promise<User | null> {
  const raw = await kvGet(`user:${username.toLowerCase()}`);
  if (!raw) return null;
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
