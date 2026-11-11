"use client";

import { useState } from "react";
import { DISPATCHES } from "@/lib/content";
import { REGIONS, SKILLS } from "@/lib/regions";
import { accuracy, dayKey, firstDrafts, levelFor, liveStreak, regionConquered, starsTotal, type SaveState } from "@/lib/state";
import s from "./rcw.module.css";

const ALL_DISPATCHES = Object.values(DISPATCHES).flat();

function lastDays(n: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(new Date(now - i * 86_400_000)));
  return out;
}

/** Progress for Russell and Erik: the numbers that matter are the writing ones at the bottom. */
export function WarRoom({ state, bank, onSignOut }: { state: SaveState; bank: number; onSignOut: () => void }) {
  const [copied, setCopied] = useState("");
  const lvl = levelFor(state.xp);
  const totals = starsTotal(state);
  const days = lastDays(14);
  const maxXp = Math.max(60, ...days.map((d) => state.days[d]?.xp ?? 0));
  const drafts = firstDrafts(state);
  const conquered = REGIONS.filter((r) => regionConquered(state, r.id)).length;
  const answered = Object.values(state.skills).reduce((a, k) => a + (k?.total ?? 0), 0);
  const best = Object.entries(state.sieges)
    .map(([id, v]) => {
      const top = [...v.drafts].sort((a, b) => b.total - a.total)[0];
      return top ? { id, title: ALL_DISPATCHES.find((d) => d.id === id)?.title ?? id, draft: top } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.draft.total - a.draft.total);

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={s.wrap}>
      <h1 className={`${s.head} ${s.h2}`}>War Room</h1>
      <div className={s.statRow}>
        {[
          [lvl.rank, "rank"],
          [state.xp, "XP"],
          [`${liveStreak(state)}`, "day streak"],
          [`${totals.got}/${totals.max}`, "stars"],
          [`${conquered}/${REGIONS.length}`, "campaigns conquered"],
          [answered, "questions answered"],
          [drafts.length, "paragraphs written"],
          [bank.toLocaleString(), "puzzles in the bank"],
        ].map(([v, label]) => (
          <div key={String(label)} className={s.stat}>
            <div className={`${s.head} ${s.statNum}`} style={{ fontSize: String(v).length > 10 ? 20 : undefined }}>
              {v}
            </div>
            <div className={`${s.muted} ${s.small}`}>{label}</div>
          </div>
        ))}
      </div>

      <div className={s.grid2} style={{ marginTop: 16 }}>
        <div className={s.panel}>
          <h2 className={`${s.head} ${s.h3}`}>Accuracy by skill (last 30 answers)</h2>
          {SKILLS.map((k) => {
            const a = accuracy(state, k.id);
            return (
              <div key={k.id} className={s.hbar}>
                <span>{k.game}</span>
                <div className={s.hbarTrack}>
                  <div className={s.hbarFill} style={{ width: `${(a ?? 0) * 100}%`, background: a === null ? undefined : a >= 0.85 ? "var(--green)" : a >= 0.6 ? "var(--gold)" : "var(--red)" }} />
                </div>
                <span>{a === null ? "–" : `${Math.round(a * 100)}%`}</span>
              </div>
            );
          })}
        </div>
        <div className={s.panel}>
          <h2 className={`${s.head} ${s.h3}`}>XP, last 14 days</h2>
          <div className={s.cols} aria-label="XP earned each day for the last 14 days">
            {days.map((d) => {
              const v = state.days[d]?.xp ?? 0;
              return <div key={d} className={s.col} title={`${d}: ${v} XP`} style={{ height: `${(v / maxXp) * 100}%`, opacity: v >= 60 ? 1 : 0.45 }} />;
            })}
          </div>
          <p className={`${s.muted} ${s.small}`}>Bright bars are days that counted towards the streak (60 XP or more).</p>
        </div>
      </div>

      <div className={s.panel} style={{ marginTop: 16 }}>
        <h2 className={`${s.head} ${s.h3}`}>Writing: the real test</h2>
        <p className={`${s.muted} ${s.small}`} style={{ marginTop: 0 }}>
          Every paragraph sent, oldest first. Watch run-ons per 100 words fall towards zero and the topic sentence column fill with ticks.
        </p>
        {drafts.length === 0 ? (
          <p>No paragraphs yet. Win 4 territories in a campaign to open its siege.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Dispatch</th>
                  <th>Words</th>
                  <th>Run-ons per 100 words</th>
                  <th>Claim first</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((d, i) => (
                  <tr key={i}>
                    <td>{d.at.slice(0, 10)}</td>
                    <td>{ALL_DISPATCHES.find((x) => x.id === d.dispatchId)?.title ?? d.dispatchId}</td>
                    <td>{d.words}</td>
                    <td>{d.runOnsPer100}</td>
                    <td>{d.claimFirst ? "✓" : "–"}</td>
                    <td>{d.total}/12</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {best.length > 0 && (
        <div className={s.panel} style={{ marginTop: 16 }}>
          <h2 className={`${s.head} ${s.h3}`}>Best paragraphs (to show your teacher)</h2>
          {best.map((b) => (
            <div key={b.id} style={{ marginBottom: 14 }}>
              <div>
                <strong>{b.title}</strong> <span className={`${s.muted} ${s.small}`}>{b.draft.total}/12 · {b.draft.at.slice(0, 10)}</span>{" "}
                <button className={s.ghost} type="button" style={{ padding: "2px 10px", fontSize: 13 }} onClick={() => copy(b.id, b.draft.text)}>
                  {copied === b.id ? "Copied" : "Copy"}
                </button>
              </div>
              <p className={s.source} style={{ marginTop: 6 }}>
                {b.draft.text}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className={s.actions}>
        <button className={s.ghost} type="button" onClick={onSignOut}>
          Sign out of this device
        </button>
      </div>
    </div>
  );
}
