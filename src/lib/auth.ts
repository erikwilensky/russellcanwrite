/**
 * Russell Can Write sign-in: one shared code (Erik's choice, 2026-11-11), no accounts.
 * A correct code sets an httpOnly cookie holding an HMAC of the code, so changing
 * RCW_ACCESS_CODE signs every device out.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const RCW_COOKIE = "rcw_session";

function accessCode(): string {
  return (process.env.RCW_ACCESS_CODE ?? "67766776").trim();
}

function token(): string {
  const secret = process.env.AUTH_SECRET || "rcw-local-dev";
  return createHmac("sha256", secret).update(`rcw:${accessCode()}`).digest("hex");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function codeMatches(code: string): boolean {
  return same(code.replace(/\s+/g, ""), accessCode());
}

export function sessionToken(): string {
  return token();
}

export async function rcwSignedIn(): Promise<boolean> {
  const jar = await cookies();
  const v = jar.get(RCW_COOKIE)?.value;
  return !!v && same(v, token());
}

/* Ten wrong codes in ten minutes from one address locks that address out for the rest of the window. */
const attempts = new Map<string, { n: number; since: number }>();
const WINDOW_MS = 10 * 60_000;

export function tooManyAttempts(ip: string, now = Date.now()): boolean {
  const a = attempts.get(ip);
  if (!a || now - a.since > WINDOW_MS) return false;
  return a.n >= 10;
}

export function noteFailedAttempt(ip: string, now = Date.now()): void {
  const a = attempts.get(ip);
  if (!a || now - a.since > WINDOW_MS) attempts.set(ip, { n: 1, since: now });
  else a.n++;
}
