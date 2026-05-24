import { SessionOptions } from "iron-session";

export interface SessionData {
  userId: string;
  username: string;
  isLoggedIn: boolean;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "tryllepap_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  },
};

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  gameData: GameData;
  createdAt: string;
}

export interface GameData {
  wins: number;
  losses: number;
  gamesPlayed: number;
  level: number;
  xp: number;
}

export const defaultGameData: GameData = {
  wins: 0,
  losses: 0,
  gamesPlayed: 0,
  level: 1,
  xp: 0,
};
