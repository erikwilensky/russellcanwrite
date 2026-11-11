import { afterEach, describe, expect, it } from "vitest";
import { costOf, current, emptyLog, mayCall, monthlyLimit, withCall, worstCaseCall } from "./spend";

describe("AI spend cap", () => {
  afterEach(() => {
    delete process.env.AI_MONTHLY_LIMIT_USD;
    delete process.env.AI_DAILY_CALL_LIMIT;
  });

  it("defaults to $10 a month", () => {
    expect(monthlyLimit()).toBe(10);
  });

  it("prices calls and prices unknown models high", () => {
    expect(costOf("gpt-4o-mini", 1_000_000, 0)).toBeCloseTo(0.15);
    expect(worstCaseCall("some-new-model")).toBeGreaterThan(worstCaseCall("gpt-4o-mini") * 50);
  });

  it("stops before the month's total would pass the cap", () => {
    const now = new Date("2026-11-11T12:00:00Z");
    const nearlyFull = { ...emptyLog(now), usd: 10 - worstCaseCall("gpt-4o-mini") / 2 };
    expect(mayCall(nearlyFull, "gpt-4o-mini")).toBe(false);
    expect(mayCall(emptyLog(now), "gpt-4o-mini")).toBe(true);
  });

  it("has a daily call limit", () => {
    process.env.AI_DAILY_CALL_LIMIT = "2";
    let log = emptyLog(new Date("2026-11-11T12:00:00Z"));
    log = withCall(withCall(log, 0.001), 0.001);
    expect(mayCall(log, "gpt-4o-mini")).toBe(false);
    // the next Bangkok day resets the daily count but not the month
    const next = current(log, new Date("2026-11-12T01:00:00Z"));
    expect(next.dayCalls).toBe(0);
    expect(next.calls).toBe(2);
  });

  it("resets at the start of a new month (Bangkok time)", () => {
    const log = { ...emptyLog(new Date("2026-11-30T12:00:00Z")), usd: 9.99 };
    expect(current(log, new Date("2026-11-30T17:30:00Z")).usd).toBe(0);
  });

  it("a whole month of heavy use stays under the cap on gpt-4o-mini", () => {
    // 60 calls a day for 31 days at worst-case size
    expect(worstCaseCall("gpt-4o-mini") * 60 * 31).toBeLessThan(10);
  });
});
