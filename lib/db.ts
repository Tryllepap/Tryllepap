/**
 * Initialises a SQLite database for NextAuth and local user data.
 * Uses better-sqlite3 (synchronous API).
 *
 * TODO: Replace with a cloud database before going to production with real users.
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.SQLITE_DB_PATH ?? "./data/cardgame.db";

const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

// Singleton — reuse connection across hot-reloads in dev
const globalForDb = global as unknown as { db: Database.Database };

export const db: Database.Database =
  globalForDb.db ?? new Database(path.resolve(DB_PATH));

if (process.env.NODE_ENV !== "production") {
  globalForDb.db = db;
}

// ── NextAuth required tables ──────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    emailVerified DATETIME,
    image TEXT
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT NOT NULL PRIMARY KEY,
    userId TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    providerAccountId TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    UNIQUE (provider, providerAccountId)
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT NOT NULL PRIMARY KEY,
    sessionToken TEXT UNIQUE NOT NULL,
    userId TEXT NOT NULL,
    expires DATETIME NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verification_tokens (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL,
    expires DATETIME NOT NULL,
    PRIMARY KEY (identifier, token)
  );
`);

// ── App-specific tables ───────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS user_profiles (
    userId TEXT NOT NULL PRIMARY KEY,
    username TEXT UNIQUE,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    -- TODO: Add avatar, bio, game stats, etc. in future steps
  );
`);

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getUserProfile(userId: string) {
  return db
    .prepare("SELECT * FROM user_profiles WHERE userId = ?")
    .get(userId) as { userId: string; username: string | null } | undefined;
}

export function upsertUsername(userId: string, username: string) {
  db.prepare(`
    INSERT INTO user_profiles (userId, username, updatedAt)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(userId) DO UPDATE SET
      username = excluded.username,
      updatedAt = CURRENT_TIMESTAMP
  `).run(userId, username);
}

export function isUsernameTaken(username: string, excludeUserId?: string) {
  const row = db
    .prepare(
      "SELECT userId FROM user_profiles WHERE LOWER(username) = LOWER(?) AND userId != COALESCE(?, '')"
    )
    .get(username, excludeUserId ?? "") as { userId: string } | undefined;
  return !!row;
}
