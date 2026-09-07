import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function HowToPlayPage() {
  return <main className="mx-auto max-w-md space-y-6 px-5 py-8">
    <Link href="/" className="text-sm font-bold underline">Back to Beans</Link>
    <BrandMark />
    <h1 className="text-3xl font-extrabold">Four picks. Then push your luck.</h1>
    <p>One friend makes a room. Everyone else joins with the link, QR code, or room code. Bring 2–10 people and one phone each.</p>
    <ol className="space-y-3">
      <li className="panel"><strong>1. Pick a topic.</strong><p className="mt-1 text-sm">Vote for the one you want to argue about.</p></li>
      <li className="panel"><strong>2. Draft your best four.</strong><p className="mt-1 text-sm">Take turns locking one answer. The order reverses after every pass. Once picked, an answer belongs to that player. Use My Ideas to prepare privately.</p></li>
      <li className="panel"><strong>3. Earn beans.</strong><p className="mt-1 text-sm">Everyone gets 20 beans, plus up to 40 from the AI judge. With 3 or more players, vote for someone else&apos;s best four: each vote adds 5 beans. Two players? The AI judges both drafts.</p></li>
      <li className="panel"><strong>4. Roll or bank.</strong><p className="mt-1 text-sm">Choose beans for your dice pot. Roll on your turn, or bank your pot while you wait. Only your own rolls affect your beans.</p></li>
    </ol>
    <section className="panel space-y-3">
      <h2 className="text-xl font-extrabold">The dice, in plain English</h2>
      <p className="text-sm"><strong>Your first two rolls are safe.</strong> A 7 adds 70 beans. Anything else adds the total of both dice.</p>
      <p className="text-sm"><strong>From your third roll:</strong> 7 loses your dice pot. Doubles double it. Anything else adds the dice total.</p>
      <p className="text-sm">Tap <strong>Bank beans</strong> to keep your pot and sit out the rest of the dice round. Once your own throw starts, that throw must finish first.</p>
      <p className="text-sm">Beans you kept safe are never lost in a bust. If you do nothing when it&apos;s your turn, your pot banks automatically after the countdown.</p>
    </section>
    <p className="font-extrabold">Most banked beans at the end wins.</p>
    <details className="panel"><summary className="cursor-pointer font-bold">Party Mode</summary><p className="mt-2 text-sm">The host can switch on optional sip prompts. Any drink counts. Passing never changes your score.</p></details>
    <section id="homescreen" className="panel space-y-2">
      <h2 className="text-xl font-extrabold">Keep Beans on your phone</h2>
      <p className="text-sm">On iPhone, open this page in Safari, tap Share, then Add to Home Screen. You can always play from the link.</p>
      <p className="text-sm">Playing with friends needs an internet connection.</p>
    </section>
  </main>;
}
