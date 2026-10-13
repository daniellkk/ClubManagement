import type { CookieOptions } from "express";

export const SESSION_COOKIE = "club_session";
export const SESSION_TTL_DAYS = 7;

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  };
}

export interface SessionPayload {
  sub: string;
  clubId: string;
  email: string;
  name: string;
  role: string;
}
