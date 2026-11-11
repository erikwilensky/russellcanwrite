/**
 * Russell Can Write: a rule-based reading of one paragraph. It runs instantly in the browser and
 * is the fallback when the AI coach is off. It flags; it never rewrites.
 */

export type Flag = { sentence: number; kind: "run-on" | "long" | "linker" | "opener" | "word" | "topic"; note: string };

export type Gauges = {
  /** 0 to 3 each. */
  sentences: number;
  topic: number;
  peal: number;
  words: number;
};

export type Analysis = {
  sentences: string[];
  wordCount: number;
  flags: Flag[];
  gauges: Gauges;
  total: number;
  peal: { point: boolean; evidence: boolean; analysis: boolean; link: boolean };
  runOnsPer100: number;
  claimFirst: boolean;
  wordSlips: number;
};

export function splitSentences(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  return clean
    .split(/(?<=[.!?]["'’”]?)\s+(?=["'‘“]?[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const LINKERS = ["however", "therefore", "thus", "hence", "consequently", "furthermore", "moreover", "additionally"];
const OPENER_WORDS = [
  "additionally",
  "overall",
  "however",
  "therefore",
  "furthermore",
  "consequently",
  "meanwhile",
  "similarly",
  "moreover",
  "finally",
  "firstly",
  "secondly",
  "ultimately",
];
const SPLICE_SUBJECT =
  /,\s+(it|this|they|he|she|these|we|i|there is|there are|the reader|the audience|the viewer|readers|the poster|the image|the layout|the slogan|the text|the advert|the advertisement|the source|the photo|the map|the army|the soldiers|the fleet|the enemy)\s+(?!who\b|which\b|that\b)[a-z]+/gi;

const WORD_RULES: Array<{ re: RegExp; note: string }> = [
  { re: /\bthere\s+(own|head|heads|beliefs?|choices?|awareness|environmental|actions?|views?|minds?|lives|homes?|families|horses|army|armies|ships?|leaders?)\b/i, note: "'there' should be 'their' (belonging to them)" },
  { re: /\b(effects?|effected|effecting)\s+(the|their|a|an|his|her|our|readers?|audiences?|viewers?|people|them|him|us)\b/i, note: "'effect' as a verb should be 'affect'" },
  { re: /\ba\s+since\s+of\b/i, note: "'a since of' should be 'a sense of'" },
  { re: /\bbellow\b/i, note: "'bellow' means shout; 'below' means under" },
  { re: /\btress\b/i, note: "'tress' should be 'trees'" },
  { re: /\balot\b/i, note: "'alot' should be 'a lot'" },
  { re: /\b(should|could|would|must)\s+of\b/i, note: "'should of' should be 'should have'" },
  { re: /\bit's\s+(own|the\s+end)\b/i, note: "'it's own' should be 'its own'" },
  { re: /\bdenotations?\s+of\s+(green|grey|gray|yellow|red|colou?r)/i, note: "colours have connotations (what they suggest), not denotations" },
  { re: /\bchimney's\b/i, note: "plural 'chimneys' takes no apostrophe" },
];

const DESCRIPTION_START = [
  /^(in|on|at)\s+the\s+(top|bottom|centre|center|left|right|middle|background|foreground)/i,
  /^there\s+(is|are|was|were)\b/i,
  /^the\s+(poster|image|source|photo|photograph|map|painting|picture|advert|advertisement|text)\s+(includes|shows|has|contains|is)\b/i,
  /\bit includes\b/i,
];
const CLAIM_WORDS = /\b(because|suggests?|shows?\s+that|makes?|persuades?|forces?|creates?|reveals?|encourages?|so that|which|turns?|explains?|was|were|won|failed|succeeded|led|caused)\b/i;
const QUOTE = /["“‘'][^"”’']{3,}["”’']/;
const ANALYSIS_WORDS = /\b(suggests?|connotations?|implies|implying|this\s+(means|shows|makes|creates|suggests|meant|made|allowed|let)|because|so\s+the|which\s+(makes|made|means|meant|allowed|let)|effect|as a result|this is why|in other words|emphasi[sz]es?)\b/i;
const LINK_WORDS = /\b(therefore|as a result|overall|this is why|thus|consequently|this shows|ultimately|in conclusion|this explains|which is why)\b/i;

export function analyse(text: string): Analysis {
  const sentences = splitSentences(text);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const flags: Flag[] = [];
  let runOns = 0;
  let wordSlips = 0;

  sentences.forEach((s, i) => {
    const n = s.split(/\s+/).length;
    const lower = s.toLowerCase();
    let isRunOn = false;
    for (const l of LINKERS) {
      const bad = new RegExp(`,\\s+${l}\\b(?!,)`, "i");
      const aside = new RegExp(`^[^,]{1,40},\\s+${l},`, "i");
      if (bad.test(s) || (new RegExp(`,\\s+${l},`, "i").test(s) && !aside.test(s))) {
        flags.push({ sentence: i, kind: "linker", note: `'${l}' after a comma joins two sentences. Use a full stop or a semicolon before it.` });
        isRunOn = true;
        break;
      }
    }
    SPLICE_SUBJECT.lastIndex = 0;
    const splice = SPLICE_SUBJECT.exec(s);
    const startsWithSub = /^(although|because|when|while|if|as|since|after|before|unless|whereas|though)\b/i.test(s);
    if (!isRunOn && splice && !startsWithSub && n > 12) {
      flags.push({ sentence: i, kind: "run-on", note: `Is "${splice[0].replace(/^,\s+/, "")}…" the start of a new sentence? Read it aloud and listen for the stop.` });
      isRunOn = true;
    }
    if (n > 35) {
      flags.push({ sentence: i, kind: "long", note: `${n} words in one sentence. Where could it be split?` });
      if (!isRunOn) isRunOn = n > 45;
    }
    if (isRunOn) runOns++;
    const first = lower.split(/\s+/)[0]?.replace(/[^a-z]/g, "") ?? "";
    if (OPENER_WORDS.includes(first) && !/^\S+,/.test(s)) {
      flags.push({ sentence: i, kind: "opener", note: `Add a comma after '${s.split(/\s+/)[0]}'.` });
    }
    for (const rule of WORD_RULES) {
      if (rule.re.test(s)) {
        flags.push({ sentence: i, kind: "word", note: rule.note });
        wordSlips++;
      }
    }
  });

  const first = sentences[0] ?? "";
  const described = DESCRIPTION_START.some((re) => re.test(first));
  // A first sentence that is not a description and has some length counts as a claim;
  // argument words (because, suggests, makes...) earn the full gauge.
  const claimFirst = !!first && !described && first.split(/\s+/).length >= 6 && !/\?\s*$/.test(first);
  if (first && described) flags.push({ sentence: 0, kind: "topic", note: "This opens with a description. What point are you making?" });

  const body = sentences.slice(1, -1).join(" ");
  const last = sentences.length > 1 ? sentences[sentences.length - 1]! : "";
  const peal = {
    point: claimFirst || (!!first && !described),
    evidence: QUOTE.test(text) || /\b\d{2,}\b/.test(body) || /\b(the source|the map|the photo|the poster|the plan|the painting|according to)\b/i.test(body),
    analysis: ANALYSIS_WORDS.test(body) || ANALYSIS_WORDS.test(last),
    link: !!last && LINK_WORDS.test(last),
  };

  const per100 = wordCount ? (runOns / wordCount) * 100 : 0;
  const sentencesGauge = wordCount < 20 ? 0 : per100 === 0 ? 3 : per100 <= 1 ? 2 : per100 <= 2.5 ? 1 : 0;
  const topicGauge = !first ? 0 : described ? 0 : claimFirst ? (CLAIM_WORDS.test(first) || /,\s+(but|although|while)\b/i.test(first) ? 3 : 2) : 1;
  const pealCount = Number(peal.point) + Number(peal.evidence) + Number(peal.analysis) + Number(peal.link);
  const pealGauge = Math.max(0, pealCount - 1);
  const wordsGauge = wordCount < 20 ? 0 : wordSlips === 0 ? 3 : wordSlips === 1 ? 2 : wordSlips === 2 ? 1 : 0;
  const gauges = { sentences: sentencesGauge, topic: topicGauge, peal: pealGauge, words: wordsGauge };

  return {
    sentences,
    wordCount,
    flags,
    gauges,
    total: gauges.sentences + gauges.topic + gauges.peal + gauges.words,
    peal,
    runOnsPer100: Math.round(per100 * 10) / 10,
    claimFirst,
    wordSlips,
  };
}

/** A siege falls at 9 of 12 with at least 60 words. */
export const SIEGE_WIN = 9;
export const SIEGE_MIN_WORDS = 60;
