/**
 * NextAuth.js v4 route handler (App Router).
 * Email (magic-link) provider + custom SQLite adapter.
 *
 * TODO: Import and add OAuth providers here (e.g. Google, Discord)
 */

import NextAuth from "next-auth";
import EmailProvider from "next-auth/providers/email";
import { SQLiteAdapter } from "@/lib/sqlite-adapter";

const handler = NextAuth({
  adapter: SQLiteAdapter(),

  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
    // TODO: Add OAuth providers here
    // GoogleProvider({ clientId: ..., clientSecret: ... }),
  ],

  pages: {
    signIn: "/auth/signin",
    verifyRequest: "/auth/verify-request",
    // TODO: Build a custom error page
  },

  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        (session.user as any).id = user.id;
      }
      return session;
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith(baseUrl)) return url;
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      return `${baseUrl}/welcome`;
    },
  },

  // TODO: Add events (e.g. welcome email on first sign-in)
});

export { handler as GET, handler as POST };
