/**
 * Minimal NextAuth v4 database adapter backed by better-sqlite3.
 * Implements only what NextAuth needs for Email (magic-link) auth.
 *
 * Reference: https://next-auth.js.org/tutorials/creating-a-database-adapter
 *
 * TODO: Add OAuth account linking methods when OAuth providers are added.
 */

import type {
  Adapter,
  AdapterUser,
  AdapterSession,
  VerificationToken,
} from "next-auth/adapters";
import { db } from "./db";
import { randomUUID } from "crypto";

export function SQLiteAdapter(): Adapter {
  return {
    // ── Users ─────────────────────────────────────────────────────────────────

    async createUser(user) {
      const id = randomUUID();
      db.prepare(`
        INSERT INTO users (id, name, email, emailVerified, image)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        id,
        user.name ?? null,
        user.email,
        user.emailVerified?.toISOString() ?? null,
        user.image ?? null
      );
      return { ...user, id };
    },

    async getUser(id) {
      const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
      if (!row) return null;
      return dbRowToUser(row);
    },

    async getUserByEmail(email) {
      const row = db
        .prepare("SELECT * FROM users WHERE email = ?")
        .get(email) as any;
      if (!row) return null;
      return dbRowToUser(row);
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const row = db
        .prepare(`
          SELECT u.* FROM users u
          JOIN accounts a ON u.id = a.userId
          WHERE a.provider = ? AND a.providerAccountId = ?
        `)
        .get(provider, providerAccountId) as any;
      if (!row) return null;
      return dbRowToUser(row);
    },

    async updateUser(user) {
      db.prepare(`
        UPDATE users SET name = ?, email = ?, emailVerified = ?, image = ?
        WHERE id = ?
      `).run(
        user.name ?? null,
        user.email,
        user.emailVerified?.toISOString() ?? null,
        user.image ?? null,
        user.id
      );
      const row = db
        .prepare("SELECT * FROM users WHERE id = ?")
        .get(user.id) as any;
      return dbRowToUser(row);
    },

    // ── Sessions ──────────────────────────────────────────────────────────────

    async createSession(session) {
      const id = randomUUID();
      db.prepare(`
        INSERT INTO sessions (id, sessionToken, userId, expires)
        VALUES (?, ?, ?, ?)
      `).run(id, session.sessionToken, session.userId, session.expires.toISOString());
      return session;
    },

    async getSessionAndUser(sessionToken) {
      const row = db
        .prepare(`
          SELECT s.*, u.id as uId, u.name, u.email, u.emailVerified, u.image
          FROM sessions s
          JOIN users u ON s.userId = u.id
          WHERE s.sessionToken = ? AND s.expires > datetime('now')
        `)
        .get(sessionToken) as any;
      if (!row) return null;
      return {
        session: {
          sessionToken: row.sessionToken,
          userId: row.userId,
          expires: new Date(row.expires),
        } as AdapterSession,
        user: {
          id: row.uId,
          name: row.name,
          email: row.email,
          emailVerified: row.emailVerified ? new Date(row.emailVerified) : null,
          image: row.image,
        } as AdapterUser,
      };
    },

    async updateSession(session) {
      db.prepare(`
        UPDATE sessions SET expires = ? WHERE sessionToken = ?
      `).run(session.expires?.toISOString(), session.sessionToken);
      const row = db
        .prepare("SELECT * FROM sessions WHERE sessionToken = ?")
        .get(session.sessionToken) as any;
      if (!row) return null;
      return { ...row, expires: new Date(row.expires) } as AdapterSession;
    },

    async deleteSession(sessionToken) {
      db.prepare("DELETE FROM sessions WHERE sessionToken = ?").run(sessionToken);
    },

    // ── Verification tokens (magic links) ─────────────────────────────────────

    async createVerificationToken(token) {
      db.prepare(`
        INSERT INTO verification_tokens (identifier, token, expires)
        VALUES (?, ?, ?)
      `).run(token.identifier, token.token, token.expires.toISOString());
      return token;
    },

    async useVerificationToken({ identifier, token }) {
      const row = db
        .prepare(`
          SELECT * FROM verification_tokens WHERE identifier = ? AND token = ?
        `)
        .get(identifier, token) as any;
      if (!row) return null;
      db.prepare(`
        DELETE FROM verification_tokens WHERE identifier = ? AND token = ?
      `).run(identifier, token);
      return { ...row, expires: new Date(row.expires) } as VerificationToken;
    },

    // ── Accounts (for OAuth — not used yet) ───────────────────────────────────

    async linkAccount(account) {
      const id = randomUUID();
      db.prepare(`
        INSERT INTO accounts (
          id, userId, type, provider, providerAccountId,
          refresh_token, access_token, expires_at, token_type,
          scope, id_token, session_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        account.userId,
        account.type,
        account.provider,
        account.providerAccountId,
        account.refresh_token ?? null,
        account.access_token ?? null,
        account.expires_at ?? null,
        account.token_type ?? null,
        account.scope ?? null,
        account.id_token ?? null,
        account.session_state ?? null
      );
      return account;
    },

    async unlinkAccount({ provider, providerAccountId }) {
      db.prepare(`
        DELETE FROM accounts WHERE provider = ? AND providerAccountId = ?
      `).run(provider, providerAccountId);
    },
  };
}

function dbRowToUser(row: any): AdapterUser {
  return {
    id: row.id,
    name: row.name ?? null,
    email: row.email,
    emailVerified: row.emailVerified ? new Date(row.emailVerified) : null,
    image: row.image ?? null,
  };
}
