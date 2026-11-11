/**
 * Russell Can Write: puzzle generators. Each takes correct sentences from content.ts and breaks
 * them in a known way, so every answer is certain. A seed makes a round repeatable for tests.
 */
import {
  CLAIMS,
  COMMA_SENTENCES,
  ESSAY_SPLICES,
  OPENERS,
  PAIRS,
  PEALS,
  TERMS,
  TWINS,
  type Pair,
} from "./content";
import { REGIONS, type RegionId, type SkillId } from "./regions";

export type SpliceItem = { kind: "splice"; words: string[]; boundaries: number[]; note: string };
export type ChoiceItem = {
  kind: "choice";
  skill: "fixes" | "twins" | "claim" | "terms";
  prompt: string;
  options: string[];
  answer: number;
  why: string;
};
export type CommaItem = { kind: "comma"; words: string[]; commasAfter: number[]; full: string };
export type PealOrderItem = {
  kind: "peal";
  question: string;
  /** The four sentences in shuffled order; `order[i]` is the PEAL position (0 = Point) of sentence i. */
  sentences: string[];
  order: number[];
};
export type Item = SpliceItem | ChoiceItem | CommaItem | PealOrderItem;

/* ---------- random ---------- */

export function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: readonly T[], r: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function pick<T>(arr: readonly T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)]!;
}

/* ---------- capitals ---------- */

const COMMON_STARTS = new Set([
  "the", "it", "its", "they", "their", "this", "these", "those", "he", "his", "she", "her", "a", "an",
  "many", "most", "some", "each", "every", "only", "few", "both", "neither", "readers", "messages",
  "legions", "merchants", "storms", "trade", "ideas", "ash", "waves", "earthquakes", "sailors",
  "deltas", "dams", "rising", "cutting", "armies", "more", "families", "leaders", "guerrilla",
  "hundreds", "fire", "longitude", "attacks", "charging", "however", "something", "grey", "green",
  "roman", "enemy", "neither", "our", "we", "you", "one",
]);

/** Lower-case the first word unless it is a name. "The army" -> "the army"; "Rome" stays. */
export function decap(s: string): string {
  const first = s.split(/\s+/)[0] ?? "";
  if (COMMON_STARTS.has(first.toLowerCase().replace(/[^a-z]/g, ""))) return s.charAt(0).toLowerCase() + s.slice(1);
  return s;
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const words = (s: string) => s.split(/\s+/).filter(Boolean);

/* ---------- splice slicer ---------- */

function pairsFor(region: RegionId): Pair[] {
  return PAIRS[region];
}

/** A run-on: real sentences joined by a comma (splice) or by nothing (fused). Or, sometimes, a correct join. */
export function makeSplice(region: RegionId, r: () => number): SpliceItem {
  // Boot Camp: most items come straight from Russell's essay.
  if (region === "boot" && r() < 0.6) {
    const segs = pick(ESSAY_SPLICES, r);
    return spliceFromSegments(segs, r, "From your Greenpeace essay.");
  }
  const roll = r();
  const pairs = pairsFor(region);
  if (roll < 0.18) {
    // A correct sentence: joined with a comma and a joining word. Nothing to slice.
    const [a, b, rel] = pick(pairs, r);
    const text = `${a}, ${rel} ${decap(b)}.`;
    return { kind: "splice", words: words(text), boundaries: [], note: `Correct already: ', ${rel}' can join two sentences.` };
  }
  if (roll < 0.45) {
    // Three sentences in one run-on.
    const [p1, p2] = shuffle(pairs, r);
    const segs = r() < 0.5 ? [p1![0], p1![1], p2![0]] : [p1![0], p1![1], p2![1]];
    return spliceFromSegments(segs, r, "Three sentences hiding in one.");
  }
  const [a, b] = pick(pairs, r);
  return spliceFromSegments([a, b], r, "");
}

function spliceFromSegments(segs: string[], r: () => number, note: string): SpliceItem {
  const out: string[] = [];
  const boundaries: number[] = [];
  segs.forEach((seg, i) => {
    const text = i === 0 ? seg : decap(seg);
    const w = words(text);
    if (i > 0) {
      // Join to the previous segment: a comma (comma splice) or nothing (fused sentence).
      const last = out.length - 1;
      boundaries.push(last);
      if (r() < 0.65) out[last] = `${out[last]},`;
    }
    out.push(...w);
  });
  out[out.length - 1] = `${out[out.length - 1]}.`;
  return { kind: "splice", words: out, boundaries, note };
}

/* ---------- four fixes ---------- */

const WRONG_LINKER: Record<Pair[2], string[]> = {
  but: ["however", "although"],
  so: ["therefore", "thus"],
  and: ["also", "additionally"],
};

const ADVERB: Record<Pair[2], string> = { but: "however", so: "therefore", and: "furthermore" };

/** One run-on and four repairs: exactly one is punctuated correctly. */
export function makeFixes(region: RegionId, r: () => number): ChoiceItem {
  const [a, b, rel] = pick(pairsFor(region), r);
  const lb = decap(b);
  const runOn = `${a}, ${lb}.`;
  const style = Math.floor(r() * 4);
  const adverb = ADVERB[rel];
  const correct = [
    `${a}. ${cap(lb)}.`,
    `${a}; ${lb}.`,
    `${a}, ${rel} ${lb}.`,
    `${a}; ${adverb}, ${lb}.`,
  ][style]!;
  const why = [
    "A full stop between two complete sentences is always safe.",
    "A semicolon can join two closely linked complete sentences.",
    `A comma plus a joining word ('${rel}') can join two sentences.`,
    `'${cap(adverb)}' cannot join sentences with just a comma. Use a semicolon before it and a comma after it, or start a new sentence.`,
  ][style]!;
  const linker = pick(WRONG_LINKER[rel], r);
  const wrongs = shuffle(
    [
      `${a}, ${lb}.`,
      `${a} ${lb}.`,
      `${a}, ${linker} ${lb}.`,
      `${a}, ${linker}, ${lb}.`,
      `${a}; ${rel}, ${lb}.`,
    ],
    r,
  ).slice(0, 3);
  const options = shuffle([correct, ...wrongs], r);
  return {
    kind: "choice",
    skill: "fixes",
    prompt: `Fix this run-on: "${runOn}"`,
    options,
    answer: options.indexOf(correct),
    why,
  };
}

/* ---------- comma drop ---------- */

function commaFromSentence(full: string): CommaItem {
  const raw = words(full);
  const commasAfter: number[] = [];
  const clean = raw.map((w, i) => {
    if (/,$/.test(w)) {
      commasAfter.push(i);
      return w.slice(0, -1);
    }
    return w;
  });
  return { kind: "comma", words: clean, commasAfter, full };
}

export function makeComma(region: RegionId, r: () => number): CommaItem {
  const roll = r();
  if (roll < 0.55) return commaFromSentence(pick(COMMA_SENTENCES[region], r));
  const [a, b, rel] = pick(pairsFor(region), r);
  if (roll < 0.8) return commaFromSentence(`${pick(OPENERS, r)}, ${decap(b)}.`);
  return commaFromSentence(`${a}, ${rel} ${decap(b)}.`);
}

/* ---------- choice modes ---------- */

export function makeTwins(r: () => number): ChoiceItem {
  const t = pick(TWINS, r);
  const options = shuffle(t.options, r);
  return { kind: "choice", skill: "twins", prompt: t.s, options, answer: options.indexOf(t.options[0]), why: t.why };
}

export function makeClaim(region: RegionId, r: () => number): ChoiceItem {
  const c = pick(CLAIMS[region], r);
  const options = shuffle([c.claim, c.label], r);
  return {
    kind: "choice",
    skill: "claim",
    prompt: `Topic: ${c.topic}. Which is the better topic sentence?`,
    options,
    answer: options.indexOf(c.claim),
    why: c.why,
  };
}

export function makeTerms(r: () => number): ChoiceItem {
  const t = pick(TERMS, r);
  const options = shuffle(t.options, r);
  return { kind: "choice", skill: "terms", prompt: t.example, options, answer: options.indexOf(t.options[0]), why: t.why };
}

export function makePeal(region: RegionId, r: () => number): PealOrderItem {
  const p = pick(PEALS[region], r);
  const parts = [p.p, p.e, p.a, p.l];
  const idx = shuffle([0, 1, 2, 3], r);
  return { kind: "peal", question: p.question, sentences: idx.map((i) => parts[i]!), order: idx };
}

/* ---------- rounds ---------- */

export const ROUND_SIZE: Record<SkillId, number> = {
  splice: 8,
  fixes: 8,
  comma: 8,
  twins: 10,
  claim: 6,
  peal: 4,
  terms: 8,
};

/** Score needed to win the territory. */
export function passMark(skill: SkillId): number {
  return Math.ceil(ROUND_SIZE[skill] * 0.75);
}

export function makeItem(skill: SkillId, region: RegionId, r: () => number): Item {
  switch (skill) {
    case "splice":
      return makeSplice(region, r);
    case "fixes":
      return makeFixes(region, r);
    case "comma":
      return makeComma(region, r);
    case "twins":
      return makeTwins(r);
    case "claim":
      return makeClaim(region, r);
    case "peal":
      return makePeal(region, r);
    case "terms":
      return makeTerms(r);
  }
}

function itemKey(it: Item): string {
  if (it.kind === "splice" || it.kind === "comma") return it.words.join(" ");
  if (it.kind === "peal") return it.question + it.order.join("");
  return it.prompt;
}

/** A round of distinct items (as far as the bank allows). */
export function makeRound(skill: SkillId, region: RegionId, seed: number): Item[] {
  const r = rng(seed);
  const out: Item[] = [];
  const seen = new Set<string>();
  let tries = 0;
  while (out.length < ROUND_SIZE[skill] && tries < 200) {
    tries++;
    const it = makeItem(skill, region, r);
    const k = itemKey(it);
    if (seen.has(k) && tries < 150) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

/** Mixed review round across all regions, weighted towards the weakest skills. */
export function makeMixedRound(weak: SkillId[], seed: number, size = 10): Array<{ skill: SkillId; item: Item }> {
  const r = rng(seed);
  const regions = REGIONS.map((x) => x.id);
  const pool: SkillId[] = weak.length ? weak : ["splice", "fixes", "comma", "twins"];
  const out: Array<{ skill: SkillId; item: Item }> = [];
  for (let i = 0; i < size; i++) {
    const skill = pick(pool, r);
    const usable: SkillId = skill === "peal" ? "claim" : skill;
    out.push({ skill: usable, item: makeItem(usable, pick(regions, r), r) });
  }
  return out;
}

/** How many distinct puzzles the generators can make: shown on the map so Russell sees the size. */
export function bankSize(): number {
  let n = 0;
  for (const reg of REGIONS) {
    const p = PAIRS[reg.id].length;
    // two-sentence splices (two join styles), three-sentence splices, correct joins
    n += p * 2 + p * (p - 1) * 2 + p;
    // fixes: four repair styles × two wrong-option sets
    n += p * 4 * 2;
    // comma: authored + openers + conjunctions
    n += COMMA_SENTENCES[reg.id].length + p * OPENERS.length + p;
    n += CLAIMS[reg.id].length + PEALS[reg.id].length * 24;
  }
  n += ESSAY_SPLICES.length + TWINS.length + TERMS.length;
  return n;
}
