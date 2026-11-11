import { NextResponse } from "next/server";
import { rcwSignedIn } from "@/lib/auth";
import { normaliseState } from "@/lib/state";
import { readSave, writeSave } from "@/lib/store";

/** Russell's whole save file lives on the server, so it follows him across devices. */
export async function GET() {
  if (!(await rcwSignedIn())) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, state: await readSave() });
}

const MAX_BYTES = 600_000;

export async function PUT(req: Request) {
  if (!(await rcwSignedIn())) return NextResponse.json({ ok: false }, { status: 401 });
  const text = await req.text();
  if (text.length > MAX_BYTES) return NextResponse.json({ ok: false, error: "Save file too large." }, { status: 413 });
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Bad save file." }, { status: 400 });
  }
  await writeSave(normaliseState((parsed as { state?: unknown })?.state));
  return NextResponse.json({ ok: true });
}

/** navigator.sendBeacon can only POST: same as PUT, used when the page closes mid-save. */
export const POST = PUT;
