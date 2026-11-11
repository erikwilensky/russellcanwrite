import { NextResponse } from "next/server";
import OpenAI from "openai";
import { rcwSignedIn } from "@/lib/auth";
import { analyse, type Gauges } from "@/lib/analyse";
import { DISPATCHES } from "@/lib/content";

type CoachQuestion = { quote: string; question: string };

const SYSTEM = `You are the writing coach inside a game for Russell, a Year 11 MYP English Language and Literature student.
His teacher says his ideas and analysis are good. His problems are:
- run-on sentences: comma splices and fused sentences; "however", "thus" and "therefore" joining two sentences after a comma
- missing commas after openers such as "Additionally" and "Overall"
- paragraphs that open with a description ("In the top left of the poster there is...") instead of a claim
- more than one point in a paragraph; the PEAL structure is Point, Evidence, Analysis, Link
- sound-alike words: there/their, effect/affect, since/sense, bellow/below, tress/trees; denotation used where connotation is meant

Mark ONE paragraph he wrote. Score four gauges from 0 to 3:
- sentences: 3 = every sentence correctly ended and punctuated; 2 = one slip; 1 = two or three; 0 = many run-ons
- topic: 3 = the first sentence makes a clear, arguable claim that answers the question; 2 = a claim but vague; 1 = mostly description; 0 = no topic sentence
- peal: 3 = clear point, evidence, analysis of that evidence, and a link back to the question; subtract 1 for each part missing or weak, or if the paragraph makes two separate points
- words: 3 = no sound-alike or terminology slips; 2 = one; 1 = two; 0 = three or more

Then ask up to three short coaching questions, each tied to an exact quote of 3 to 10 words copied from his paragraph.
The questions point him to the problem, like a teacher pointing at a line: "Read this aloud. Where do you take a breath?" or "Is this a claim or a description?"
NEVER write a corrected sentence, a model answer or any replacement wording. He must fix it himself.
Also give one short, specific piece of praise.
Return JSON only: {"gauges":{"sentences":n,"topic":n,"peal":n,"words":n},"questions":[{"quote":"...","question":"..."}],"praise":"..."}`;

function clamp(n: unknown): number {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.min(3, Math.max(0, v)) : 0;
}

export async function POST(req: Request) {
  if (!(await rcwSignedIn())) return NextResponse.json({ ok: false }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { dispatchId?: unknown; text?: unknown };
  const text = typeof body.text === "string" ? body.text.slice(0, 4000) : "";
  const id = typeof body.dispatchId === "string" ? body.dispatchId : "";
  const dispatch = Object.values(DISPATCHES).flat().find((d) => d.id === id);
  if (!dispatch || text.trim().split(/\s+/).length < 15) {
    return NextResponse.json({ ok: false, error: "Write at least a few sentences first." }, { status: 400 });
  }

  const rules = analyse(text);
  const key = process.env.OPENAI_API_KEY?.trim();
  const client = key ? new OpenAI({ apiKey: key }) : null;
  if (!client) {
    return NextResponse.json({ ok: true, source: "rules", gauges: rules.gauges, questions: [], praise: "" });
  }
  try {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Source: ${dispatch.source}\nQuestion: ${dispatch.question}\n\nRussell's paragraph:\n${text}`,
        },
      ],
    });
    const raw = JSON.parse(response.choices[0]?.message?.content ?? "{}") as {
      gauges?: Partial<Gauges>;
      questions?: Array<Partial<CoachQuestion>>;
      praise?: unknown;
    };
    const g = raw.gauges ?? {};
    const gauges: Gauges = {
      sentences: clamp(g.sentences),
      topic: clamp(g.topic),
      peal: clamp(g.peal),
      words: clamp(g.words),
    };
    // Keep only questions whose quote really is in his text, so a highlight always lands.
    const questions = (raw.questions ?? [])
      .filter((q): q is CoachQuestion => typeof q.quote === "string" && typeof q.question === "string")
      .filter((q) => text.includes(q.quote))
      .slice(0, 3);
    const praise = typeof raw.praise === "string" ? raw.praise.slice(0, 300) : "";
    return NextResponse.json({ ok: true, source: "ai", gauges, questions, praise });
  } catch (err) {
    console.error("[rcw] coach failed", err);
    return NextResponse.json({ ok: true, source: "rules", gauges: rules.gauges, questions: [], praise: "" });
  }
}
