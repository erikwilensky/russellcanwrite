import { describe, expect, it } from "vitest";
import { analyse } from "./analyse";
import { CLAIMS, COMMA_SENTENCES, DISPATCHES, PAIRS, PEALS } from "./content";

import { bankSize, decap, makeComma, makeFixes, makeRound, makeSplice, passMark, ROUND_SIZE, rng } from "./items";
import { REGIONS, SKILLS } from "./regions";
import { addXp, bumpStreak, emptyState, levelFor, liveStreak, regionOpen, setStars, siegeOpen, starsFor } from "./state";

describe("content", () => {
  it("every region has pairs, comma sentences, claims, PEAL paragraphs and dispatches", () => {
    for (const r of REGIONS) {
      expect(PAIRS[r.id].length, r.id).toBeGreaterThanOrEqual(10);
      expect(COMMA_SENTENCES[r.id].length, r.id).toBeGreaterThanOrEqual(6);
      expect(CLAIMS[r.id].length, r.id).toBeGreaterThanOrEqual(4);
      expect(PEALS[r.id].length, r.id).toBeGreaterThanOrEqual(2);
      expect(DISPATCHES[r.id].length, r.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("pair halves are bare sentences: no final full stop, no leading linker", () => {
    for (const r of REGIONS) {
      for (const [a, b] of PAIRS[r.id]) {
        expect(a.endsWith("."), a).toBe(false);
        expect(b.endsWith("."), b).toBe(false);
        expect(/^(however|thus|therefore)\b/i.test(b), b).toBe(false);
      }
    }
  });

  it("dispatch ids are unique", () => {
    const ids = Object.values(DISPATCHES).flat().map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("the bank holds thousands of puzzles", () => {
    expect(bankSize()).toBeGreaterThan(5000);
  });
});

describe("generators", () => {
  it("keeps names capitalised and lower-cases ordinary words", () => {
    expect(decap("The army marched")).toBe("the army marched");
    expect(decap("Rome refused")).toBe("Rome refused");
    expect(decap("Nelson won")).toBe("Nelson won");
  });

  it("splices put boundaries inside the sentence and end with a full stop", () => {
    const r = rng(7);
    for (let i = 0; i < 300; i++) {
      const it = makeSplice(REGIONS[i % REGIONS.length]!.id, r);
      expect(it.words.at(-1)!.endsWith("."), it.words.join(" ")).toBe(true);
      for (const b of it.boundaries) {
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThan(it.words.length - 1);
      }
    }
  });

  it("four fixes always has exactly one right answer among four options", () => {
    const r = rng(11);
    for (let i = 0; i < 300; i++) {
      const it = makeFixes(REGIONS[i % REGIONS.length]!.id, r);
      expect(it.options.length).toBe(4);
      expect(new Set(it.options).size).toBe(4);
      expect(it.answer).toBeGreaterThanOrEqual(0);
      // the right option never joins two sentences with a bare comma
      expect(it.options[it.answer]).not.toMatch(/, (however|therefore|thus|furthermore)\b(?!,)/);
    }
  });

  it("comma drop answers are the comma positions of a correct sentence", () => {
    const r = rng(3);
    for (let i = 0; i < 200; i++) {
      const it = makeComma(REGIONS[i % REGIONS.length]!.id, r);
      const rebuilt = it.words.map((w, idx) => (it.commasAfter.includes(idx) ? `${w},` : w)).join(" ");
      expect(rebuilt).toBe(it.full);
    }
  });

  it("rounds have the right size for every skill and region", () => {
    for (const r of REGIONS) for (const k of SKILLS) expect(makeRound(k.id, r.id, 42).length).toBe(ROUND_SIZE[k.id]);
  });
});

describe("analysis", () => {
  it("flags Russell's real run-on and description opener", () => {
    const a = analyse(
      "The layout of the image also effects the reader, the poster includes the polluted atmosphere image at the top of the poster while the image of a natural jungle environment is included at the bottom of the advertisement. Additionally this creates a since of hope.",
    );
    expect(a.flags.some((f) => f.kind === "run-on" || f.kind === "long")).toBe(true);
    expect(a.flags.some((f) => f.kind === "opener")).toBe(true);
    expect(a.wordSlips).toBeGreaterThanOrEqual(2);
  });

  it("scores a clean PEAL paragraph highly", () => {
    const a = analyse(
      "Greenpeace's slogan makes pollution feel like a violent attack on the reader's own home. The poster says 'Stop polluters tearing up our world'. The verb 'tearing' has connotations of violence, while 'our world' includes the reader as a victim. As a result, the reader feels personally threatened and is more likely to join the campaign.",
    );
    expect(a.claimFirst).toBe(true);
    expect(a.peal).toEqual({ point: true, evidence: true, analysis: true, link: true });
    expect(a.total).toBeGreaterThanOrEqual(11);
  });

  it("does not flag 'however' used correctly", () => {
    const a = analyse("The plan was bold. However, the weather ruined it. The fleet was strong; however, it was scattered.");
    expect(a.flags.filter((f) => f.kind === "linker")).toEqual([]);
  });
});

describe("progress rules", () => {
  it("levels up through the ranks", () => {
    expect(levelFor(0).rank).toBe("Recruit");
    expect(levelFor(120).rank).toBe("Private");
  });

  it("a territory needs 75% to win and a perfect round for three stars", () => {
    expect(passMark("splice")).toBe(6);
    expect(starsFor(5, 8, 6)).toBe(0);
    expect(starsFor(6, 8, 6)).toBe(1);
    expect(starsFor(7, 8, 6)).toBe(2);
    expect(starsFor(8, 8, 6)).toBe(3);
  });

  it("boot camp unlocks the world, four territories open a siege", () => {
    let s = emptyState();
    expect(regionOpen(s, "rome")).toBe(false);
    s = setStars(setStars(setStars(s, "boot", "splice", 1), "boot", "fixes", 1), "boot", "comma", 1);
    expect(regionOpen(s, "rome")).toBe(true);
    expect(siegeOpen(s, "boot")).toBe(false);
    s = setStars(s, "boot", "twins", 2);
    expect(siegeOpen(s, "boot")).toBe(true);
  });

  it("streaks count consecutive days and forgive one miss a week", () => {
    let s = emptyState();
    s = bumpStreak(s, "2026-11-09");
    s = bumpStreak(s, "2026-11-10");
    expect(s.streak.count).toBe(2);
    s = bumpStreak(s, "2026-11-12"); // missed the 11th: forgiven
    expect(s.streak.count).toBe(3);
    s = bumpStreak(s, "2026-11-14"); // a second miss in the same week resets
    expect(s.streak.count).toBe(1);
  });

  it("earning 60 XP in a day counts the day", () => {
    const now = new Date("2026-11-11T05:00:00Z");
    const s = addXp(addXp(emptyState(), 30, now), 30, now);
    expect(s.streak.count).toBe(1);
    expect(liveStreak(s, now)).toBe(1);
  });
});

describe("splice detection with noun subjects", () => {
  it("flags ', the colours are' after a full clause but not after an opener", () => {
    const runOn = analyse("The poster uses a dramatic image of a burning forest to make readers feel fear, the colours are dark and red.");
    expect(runOn.flags.some((f) => f.kind === "run-on")).toBe(true);
    const fine = analyse("In the top left of the poster, the colours are dark and red and they make the whole scene feel dangerous.");
    expect(fine.flags.some((f) => f.kind === "run-on")).toBe(false);
  });
});

describe("guest view", () => {
  it("opens every region, territory and siege, and is never kept in a save", async () => {
    const { guestState, normaliseState, regionOpen, siegeOpen, territoryOpen, emptyState } = await import("./state");
    const { REGIONS, SKILLS } = await import("./regions");
    const g = guestState();
    for (const r of REGIONS) {
      expect(regionOpen(g, r.id)).toBe(true);
      expect(siegeOpen(g, r.id)).toBe(true);
      for (const k of SKILLS) expect(territoryOpen(g, r.id, k.id)).toBe(true);
    }
    expect(normaliseState(g).guest).toBeUndefined();
    expect(siegeOpen(emptyState(), "rome")).toBe(false);
  });
});
