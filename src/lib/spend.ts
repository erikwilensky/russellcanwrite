/**
 * AI spend control. Every coach call's token usage is priced and added to a monthly total in
 * DATA_DIR/ai-spend.json. When the month's total plus the worst case for one more call would pass
 * the cap (AI_MONTHLY_LIMIT_USD, default $10), the coach is not called and the built-in rules mark
 * the paragraph instead. A daily call limit stops a runaway loop well before the monthly cap.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDir } from "./store";

/** US dollars per million tokens: [input, output]. Unknown models are priced high on purpose. */
const PRICES: Record<string, [number, number]> = {
  "gpt-4o-mini": [0.15, 0.6],
  "gpt-4.1-mini": [0.4, 1.6],
  "gpt-4.1-nano": [0.1, 0.4],
  "gpt-4o": [2.5, 10],
  "gpt-4.1": [2, 8],
};
const UNKNOWN_PRICE: [number, number] = [15, 60];

export const MAX_OUTPUT_TOKENS = 600;
/** One call sends the system prompt plus at most 4,000 characters of writing: well under 3,000 tokens. */
const MAX_INPUT_TOKENS = 3000;

export function monthlyLimit(): number {
  const v = Number(process.env.AI_MONTHLY_LIMIT_USD);
  return Number.isFinite(v) && v >= 0 ? v : 10;
}

export function dailyCallLimit(): number {
  const v = Number(process.env.AI_DAILY_CALL_LIMIT);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 60;
}

export function priceFor(model: string): [number, number] {
  return PRICES[model] ?? UNKNOWN_PRICE;
}

export function costOf(model: string, inputTokens: number, outputTokens: number): number {
  const [i, o] = priceFor(model);
  return (inputTokens * i + outputTokens * o) / 1_000_000;
}

export function worstCaseCall(model: string): number {
  return costOf(model, MAX_INPUT_TOKENS, MAX_OUTPUT_TOKENS);
}

export type SpendLog = { month: string; usd: number; calls: number; day: string; dayCalls: number };

function bangkok(now: Date): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString();
}

export function emptyLog(now = new Date()): SpendLog {
  const b = bangkok(now);
  return { month: b.slice(0, 7), usd: 0, calls: 0, day: b.slice(0, 10), dayCalls: 0 };
}

/** Roll the log over to the current month and day (Bangkok time). */
export function current(log: SpendLog | null, now = new Date()): SpendLog {
  const fresh = emptyLog(now);
  if (!log || log.month !== fresh.month) return fresh;
  if (log.day !== fresh.day) return { ...log, day: fresh.day, dayCalls: 0 };
  return log;
}

export function mayCall(log: SpendLog, model: string): boolean {
  return log.usd + worstCaseCall(model) <= monthlyLimit() && log.dayCalls < dailyCallLimit();
}

export function withCall(log: SpendLog, usd: number): SpendLog {
  return { ...log, usd: log.usd + usd, calls: log.calls + 1, dayCalls: log.dayCalls + 1 };
}

const file = () => path.join(dataDir(), "ai-spend.json");

export async function readSpend(now = new Date()): Promise<SpendLog> {
  try {
    return current(JSON.parse(await readFile(file(), "utf8")) as SpendLog, now);
  } catch {
    return emptyLog(now);
  }
}

export async function writeSpend(log: SpendLog): Promise<void> {
  await mkdir(dataDir(), { recursive: true });
  const tmp = `${file()}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, JSON.stringify(log), "utf8");
  await rename(tmp, file());
}

/** Calls run one at a time so two quick submits cannot both slip under the cap. */
let chain: Promise<unknown> = Promise.resolve();
export function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.catch(() => undefined);
  return next;
}
