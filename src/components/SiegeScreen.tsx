"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { analyse, SIEGE_MIN_WORDS, SIEGE_WIN, type Gauges } from "@/lib/analyse";
import type { Dispatch } from "@/lib/content";
import type { Draft } from "@/lib/state";
import { play } from "./sound";
import s from "./rcw.module.css";

type CoachReply = {
  source: "ai" | "rules";
  gauges: Gauges;
  questions: Array<{ quote: string; question: string }>;
  praise: string;
};

const GAUGE_NAMES: Array<[keyof Gauges, string]> = [
  ["sentences", "Sentences"],
  ["topic", "Topic sentence"],
  ["peal", "PEAL"],
  ["words", "Word choice"],
];

/** Wrap each quoted phrase in a highlight. */
function highlight(text: string, quotes: string[]): React.ReactNode[] {
  if (!quotes.length) return [text];
  const parts: React.ReactNode[] = [];
  let rest = text;
  let key = 0;
  while (rest) {
    let at = -1;
    let q = "";
    for (const cand of quotes) {
      const k = rest.indexOf(cand);
      if (k >= 0 && (at < 0 || k < at)) {
        at = k;
        q = cand;
      }
    }
    if (at < 0) {
      parts.push(rest);
      break;
    }
    parts.push(rest.slice(0, at));
    parts.push(
      <mark key={key++} className={s.mark}>
        {q}
      </mark>,
    );
    rest = rest.slice(at + q.length);
  }
  return parts;
}

export function SiegeScreen({
  dispatch,
  siegeName,
  previous,
  alreadyWon,
  sound,
  onSubmit,
  onQuit,
}: {
  dispatch: Dispatch;
  siegeName: string;
  previous: Draft[];
  alreadyWon: boolean;
  sound: boolean;
  onSubmit: (draft: Draft, won: boolean) => void;
  onQuit: () => void;
}) {
  const [text, setText] = useState(previous.at(-1)?.text ?? "");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<CoachReply | null>(null);
  const [sentText, setSentText] = useState("");
  const [error, setError] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (reply) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [reply]);

  const live = useMemo(() => analyse(text), [text]);
  const sentAnalysis = useMemo(() => analyse(sentText), [sentText]);
  const flaggedSentences = new Set(live.flags.filter((f) => f.kind === "run-on" || f.kind === "linker" || f.kind === "long").map((f) => f.sentence));

  async function send() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dispatchId: dispatch.id, text }),
      });
      const data = (await res.json()) as CoachReply & { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "The coach could not read that. Try again.");
        return;
      }
      const a = analyse(text);
      const total = data.gauges.sentences + data.gauges.topic + data.gauges.peal + data.gauges.words;
      const won = total >= SIEGE_WIN && a.wordCount >= SIEGE_MIN_WORDS;
      setReply(data);
      setSentText(text);
      play(won ? "win" : "lose", sound);
      onSubmit(
        { at: new Date().toISOString(), text, total, gauges: data.gauges, words: a.wordCount, runOnsPer100: a.runOnsPer100, claimFirst: a.claimFirst },
        won,
      );
    } catch {
      setError("No connection. Your paragraph is still here; try again.");
    } finally {
      setBusy(false);
    }
  }

  const total = reply ? reply.gauges.sentences + reply.gauges.topic + reply.gauges.peal + reply.gauges.words : 0;
  const won = reply ? total >= SIEGE_WIN && sentAnalysis.wordCount >= SIEGE_MIN_WORDS : false;

  return (
    <div className={s.wrap}>
      <div className={s.playTop}>
        <button className={s.ghost} type="button" onClick={onQuit}>
          Retreat
        </button>
        <div>
          <div className={`${s.head} ${s.h2}`} style={{ margin: 0 }}>
            {dispatch.title}
          </div>
          <div className={`${s.muted} ${s.small}`}>
            {siegeName} · Win with {SIEGE_WIN} of 12 and at least {SIEGE_MIN_WORDS} words{alreadyWon ? " · already won: now beat your best" : ""}
          </div>
        </div>
      </div>

      <div className={s.grid2}>
        <div>
          <div className={s.panel}>
            <div className={`${s.head} ${s.small}`} style={{ color: "var(--gold)" }}>
              Intelligence
            </div>
            <p className={s.source}>{dispatch.source}</p>
            <p style={{ fontSize: 19, margin: "12px 0 4px" }}>
              <strong>{dispatch.question}</strong>
            </p>
            <p className={`${s.muted} ${s.small}`} style={{ margin: 0 }}>
              Orders: {dispatch.hint}
            </p>
            {dispatch.original && (
              <div style={{ marginTop: 10 }}>
                <button className={s.ghost} type="button" onClick={() => setShowOriginal(!showOriginal)}>
                  {showOriginal ? "Hide" : "Show"} your original paragraph
                </button>
                {showOriginal && (
                  <p className={s.source} style={{ marginTop: 8, borderLeftColor: "var(--red)" }}>
                    {dispatch.original}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className={s.panel} style={{ marginTop: 12 }}>
            <label htmlFor="rcw-editor" className={`${s.head} ${s.small}`} style={{ color: "var(--gold)" }}>
              Your dispatch: one PEAL paragraph
            </label>
            <textarea
              id="rcw-editor"
              className={s.editor}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Start with your Point: a claim that answers the question."
              spellCheck
            />
            <div className={s.actions} style={{ alignItems: "center" }}>
              <button className={s.btn} type="button" onClick={send} disabled={busy || live.wordCount < 15}>
                {busy ? "Sending…" : reply ? "Send redraft" : "Send dispatch"}
              </button>
              <span className={`${s.muted} ${s.small}`}>
                {live.wordCount} words · {live.sentences.length} sentences
              </span>
            </div>
            {error && <p className={s.lose}>{error}</p>}
          </div>

          {reply && (
            <div ref={resultRef} className={s.panel} style={{ marginTop: 12, scrollMarginTop: 80 }}>
              <div className={`${s.head} ${s.h2} ${won ? s.win : s.lose}`}>{won ? `Victory! ${total}/12` : `Held back: ${total}/12`}</div>
              {!won && sentAnalysis.wordCount < SIEGE_MIN_WORDS && (
                <p className={s.muted}>A siege needs at least {SIEGE_MIN_WORDS} words. Develop your analysis.</p>
              )}
              {GAUGE_NAMES.map(([k, name]) => (
                <div key={k} className={s.gauge}>
                  <span>{name}</span>
                  <div className={s.gaugeTrack}>
                    {[0, 1, 2].map((n) => (
                      <div key={n} className={`${s.gaugeSeg} ${reply.gauges[k] > n ? s.gaugeSegOn : ""}`} />
                    ))}
                  </div>
                  <span>{reply.gauges[k]}/3</span>
                </div>
              ))}
              {reply.praise && (
                <p>
                  <strong>Good:</strong> {reply.praise}
                </p>
              )}
              {reply.questions.length > 0 && (
                <>
                  <div className={`${s.head} ${s.small}`} style={{ color: "var(--gold)", marginTop: 10 }}>
                    Coach&apos;s questions
                  </div>
                  <p style={{ background: "var(--panel2)", padding: 12, borderRadius: 10 }}>{highlight(sentText, reply.questions.map((q) => q.quote))}</p>
                  <ol>
                    {reply.questions.map((q, i) => (
                      <li key={i}>
                        <em>&ldquo;{q.quote}&rdquo;</em>: {q.question}
                      </li>
                    ))}
                  </ol>
                </>
              )}
              {sentAnalysis.flags.length > 0 && (
                <>
                  <div className={`${s.head} ${s.small}`} style={{ color: "var(--gold)", marginTop: 10 }}>
                    Spotted by the scouts
                  </div>
                  <ul>
                    {sentAnalysis.flags.slice(0, 6).map((f, i) => (
                      <li key={i}>
                        Sentence {f.sentence + 1}: {f.note}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <p className={`${s.muted} ${s.small}`}>
                {reply.source === "ai" ? "Marked by the AI coach." : "Marked by the rule-based scouts (the AI coach is off)."} Fix it yourself, then send a redraft.
              </p>
            </div>
          )}
        </div>

        <div>
          <div className={s.panel}>
            <div className={`${s.head} ${s.h3}`}>PEAL check</div>
            <ul className={s.checklist}>
              {(
                [
                  ["point", "Point: a claim, not a description"],
                  ["evidence", "Evidence: a quotation or detail from the source"],
                  ["analysis", "Analysis: explain how the evidence proves the point"],
                  ["link", "Link: return to the question"],
                ] as const
              ).map(([k, label]) => (
                <li key={k}>
                  <span className={`${s.tick} ${live.peal[k] ? s.tickOn : ""}`}>{live.peal[k] ? "✓" : ""}</span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <div className={s.panel} style={{ marginTop: 12 }}>
            <div className={`${s.head} ${s.h3}`}>Sentence radar</div>
            <p className={`${s.muted} ${s.small}`} style={{ margin: 0 }}>
              One bar per sentence. Red means too long or possibly two sentences joined. Aim for 12 to 25 words.
            </p>
            <div className={s.sentBars}>
              {live.sentences.map((sent, i) => {
                const n = sent.split(/\s+/).length;
                const bad = flaggedSentences.has(i) || n > 35;
                const warn = !bad && n > 25;
                return (
                  <div key={i} title={`Sentence ${i + 1}: ${n} words`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={s.small} style={{ width: 20 }}>
                      {i + 1}
                    </span>
                    <div className={`${s.sentBar} ${bad ? s.sentBarBad : warn ? s.sentBarWarn : ""}`} style={{ width: `${Math.min(100, (n / 45) * 100)}%` }} />
                    <span className={`${s.small} ${s.muted}`}>{n}</span>
                  </div>
                );
              })}
              {live.sentences.length === 0 && <span className={`${s.muted} ${s.small}`}>Start writing to see your sentences.</span>}
            </div>
            {live.flags.length > 0 && (
              <ul className={s.small} style={{ paddingLeft: 18, marginBottom: 0 }}>
                {live.flags.slice(0, 5).map((f, i) => (
                  <li key={i}>
                    {f.sentence + 1}: {f.note}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {previous.length > 0 && (
            <div className={s.panel} style={{ marginTop: 12 }}>
              <div className={`${s.head} ${s.h3}`}>Earlier drafts</div>
              <ul className={s.small} style={{ paddingLeft: 18, margin: 0 }}>
                {previous.map((d, i) => (
                  <li key={i}>
                    {d.at.slice(0, 10)}: {d.total}/12, {d.words} words
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
