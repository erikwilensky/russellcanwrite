import { NextResponse } from "next/server";
import { codeMatches, noteFailedAttempt, RCW_COOKIE, sessionToken, tooManyAttempts } from "@/lib/auth";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
  if (tooManyAttempts(ip)) {
    return NextResponse.json({ ok: false, error: "Too many tries. Wait ten minutes." }, { status: 429 });
  }
  const body = (await req.json().catch(() => ({}))) as { code?: unknown };
  const code = typeof body.code === "string" ? body.code : "";
  if (!codeMatches(code)) {
    noteFailedAttempt(ip);
    return NextResponse.json({ ok: false, error: "Wrong code." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(RCW_COOKIE, sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(RCW_COOKIE);
  return res;
}
