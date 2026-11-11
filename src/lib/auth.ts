/**
 * Russell Can Write sign-in: one shared code set in RCW_ACCESS_CODE, no accounts.
 * A correct code sets an httpOnly cookie holding an HMAC of the code, so changing
 * RCW_ACCESS_CODE signs every device out.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const RCW_COOKIE = "rcw_session";

/** The code is set on the server only. With none set, production accepts no code at all. */
function accessCode(): string {
  const set = process.env.RCW_ACCESS_CODE?.trim();
  if (set) return set;
  return process.env.NODE_ENV === "production" ? "" : "00000000";
}

/** Optional second code for a guest (e.g. Russell's teacher): every task open, nothing saved, no AI. */
function guestCode(): string {
  const set = process.env.RCW_GUEST_CODE?.trim();
  if (set) return set;
  return process.env.NODE_ENV === "production" ? "" : "11111111";
}

export type Role = "russell" | "guest";

function secret(): string {
  const v = process.env.AUTH_SECRET || (process.env.NODE_ENV === "production" ? "" : "rcw-local-dev");
  if (!v) throw new Error("AUTH_SECRET is not set");
  return v;
}

function token(role: Role = "russell"): string {
  const material = role === "guest" ? `rcw-guest:${guestCode()}` : `rcw:${accessCode()}`;
  return createHmac("sha256", secret()).update(material).digest("hex");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function codeMatches(code: string): boolean {
  return roleForCode(code) === "russell";
}

/** Which role a typed code opens. Russell's code wins if the two are ever set the same. */
export function roleForCode(code: string): Role | null {
  const c = code.replace(/\s+/g, "");
  const main = accessCode();
  if (main && same(c, main)) return "russell";
  const guest = guestCode();
  if (guest && same(c, guest)) return "guest";
  return null;
}

export function sessionToken(role: Role = "russell"): string {
  return token(role);
}

export async function rcwRole(): Promise<Role | null> {
  const jar = await cookies();
  const v = jar.get(RCW_COOKIE)?.value;
  if (!v) return null;
  if (same(v, token("russell"))) return "russell";
  if (guestCode() && same(v, token("guest"))) return "guest";
  return null;
}

/** True only for Russell (the saving, AI-coached player). */
export async function rcwSignedIn(): Promise<boolean> {
  return (await rcwRole()) === "russell";
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
