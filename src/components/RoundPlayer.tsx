"use client";

import { useEffect, useMemo, useState } from "react";
import { cap, type ChoiceItem, type CommaItem, type Item, type PealOrderItem, type SpliceItem } from "@/lib/items";
import { skillById, type SkillId } from "@/lib/regions";
import { play } from "./sound";
import s from "./rcw.module.css";

export type RoundEntry = { skill: SkillId; item: Item };
export type RoundResult = { score: number; size: number; xp: number; bestCombo: number };

const PEAL_LETTERS = ["P", "E", "A", "L"];
const PEAL_NAMES = ["Point", "Evidence", "Analysis", "Link"];

/** XP for one right answer: 10, plus 2 for each step of the combo (up to +10). */
export function xpFor(combo: number): number {
  return 10 + 2 * Math.min(combo, 5);
}

function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].sort((p, q) => p - q);
  const y = [...b].sort((p, q) => p - q);
  return x.every((v, i) => v === y[i]);
}

/** The run-on with each boundary turned into a full stop and a capital. */
function fixedSplice(it: SpliceItem): string {
  return it.words
    .map((w, i) => {
      const prevBoundary = it.boundaries.includes(i - 1);
      let out = prevBoundary ? cap(w) : w;
      if (it.boundaries.includes(i)) out = `${out.replace(/,$/, "")}.`;
      return out;
    })
    .join(" ");
}

export function RoundPlayer({
  title,
  entries,
  sound,
  onAnswer,
  onDone,
  onQuit,
}: {
  title: string;
  entries: RoundEntry[];
  sound: boolean;
  onAnswer: (skill: SkillId, right: boolean, xp: number) => void;
  onDone: (r: RoundResult) => void;
  onQuit: () => void;
}) {
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const [xp, setXp] = useState(0);
  const [checked, setChecked] = useState<null | boolean>(null);
  const [gaps, setGaps] = useState<number[]>([]);
  const [choice, setChoice] = useState<number | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [pop, setPop] = useState(0);

  const entry = entries[i]!;
  const item = entry.item;
  const skill = skillById(entry.skill)!;

  function reset() {
    setChecked(null);
    setGaps([]);
    setChoice(null);
    setOrder([]);
  }

  function grade(right: boolean) {
    if (checked !== null) return;
    setChecked(right);
    const nextCombo = right ? combo + 1 : 0;
    const gained = right ? xpFor(combo) : 0;
    setCombo(nextCombo);
    setBest((b) => Math.max(b, nextCombo));
    if (right) {
      setScore((v) => v + 1);
      setXp((v) => v + gained);
      setPop((p) => p + 1);
    }
    play(right ? "right" : "wrong", sound);
    onAnswer(entry.skill, right, gained);
  }

  function check() {
    if (item.kind === "splice") grade(sameSet(gaps, item.boundaries));
    else if (item.kind === "comma") grade(sameSet(gaps, item.commasAfter));
    else if (item.kind === "choice" && choice !== null) grade(choice === item.answer);
    else if (item.kind === "peal" && order.length === 4) grade(order.every((sentence, pos) => item.order[sentence] === pos));
  }

  function next() {
    if (i + 1 >= entries.length) {
      onDone({ score, size: entries.length, xp, bestCombo: best });
      return;
    }
    setI(i + 1);
    reset();
  }

  // Keyboard: Enter checks, then moves on.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      e.preventDefault();
      if (checked === null) check();
      else next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={s.wrap}>
      <div className={s.playTop}>
        <button className={s.ghost} onClick={onQuit} type="button">
          Retreat
        </button>
        <div>
          <div className={`${s.head} ${s.h3}`}>{title}</div>
          <div className={`${s.muted} ${s.small}`}>
            {skill.game}: {skill.skill}
          </div>
        </div>
        <div className={s.progress} aria-label={`Question ${i + 1} of ${entries.length}`}>
          <div className={s.progressFill} style={{ width: `${((i + (checked !== null ? 1 : 0)) / entries.length) * 100}%` }} />
        </div>
        <div key={pop} className={`${s.combo} ${s.head} ${pop ? s.comboPop : ""}`}>
          {combo >= 2 ? `×${combo} combo` : `${score}/${entries.length}`}
        </div>
      </div>

      <div className={s.panel}>
        <p className={`${s.muted} ${s.small}`} style={{ margin: 0 }}>
          {skill.how}
        </p>
        {item.kind === "splice" && <SpliceView item={item} gaps={gaps} setGaps={setGaps} checked={checked} sound={sound} />}
        {item.kind === "comma" && <CommaView item={item} gaps={gaps} setGaps={setGaps} checked={checked} sound={sound} />}
        {item.kind === "choice" && <ChoiceView item={item} choice={choice} setChoice={setChoice} checked={checked} sound={sound} />}
        {item.kind === "peal" && <PealView item={item} order={order} setOrder={setOrder} checked={checked} sound={sound} />}

        {checked !== null && <Feedback item={item} right={checked} />}

        <div className={s.actions}>
          {checked === null ? (
            <>
              <button className={s.btn} type="button" onClick={check} disabled={(item.kind === "choice" && choice === null) || (item.kind === "peal" && order.length < 4)}>
                {item.kind === "splice" ? (gaps.length ? "Fire" : "No split needed: fire") : item.kind === "comma" ? (gaps.length ? "Drop commas" : "No comma needed") : "Check"}
              </button>
              {(item.kind === "splice" || item.kind === "comma") && gaps.length > 0 && (
                <button className={s.ghost} type="button" onClick={() => setGaps([])}>
                  Clear
                </button>
              )}
            </>
          ) : (
            <button className={s.btn} type="button" onClick={next} autoFocus>
              {i + 1 >= entries.length ? "See result" : "Next"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function GapLine({
  words,
  gaps,
  setGaps,
  checked,
  answers,
  mark,
  sound,
}: {
  words: string[];
  gaps: number[];
  setGaps: (g: number[]) => void;
  checked: boolean | null;
  answers: number[];
  mark: string;
  sound: boolean;
}) {
  return (
    <div className={s.sentenceLine}>
      {words.map((w, idx) => {
        const last = idx === words.length - 1;
        const on = gaps.includes(idx);
        let cls = s.gap;
        let shown = on ? mark : "";
        if (checked !== null) {
          const should = answers.includes(idx);
          if (should && on) cls = `${s.gap} ${s.gapRight}`;
          else if (should) {
            cls = `${s.gap} ${s.gapMissed}`;
            shown = mark;
          } else if (on) cls = `${s.gap} ${s.gapWrong}`;
        } else if (on) cls = `${s.gap} ${s.gapOn}`;
        return (
          <span key={idx}>
            {w}
            {!last && (
              <button
                type="button"
                className={cls}
                aria-label={`Gap after "${w}"${on ? " (marked)" : ""}`}
                aria-pressed={on}
                disabled={checked !== null}
                onClick={() => {
                  play("tap", sound);
                  setGaps(on ? gaps.filter((g) => g !== idx) : [...gaps, idx]);
                }}
              >
                {shown}
              </button>
            )}
          </span>
        );
      })}
    </div>
  );
}

function SpliceView(p: { item: SpliceItem; gaps: number[]; setGaps: (g: number[]) => void; checked: boolean | null; sound: boolean }) {
  return (
    <>
      <p className={s.prompt}>Where does each sentence end?{p.item.note ? <span className={`${s.muted} ${s.small}`}> {p.item.note.startsWith("Correct") ? "" : p.item.note}</span> : null}</p>
      <GapLine words={p.item.words} gaps={p.gaps} setGaps={p.setGaps} checked={p.checked} answers={p.item.boundaries} mark="|" sound={p.sound} />
    </>
  );
}

function CommaView(p: { item: CommaItem; gaps: number[]; setGaps: (g: number[]) => void; checked: boolean | null; sound: boolean }) {
  return (
    <>
      <p className={s.prompt}>Drop in the commas this sentence needs.</p>
      <GapLine words={p.item.words} gaps={p.gaps} setGaps={p.setGaps} checked={p.checked} answers={p.item.commasAfter} mark="," sound={p.sound} />
    </>
  );
}

function ChoiceView(p: { item: ChoiceItem; choice: number | null; setChoice: (n: number) => void; checked: boolean | null; sound: boolean }) {
  const { item, choice, checked } = p;
  return (
    <>
      <p className={s.prompt}>{item.prompt.replace("___", "_____")}</p>
      <div className={s.choiceList}>
        {item.options.map((o, idx) => {
          let cls = s.choice;
          if (checked !== null && idx === item.answer) cls = `${s.choice} ${s.choiceRight}`;
          else if (checked !== null && idx === choice) cls = `${s.choice} ${s.choiceWrong}`;
          else if (checked === null && idx === choice) cls = `${s.choice} ${s.choiceRight}`;
          return (
            <button
              key={idx}
              type="button"
              className={cls}
              disabled={checked !== null}
              onClick={() => {
                play("tap", p.sound);
                p.setChoice(idx);
              }}
            >
              {o}
            </button>
          );
        })}
      </div>
    </>
  );
}

function PealView(p: { item: PealOrderItem; order: number[]; setOrder: (o: number[]) => void; checked: boolean | null; sound: boolean }) {
  const { item, order, checked } = p;
  return (
    <>
      <p className={s.prompt}>
        <strong>{item.question}</strong> Tap the sentences in order: Point, Evidence, Analysis, Link.
      </p>
      <div className={s.choiceList}>
        {item.sentences.map((sent, idx) => {
          const pos = order.indexOf(idx);
          const truePos = item.order[idx]!;
          let cls = s.choice;
          if (checked !== null) cls = `${s.choice} ${pos === truePos ? s.choiceRight : s.choiceWrong}`;
          return (
            <button
              key={idx}
              type="button"
              className={cls}
              style={{ display: "flex", alignItems: "flex-start" }}
              disabled={checked !== null}
              onClick={() => {
                play("tap", p.sound);
                if (pos >= 0) p.setOrder(order.slice(0, pos));
                else if (order.length < 4) p.setOrder([...order, idx]);
              }}
            >
              <span className={`${s.pealTag} ${pos < 0 && checked === null ? s.pealTagOff : ""}`}>
                {checked !== null ? PEAL_LETTERS[truePos] : pos >= 0 ? PEAL_LETTERS[pos] : "?"}
              </span>
              <span>{sent}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function Feedback({ item, right }: { item: Item; right: boolean }) {
  const body = useMemo(() => {
    if (item.kind === "splice") {
      if (item.boundaries.length === 0) return <p className={s.fixed}>This one was already correct: a comma plus a joining word (and, but, so) can join two sentences.</p>;
      return (
        <>
          <p className={s.fixed}>{fixedSplice(item)}</p>
          <p className={`${s.muted} ${s.small}`}>
            {item.boundaries.length} sentence {item.boundaries.length === 1 ? "boundary" : "boundaries"}. A comma alone can never join two complete sentences. Use a full stop, a semicolon, or a joining word.
          </p>
        </>
      );
    }
    if (item.kind === "comma") {
      return (
        <>
          <p className={s.fixed}>{item.full}</p>
          <p className={`${s.muted} ${s.small}`}>
            {item.commasAfter.length === 0
              ? "No comma: 'because' and 'that' clauses at the end of a sentence don't need one."
              : "Commas go after an opening word or phrase, around extra information, between list items, and before 'but' or 'so' when they join two sentences."}
          </p>
        </>
      );
    }
    if (item.kind === "choice") return <p className={s.fixed}>{item.why}</p>;
    return (
      <ol style={{ margin: "6px 0 0", paddingLeft: 20 }}>
        {[0, 1, 2, 3].map((pos) => (
          <li key={pos}>
            <strong>{PEAL_NAMES[pos]}:</strong> {item.sentences[item.order.indexOf(pos)]}
          </li>
        ))}
      </ol>
    );
  }, [item]);
  return (
    <div className={`${s.feedback} ${right ? s.fbRight : s.fbWrong}`} role="status">
      <strong className={s.head}>{right ? "Direct hit!" : "Missed."}</strong>
      {body}
    </div>
  );
}
