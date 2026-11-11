/**
 * Russell Can Write: the save file and the rules that change it (XP, ranks, stars, streaks,
 * review). Pure functions, so the same rules run in the browser and in tests.
 */
import { DISPATCHES } from "./content";
import { RANKS, REGIONS, SKILLS, type RegionId, type SkillId } from "./regions";
import type { Gauges } from "./analyse";

export type Draft = { at: string; text: string; total: number; gauges: Gauges; words: number; runOnsPer100: number; claimFirst: boolean };

export type SaveState = {
  v: 1;
  xp: number;
  /** stars 0-3 per region per skill */
  territories: Partial<Record<RegionId, Partial<Record<SkillId, number>>>>;
  sieges: Record<string, { best: number; won: boolean; drafts: Draft[] }>;
  skills: Partial<Record<SkillId, { right: number; total: number; recent: number[]; lastDay: string }>>;
  days: Record<string, { xp: number; items: number; writes: number }>;
  streak: { count: number; lastDay: string; freezeWeek: string };
  bestCombo: number;
  sound: boolean;
};

export function emptyState(): SaveState {
  return {
    v: 1,
    xp: 0,
    territories: {},
    sieges: {},
    skills: {},
    days: {},
    streak: { count: 0, lastDay: "", freezeWeek: "" },
    bestCombo: 0,
    sound: true,
  };
}

/** Accept whatever came back from storage; fill gaps so old saves keep working. */
export function normaliseState(raw: unknown): SaveState {
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<SaveState>;
  return {
    ...base,
    ...r,
    v: 1,
    territories: r.territories ?? {},
    sieges: r.sieges ?? {},
    skills: r.skills ?? {},
    days: r.days ?? {},
    streak: { ...base.streak, ...(r.streak ?? {}) },
  };
}

/* ---------- days (Bangkok) ---------- */

export function dayKey(d = new Date()): string {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week, as a day key. */
export function weekKey(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(key, -dow);
}

/* ---------- XP and ranks ---------- */

/** XP needed to reach level L (level 0 = Recruit at 0 XP). */
export function xpForLevel(level: number): number {
  return 60 * level * (level + 1);
}

export function levelFor(xp: number): { level: number; rank: string; into: number; span: number } {
  let level = 0;
  while (level < RANKS.length - 1 && xp >= xpForLevel(level + 1)) level++;
  const start = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, rank: RANKS[level]!, into: xp - start, span: next - start };
}

/** A day counts towards the streak once this much XP is earned. */
export const STREAK_XP = 60;

export function addXp(s: SaveState, amount: number, now = new Date()): SaveState {
  const today = dayKey(now);
  const day = s.days[today] ?? { xp: 0, items: 0, writes: 0 };
  const before = day.xp;
  const next: SaveState = { ...s, xp: s.xp + amount, days: { ...s.days, [today]: { ...day, xp: day.xp + amount } } };
  if (before < STREAK_XP && day.xp + amount >= STREAK_XP) return bumpStreak(next, today);
  return next;
}

/** Called once on the day the streak target is reached. One missed day a week is forgiven. */
export function bumpStreak(s: SaveState, today: string): SaveState {
  const { count, lastDay, freezeWeek } = s.streak;
  if (lastDay === today) return s;
  if (lastDay === addDays(today, -1)) return { ...s, streak: { count: count + 1, lastDay: today, freezeWeek } };
  if (lastDay === addDays(today, -2) && freezeWeek !== weekKey(today)) {
    return { ...s, streak: { count: count + 1, lastDay: today, freezeWeek: weekKey(today) } };
  }
  return { ...s, streak: { count: 1, lastDay: today, freezeWeek } };
}

/** The streak as it stands today (0 if it has lapsed beyond the freeze). */
export function liveStreak(s: SaveState, now = new Date()): number {
  const today = dayKey(now);
  const { count, lastDay, freezeWeek } = s.streak;
  if (!lastDay) return 0;
  if (lastDay === today || lastDay === addDays(today, -1)) return count;
  if (lastDay === addDays(today, -2) && freezeWeek !== weekKey(today)) return count;
  return 0;
}

/* ---------- answers ---------- */

export function recordAnswer(s: SaveState, skill: SkillId, right: boolean, now = new Date()): SaveState {
  const today = dayKey(now);
  const cur = s.skills[skill] ?? { right: 0, total: 0, recent: [], lastDay: today };
  const recent = [...cur.recent, right ? 1 : 0].slice(-30);
  const day = s.days[today] ?? { xp: 0, items: 0, writes: 0 };
  return {
    ...s,
    skills: { ...s.skills, [skill]: { right: cur.right + (right ? 1 : 0), total: cur.total + 1, recent, lastDay: today } },
    days: { ...s.days, [today]: { ...day, items: day.items + 1 } },
  };
}

export function accuracy(s: SaveState, skill: SkillId): number | null {
  const r = s.skills[skill]?.recent;
  if (!r || r.length === 0) return null;
  return r.reduce((a, b) => a + b, 0) / r.length;
}

/** Skills that need work: lowest recent accuracy first, then skills not played for 4+ days ("unrest"). */
export function weakSkills(s: SaveState, now = new Date()): SkillId[] {
  const today = dayKey(now);
  const scored = SKILLS.filter((k) => k.id !== "peal").map((k) => {
    const acc = accuracy(s, k.id);
    const last = s.skills[k.id]?.lastDay;
    const stale = last ? last <= addDays(today, -4) : false;
    return { id: k.id, acc: acc ?? 0.6, stale };
  });
  scored.sort((a, b) => a.acc - b.acc);
  const weak = scored.filter((x) => x.acc < 0.85 || x.stale).map((x) => x.id);
  return (weak.length ? weak : scored.map((x) => x.id)).slice(0, 3);
}

/** Skills with stars that have not been played for 4+ days: the territories in unrest. */
export function unrest(s: SaveState, now = new Date()): SkillId[] {
  const cutoff = addDays(dayKey(now), -4);
  return SKILLS.filter((k) => {
    const last = s.skills[k.id]?.lastDay;
    return !!last && last <= cutoff;
  }).map((k) => k.id);
}

/* ---------- territories and regions ---------- */

export function stars(s: SaveState, region: RegionId, skill: SkillId): number {
  return s.territories[region]?.[skill] ?? 0;
}

export function setStars(s: SaveState, region: RegionId, skill: SkillId, n: number): SaveState {
  const cur = stars(s, region, skill);
  if (n <= cur) return s;
  return { ...s, territories: { ...s.territories, [region]: { ...(s.territories[region] ?? {}), [skill]: n } } };
}

export function territoriesWon(s: SaveState, region: RegionId): number {
  return SKILLS.filter((k) => stars(s, region, k.id) > 0).length;
}

/** A territory opens once the one before it is won. */
export function territoryOpen(s: SaveState, region: RegionId, skill: SkillId): boolean {
  const i = SKILLS.findIndex((k) => k.id === skill);
  if (i <= 0) return true;
  return stars(s, region, SKILLS[i - 1]!.id) > 0;
}

export const SIEGE_NEEDS = 4;

export function siegeOpen(s: SaveState, region: RegionId): boolean {
  return territoriesWon(s, region) >= SIEGE_NEEDS;
}

export function regionOpen(s: SaveState, region: RegionId): boolean {
  if (region === "boot") return true;
  return territoriesWon(s, "boot") >= 3;
}

export function regionConquered(s: SaveState, region: RegionId): boolean {
  return DISPATCHES[region].some((d) => s.sieges[d.id]?.won);
}

export function starsTotal(s: SaveState): { got: number; max: number } {
  let got = 0;
  for (const r of REGIONS) for (const k of SKILLS) got += stars(s, r.id, k.id);
  return { got, max: REGIONS.length * SKILLS.length * 3 };
}

export function starsFor(score: number, size: number, pass: number): number {
  if (score < pass) return 0;
  if (score === size) return 3;
  if (score >= size - 1) return 2;
  return 1;
}

/* ---------- writing ---------- */

export const SIEGE_XP = 150;
export const DRAFT_XP = 40;

export function recordDraft(s: SaveState, dispatchId: string, draft: Draft, won: boolean, now = new Date()): SaveState {
  const today = dayKey(now);
  const cur = s.sieges[dispatchId] ?? { best: 0, won: false, drafts: [] };
  const day = s.days[today] ?? { xp: 0, items: 0, writes: 0 };
  return {
    ...s,
    sieges: {
      ...s.sieges,
      [dispatchId]: { best: Math.max(cur.best, draft.total), won: cur.won || won, drafts: [...cur.drafts, draft].slice(-6) },
    },
    days: { ...s.days, [today]: { ...day, writes: day.writes + 1 } },
  };
}

/** Every first draft in time order, for the War Room trend. */
export function firstDrafts(s: SaveState): Array<Draft & { dispatchId: string }> {
  const out: Array<Draft & { dispatchId: string }> = [];
  for (const [id, v] of Object.entries(s.sieges)) {
    for (const d of v.drafts) out.push({ ...d, dispatchId: id });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}
