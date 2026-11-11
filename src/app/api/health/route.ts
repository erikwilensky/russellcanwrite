import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { NextResponse } from "next/server";
import { monthlyLimit, readSpend } from "@/lib/spend";
import { dataDir } from "@/lib/store";

export const dynamic = "force-dynamic";

/** 200 when the app is configured and can write its save file; 503 (with the missing names) otherwise. */
export async function GET() {
  const missing: string[] = [];
  if (!process.env.AUTH_SECRET?.trim()) missing.push("AUTH_SECRET");
  if (!process.env.RCW_ACCESS_CODE?.trim()) missing.push("RCW_ACCESS_CODE");
  let dataWritable = true;
  try {
    await mkdir(dataDir(), { recursive: true });
    await access(dataDir(), constants.W_OK);
  } catch {
    dataWritable = false;
  }
  const ok = missing.length === 0 && dataWritable;
  const spend = await readSpend();
  const ai = {
    on: !!process.env.OPENAI_API_KEY?.trim(),
    month: spend.month,
    spentUsd: Math.round(spend.usd * 100) / 100,
    limitUsd: monthlyLimit(),
    calls: spend.calls,
  };
  return NextResponse.json({ ok, missing, dataWritable, ai }, { status: ok ? 200 : 503 });
}
