/** Tiny WebAudio blips, so the game needs no sound files. */
let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, type: OscillatorType, gain = 0.08) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, ctx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + start);
  o.stop(ctx.currentTime + start + dur + 0.02);
}

export type Sfx = "right" | "wrong" | "tap" | "win" | "lose" | "level";

export function play(sfx: Sfx, on: boolean) {
  if (!on || typeof window === "undefined") return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    if (sfx === "tap") tone(660, 0, 0.05, "square", 0.03);
    if (sfx === "right") {
      tone(660, 0, 0.09, "triangle");
      tone(990, 0.08, 0.14, "triangle");
    }
    if (sfx === "wrong") tone(140, 0, 0.25, "sawtooth", 0.05);
    if (sfx === "win") [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.22, "triangle"));
    if (sfx === "lose") [392, 330, 262].forEach((f, i) => tone(f, i * 0.14, 0.25, "triangle", 0.06));
    if (sfx === "level") [523, 784, 1047, 1568].forEach((f, i) => tone(f, i * 0.08, 0.3, "square", 0.04));
  } catch {
    /* no audio: fine */
  }
}
