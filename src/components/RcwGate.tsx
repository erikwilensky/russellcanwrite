"use client";

import { useEffect, useState } from "react";
import s from "./rcw.module.css";

const LEN = 8;

export function RcwGate() {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(0);
  const [busy, setBusy] = useState(false);

  async function submit(c: string) {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: c }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        window.location.reload();
        return;
      }
      setErr(data.error ?? "Wrong code.");
      setShake((n) => n + 1);
      setCode("");
    } catch {
      setErr("No connection.");
    } finally {
      setBusy(false);
    }
  }

  function press(d: string) {
    if (busy) return;
    const next = (code + d).slice(0, LEN);
    setCode(next);
    if (next.length === LEN) void submit(next);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === "Backspace") setCode((c) => c.slice(0, -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className={s.gate}>
      <div className={`${s.panel} ${s.gateCard}`}>
        <div className={`${s.head} ${s.small}`} style={{ color: "var(--muted)" }}>
          Classified · authorised personnel only
        </div>
        <h1 className={`${s.head} ${s.gateTitle}`}>Russell Can Write</h1>
        <p className={s.muted} style={{ margin: 0 }}>
          Enter your access code, Commander.
        </p>
        <div key={shake} className={`${s.codeRow} ${shake ? s.shake : ""}`} aria-label={`${code.length} of ${LEN} digits entered`}>
          {Array.from({ length: LEN }, (_, i) => (
            <div key={i} className={`${s.codeCell} ${i < code.length ? s.codeCellOn : ""}`}>
              {i < code.length ? "•" : ""}
            </div>
          ))}
        </div>
        <div className={s.keypad}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button key={d} type="button" className={s.key} onClick={() => press(d)}>
              {d}
            </button>
          ))}
          <button type="button" className={s.key} onClick={() => setCode(code.slice(0, -1))} aria-label="Delete">
            ⌫
          </button>
          <button type="button" className={s.key} onClick={() => press("0")}>
            0
          </button>
          <button type="button" className={s.key} onClick={() => setCode("")} aria-label="Clear">
            C
          </button>
        </div>
        {err && (
          <p className={s.lose} role="alert">
            {err}
          </p>
        )}
      </div>
    </div>
  );
}
