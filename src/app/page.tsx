import { Oswald } from "next/font/google";
import { RcwGame } from "@/components/RcwGame";
import { RcwGate } from "@/components/RcwGate";
import s from "@/components/rcw.module.css";
import { rcwRole } from "@/lib/auth";
import { readSave } from "@/lib/store";

export const dynamic = "force-dynamic";

const oswald = Oswald({ variable: "--font-rcw-head", weight: ["500", "700"], subsets: ["latin"] });

export default async function Home() {
  const role = await rcwRole();
  // A guest never sees Russell's save: the game starts fresh with everything open.
  const initial = role === "russell" ? await readSave() : null;
  return (
    <main data-rcw-root className={`${oswald.variable} ${s.root}`}>
      {role ? <RcwGame initial={initial} guest={role === "guest"} /> : <RcwGate />}
    </main>
  );
}
