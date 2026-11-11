import { Oswald } from "next/font/google";
import { RcwGame } from "@/components/RcwGame";
import { RcwGate } from "@/components/RcwGate";
import s from "@/components/rcw.module.css";
import { rcwSignedIn } from "@/lib/auth";
import { readSave } from "@/lib/store";

export const dynamic = "force-dynamic";

const oswald = Oswald({ variable: "--font-rcw-head", weight: ["500", "700"], subsets: ["latin"] });

export default async function Home() {
  const signedIn = await rcwSignedIn();
  const initial = signedIn ? await readSave() : null;
  return (
    <main data-rcw-root className={`${oswald.variable} ${s.root}`}>
      {signedIn ? <RcwGame initial={initial} /> : <RcwGate />}
    </main>
  );
}
