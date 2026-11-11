"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DISPATCHES, PAIRS } from "@/lib/content";
import { bankSize, decap, makeMixedRound, makeRound, passMark, ROUND_SIZE } from "@/lib/items";
import { REGIONS, regionById, SKILLS, skillById, type RegionId, type SkillId } from "@/lib/regions";
import {
  addXp,
  DRAFT_XP,
  levelFor,
  liveStreak,
  guestState,
  normaliseState,
  recordAnswer,
  recordDraft,
  regionConquered,
  regionOpen,
  SIEGE_NEEDS,
  SIEGE_XP,
  siegeOpen,
  setStars,
  stars,
  starsFor,
  starsTotal,
  territoriesWon,
  territoryOpen,
  unrest,
  weakSkills,
  dayKey,
  type Draft,
  type SaveState,
} from "@/lib/state";
import { RoundPlayer, type RoundEntry, type RoundResult } from "./RoundPlayer";
import { SiegeScreen } from "./SiegeScreen";
import { WarRoom } from "./WarRoom";
import { WorldMap, type MarkerState } from "./WorldMap";
import { play } from "./sound";
import s from "./rcw.module.css";

type Screen =
  | { kind: "map"; region: RegionId | null }
  | { kind: "play"; region: RegionId | null; skill: SkillId | null; title: string; entries: RoundEntry[] }
  | { kind: "result"; region: RegionId | null; skill: SkillId | null; result: RoundResult; starsWon: number; intel: string }
  | { kind: "siege"; region: RegionId; dispatchId: string }
  | { kind: "war" };

function starLine(n: number, max = 3) {
  return (
    <span className={s.stars} aria-label={`${n} of ${max} stars`}>
      {"★".repeat(n)}
      <span className={s.starsOff}>{"★".repeat(max - n)}</span>
    </span>
  );
}

function seed() {
  return Math.floor(Math.random() * 2 ** 31);
}

export function RcwGame({ initial, guest = false }: { initial: unknown; guest?: boolean }) {
  const [state, setState] = useState<SaveState>(() => (guest ? guestState() : normaliseState(initial)));
  const [screen, setScreen] = useState<Screen>({ kind: "map", region: null });
  const [toast, setToast] = useState("");
  const [saveError, setSaveError] = useState(false);
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save to the server a moment after each change; flush at once if the page is closed.
  const pending = useRef<SaveState | null>(null);
  useEffect(() => {
    if (guest) return; // a guest's play is never saved
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    pending.current = state;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pending.current = null;
      fetch("/api/save", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ state }) })
        .then((r) => setSaveError(!r.ok))
        .catch(() => setSaveError(true));
    }, 1200);
  }, [state, guest]);

  useEffect(() => {
    const flush = () => {
      if (guest || !pending.current) return;
      navigator.sendBeacon("/api/save", new Blob([JSON.stringify({ state: pending.current })], { type: "application/json" }));
      pending.current = null;
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [guest]);

  // Every new screen starts at the top.
  const screenKey = screen.kind === "map" ? `map:${screen.region ?? ""}` : screen.kind;
  useEffect(() => {
    document.querySelector("[data-rcw-root]")?.scrollTo({ top: 0 });
  }, [screenKey]);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  }, []);

  /** Apply a change; announce a promotion if the rank went up. */
  const update = useCallback(
    (fn: (cur: SaveState) => SaveState) => {
      setState((cur) => {
        const next = fn(cur);
        const a = levelFor(cur.xp).level;
        const b = levelFor(next.xp);
        if (b.level > a) {
          setTimeout(() => {
            play("level", next.sound);
            flash(`Promoted to ${b.rank}!`);
          }, 50);
        }
        return next;
      });
    },
    [flash],
  );

  const lvl = levelFor(state.xp);
  const streak = liveStreak(state);
  const totals = starsTotal(state);
  const today = state.days[dayKey()] ?? { xp: 0, items: 0, writes: 0 };
  const restless = unrest(state);

  const markerStates = useMemo(() => {
    const out = {} as Record<RegionId, MarkerState>;
    for (const r of REGIONS) out[r.id] = { open: regionOpen(state, r.id), won: territoriesWon(state, r.id), conquered: regionConquered(state, r.id) };
    return out;
  }, [state]);

  function startTerritory(region: RegionId, skill: SkillId) {
    const entries = makeRound(skill, region, seed()).map((item) => ({ skill, item }));
    setScreen({ kind: "play", region, skill, title: `${regionById(region)!.name}: ${skillById(skill)!.game}`, entries });
  }

  function startDrill() {
    const weak = weakSkills(state);
    setScreen({ kind: "play", region: null, skill: null, title: "Daily drill: your weakest skills", entries: makeMixedRound(weak, seed(), 10) });
  }

  function finishRound(region: RegionId | null, skill: SkillId | null, result: RoundResult) {
    let starsWon = 0;
    let intel = "";
    if (region && skill) {
      starsWon = starsFor(result.score, result.size, passMark(skill));
      const before = stars(state, region, skill);
      update((cur) => setStars({ ...cur, bestCombo: Math.max(cur.bestCombo, result.bestCombo) }, region, skill, starsWon));
      if (starsWon > 0) {
        const [a, b, rel] = PAIRS[region][Math.floor(Math.random() * PAIRS[region].length)]!;
        intel = `${a}, ${rel} ${decap(b)}.`;
        if (before === 0) {
          update((cur) => addXp(cur, 50));
          flash("Territory captured! +50 XP");
        }
      }
    } else {
      update((cur) => ({ ...cur, bestCombo: Math.max(cur.bestCombo, result.bestCombo) }));
    }
    play(starsWon > 0 || !skill ? "win" : "lose", state.sound);
    setScreen({ kind: "result", region, skill, result, starsWon, intel });
  }

  function onDraft(region: RegionId, dispatchId: string, draft: Draft, won: boolean) {
    const prev = state.sieges[dispatchId];
    const firstWin = won && !prev?.won;
    const improved = !prev || draft.total > prev.best;
    update((cur) => {
      let next = recordDraft(cur, dispatchId, draft, won);
      if (improved) next = addXp(next, DRAFT_XP);
      if (firstWin) next = addXp(next, SIEGE_XP);
      return next;
    });
    if (firstWin) {
      const conquered = !regionConquered(state, region);
      flash(conquered ? `${regionById(region)!.name} conquered! +${SIEGE_XP} XP` : `Siege won! +${SIEGE_XP} XP`);
    } else if (improved) flash(`New best! +${DRAFT_XP} XP`);
  }

  async function signOut() {
    await fetch("/api/login", { method: "DELETE" });
    window.location.reload();
  }

  /* ---------- screens ---------- */

  let body: React.ReactNode;
  if (screen.kind === "play") {
    const { region, skill } = screen;
    body = (
      <RoundPlayer
        key={screen.title + screen.entries.length + JSON.stringify(screen.entries[0])}
        title={screen.title}
        entries={screen.entries}
        sound={state.sound}
        onAnswer={(k, right, xp) => update((cur) => (xp ? addXp(recordAnswer(cur, k, right), xp) : recordAnswer(cur, k, right)))}
        onDone={(r) => finishRound(region, skill, r)}
        onQuit={() => setScreen({ kind: "map", region })}
      />
    );
  } else if (screen.kind === "result") {
    const { region, skill, result, starsWon, intel } = screen;
    const won = starsWon > 0 || !skill;
    body = (
      <div className={s.wrap}>
        <div className={`${s.panel} ${s.result}`}>
          <div className={`${s.head} ${s.h2} ${won ? s.win : s.lose}`}>{skill ? (won ? "Territory taken" : "Repelled") : "Drill complete"}</div>
          {skill && <div className={s.bigStars}>{starLine(starsWon)}</div>}
          <p style={{ fontSize: 20 }}>
            {result.score} of {result.size} correct · +{result.xp} XP · best combo ×{result.bestCombo}
          </p>
          {skill && !won && (
            <p className={s.muted}>
              You need {passMark(skill)} of {ROUND_SIZE[skill]} to take this territory. Regroup and attack again.
            </p>
          )}
          {intel && (
            <div className={s.intel}>
              <div className={`${s.head} ${s.small}`} style={{ color: "var(--gold)" }}>
                Intel recovered
              </div>
              {intel}
            </div>
          )}
          <div className={s.actions} style={{ justifyContent: "center" }}>
            {region && skill ? (
              <button className={s.btn} type="button" onClick={() => startTerritory(region, skill)}>
                {won ? "Play again for more stars" : "Attack again"}
              </button>
            ) : (
              <button className={s.btn} type="button" onClick={startDrill}>
                Another drill
              </button>
            )}
            <button className={s.ghost} type="button" onClick={() => setScreen({ kind: "map", region })}>
              Back to the map
            </button>
          </div>
        </div>
      </div>
    );
  } else if (screen.kind === "siege") {
    const d = DISPATCHES[screen.region].find((x) => x.id === screen.dispatchId)!;
    body = (
      <SiegeScreen
        key={d.id}
        dispatch={d}
        siegeName={regionById(screen.region)!.siegeName}
        previous={state.sieges[d.id]?.drafts ?? []}
        alreadyWon={!!state.sieges[d.id]?.won}
        sound={state.sound}
        onSubmit={(draft, won) => onDraft(screen.region, d.id, draft, won)}
        onQuit={() => setScreen({ kind: "map", region: screen.region })}
      />
    );
  } else if (screen.kind === "war") {
    body = <WarRoom state={state} bank={bankSize()} onSignOut={signOut} />;
  } else {
    const sel = screen.region ? regionById(screen.region)! : null;
    body = (
      <div className={s.wrap}>
        <div className={s.grid2}>
          <div>
            <WorldMap states={markerStates} selected={screen.region} onPick={(id) => setScreen({ kind: "map", region: id })} />
            {(
              <div className={s.regionList}>
                {REGIONS.map((r) => {
                  const st = markerStates[r.id];
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`${s.regionCard} ${st.open ? "" : s.regionLocked}`}
                      style={{ borderLeftColor: r.colour }}
                      onClick={() => setScreen({ kind: "map", region: r.id })}
                    >
                      <div className={`${s.head} ${s.regionName}`}>
                        {st.conquered ? "⚑ " : ""}
                        {r.name}
                      </div>
                      <div className={`${s.muted} ${s.small}`}>
                        {st.open ? `${r.era} · ${st.won}/7 territories` : "Locked: win 3 Boot Camp territories"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            {sel ? (
              <RegionPanel
                state={state}
                region={sel.id}
                onBack={() => setScreen({ kind: "map", region: null })}
                onPlay={(k) => startTerritory(sel.id, k)}
                onSiege={(id) => setScreen({ kind: "siege", region: sel.id, dispatchId: id })}
              />
            ) : (
              <OrdersPanel
                today={today}
                streak={streak}
                restless={restless}
                onDrill={startDrill}
                bootDone={territoriesWon(state, "boot") >= 3}
                onBoot={() => setScreen({ kind: "map", region: "boot" })}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={s.bar}>
        <div className={s.barInner}>
          <button type="button" className={`${s.head} ${s.brand}`} onClick={() => setScreen({ kind: "map", region: null })}>
            Russell <span>Can Write</span>
          </button>
          <div className={s.rank} title={`${state.xp} XP`}>
            <span className={`${s.head} ${s.rankName}`}>
              {lvl.rank} · {state.xp} XP
            </span>
            <div className={s.xpBar}>
              <div className={s.xpFill} style={{ width: `${Math.min(100, (lvl.into / Math.max(1, lvl.span)) * 100)}%` }} />
            </div>
          </div>
          <span className={s.pill} title="Days in a row with at least 60 XP. One missed day a week is forgiven.">
            🔥 {streak} day{streak === 1 ? "" : "s"}
          </span>
          <span className={s.pill}>★ {totals.got}</span>
          <button type="button" className={`${s.navBtn} ${screen.kind === "map" ? s.navOn : ""}`} onClick={() => setScreen({ kind: "map", region: null })}>
            Map
          </button>
          <button type="button" className={`${s.navBtn} ${screen.kind === "war" ? s.navOn : ""}`} onClick={() => setScreen({ kind: "war" })}>
            War Room
          </button>
          <button
            type="button"
            className={s.navBtn}
            aria-pressed={state.sound}
            onClick={() => update((cur) => ({ ...cur, sound: !cur.sound }))}
            title="Sound"
          >
            {state.sound ? "🔊" : "🔇"}
          </button>
        </div>
      </div>
      {guest && (
        <div className={`${s.wrap} ${s.guestBar}`} role="note">
          <span>
            <strong>Guest view.</strong> Every task is open to try. Nothing you do here is saved, Russell&apos;s progress is not shown,
            and paragraphs are marked by the built-in rules (no AI).
          </span>
          <button type="button" className={s.ghost} onClick={signOut}>
            Leave
          </button>
        </div>
      )}
      {body}
      {saveError && (
        <p className={`${s.wrap} ${s.small} ${s.lose}`} role="status">
          Your last move has not reached the server yet. It will retry on your next move.
        </p>
      )}
      {toast && (
        <div className={`${s.toast} ${s.head}`} role="status">
          {toast}
        </div>
      )}
    </>
  );
}

function RegionPanel({
  state,
  region,
  onBack,
  onPlay,
  onSiege,
}: {
  state: SaveState;
  region: RegionId;
  onBack: () => void;
  onPlay: (k: SkillId) => void;
  onSiege: (dispatchId: string) => void;
}) {
  const r = regionById(region)!;
  if (!regionOpen(state, region)) {
    return (
      <div className={s.panel}>
        <button className={s.ghost} type="button" onClick={onBack}>
          ← All campaigns
        </button>
        <h2 className={`${s.head} ${s.h2}`} style={{ marginTop: 12 }}>
          {r.name}
        </h2>
        <p className={s.muted}>Fog of war. Win 3 territories in Boot Camp to unlock every campaign.</p>
      </div>
    );
  }
  const won = territoriesWon(state, region);
  const siege = siegeOpen(state, region);
  return (
    <div className={s.panel} style={{ borderTop: `4px solid ${r.colour}` }}>
      <button className={s.ghost} type="button" onClick={onBack}>
        ← All campaigns
      </button>
      <h2 className={`${s.head} ${s.h2}`} style={{ marginTop: 12, marginBottom: 0 }}>
        {r.name}
      </h2>
      <div className={s.muted}>
        {r.era} · {r.blurb}
      </div>
      <div className={s.terrGrid}>
        {SKILLS.map((k) => {
          const open = territoryOpen(state, region, k.id);
          const st = stars(state, region, k.id);
          return (
            <button key={k.id} type="button" className={s.terr} disabled={!open} onClick={() => onPlay(k.id)}>
              <div className={s.head}>{k.game}</div>
              <div className={`${s.muted} ${s.small}`}>{k.skill}</div>
              <div>{open ? starLine(st) : <span className={s.small}>🔒 Win the one before</span>}</div>
            </button>
          );
        })}
      </div>
      <div className={s.siegeCard}>
        <div className={`${s.head} ${s.h3}`}>⚔ {r.siegeName}</div>
        {siege ? (
          <>
            <p className={`${s.small} ${s.muted}`} style={{ marginTop: 0 }}>
              Write one PEAL paragraph to win. Pick a dispatch:
            </p>
            <div className={s.choiceList}>
              {DISPATCHES[region].map((d) => {
                const rec = state.sieges[d.id];
                return (
                  <button key={d.id} type="button" className={s.choice} style={{ fontSize: 16 }} onClick={() => onSiege(d.id)}>
                    {rec?.won ? "⚑ " : ""}
                    <strong>{d.title}</strong>
                    <span className={`${s.muted} ${s.small}`}> · {rec ? `best ${rec.best}/12` : "not attempted"}</span>
                    <div className={s.small}>{d.question}</div>
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <p className={`${s.small} ${s.muted}`} style={{ margin: 0 }}>
            Win {SIEGE_NEEDS} territories here to open the siege ({won}/{SIEGE_NEEDS}).
          </p>
        )}
      </div>
    </div>
  );
}

function OrdersPanel({
  today,
  streak,
  restless,
  onDrill,
  bootDone,
  onBoot,
}: {
  today: { xp: number; items: number; writes: number };
  streak: number;
  restless: SkillId[];
  onDrill: () => void;
  bootDone: boolean;
  onBoot: () => void;
}) {
  const orders = [
    { label: "Answer 20 questions", done: today.items >= 20, prog: `${Math.min(today.items, 20)}/20` },
    { label: "Earn 120 XP", done: today.xp >= 120, prog: `${Math.min(today.xp, 120)}/120` },
    { label: "Send one written dispatch", done: today.writes >= 1, prog: `${Math.min(today.writes, 1)}/1` },
  ];
  return (
    <div className={s.panel}>
      <h2 className={`${s.head} ${s.h2}`}>Today&apos;s orders</h2>
      <ul className={s.checklist}>
        {orders.map((o) => (
          <li key={o.label}>
            <span className={`${s.tick} ${o.done ? s.tickOn : ""}`}>{o.done ? "✓" : ""}</span>
            {o.label} <span className={`${s.muted} ${s.small}`}>{o.prog}</span>
          </li>
        ))}
      </ul>
      <p className={`${s.small} ${s.muted}`}>
        Streak: {streak} day{streak === 1 ? "" : "s"}. Earn 60 XP to count today. One missed day a week is forgiven.
      </p>
      {!bootDone ? (
        <>
          <p>
            <strong>Start in Boot Camp.</strong> It uses sentences from your own Greenpeace essay. Win 3 territories there and every campaign on the map opens.
          </p>
          <button className={s.btn} type="button" onClick={onBoot}>
            Go to Boot Camp
          </button>
        </>
      ) : (
        <>
          <p>Pick a campaign on the map, or run a quick drill on your weakest skills.</p>
          <button className={s.btn} type="button" onClick={onDrill}>
            Daily drill (10 questions)
          </button>
        </>
      )}
      {restless.length > 0 && (
        <p className={s.small} style={{ marginTop: 12 }}>
          <strong style={{ color: "var(--red)" }}>Unrest:</strong> you haven&apos;t practised {restless.map((k) => skillById(k)!.game).join(", ")} for 4 days. The daily drill will cover them.
        </p>
      )}
    </div>
  );
}

