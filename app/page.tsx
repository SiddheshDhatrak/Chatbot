import Link from "next/link";
import { StarMark } from "@/components/StarMark";

export default function Home() {
  return (
    <div className="min-h-[100dvh] grid place-items-center px-6 py-16">
      <main className="max-w-[680px] w-full text-center">
        <div className="mx-auto w-fit relative">
          <div className="absolute inset-0 blur-3xl bg-[var(--accent)]/25 rounded-full scale-150" />
          <StarMark size={72} className="relative" />
        </div>
        <h1 className="font-display text-[36px] md:text-[54px] leading-[1.05] mt-6">
          Claude <span className="italic champagne-text">Maison d&rsquo;IA</span>
        </h1>
        <p className="mt-4 text-[14.5px] text-[var(--muted)] max-w-[520px] mx-auto leading-relaxed">
          A luxurious AI chat salon with persistent history — every conversation
          stored in a real database, every reply composed live by Groq.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/chat" className="btn-luxe btn-primary-luxe px-7 py-3 text-sm">
            Enter the salon
          </Link>
          <Link
            href="/api/sessions"
            className="btn-luxe px-7 py-3 text-sm hairline hover:bg-[var(--accent-soft)]"
          >
            Browse history API
          </Link>
        </div>
        <p className="mt-6 text-[12px] text-[var(--muted)]">
          Groq-powered streaming · SQLite-backed memory · rename, search &amp; delete included
        </p>
      </main>
    </div>
  );
}
