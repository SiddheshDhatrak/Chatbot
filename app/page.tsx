import Link from "next/link";
import { StarMark } from "@/components/StarMark";
import { BRAND, CREDIT, DISCLAIMER, FEATURES, GUARDRAILS, HERO_COPY, TAGLINE } from "@/features/landing/content";

export default function Home() {
  return (
    <div className="min-h-[100dvh] grid place-items-center px-6 py-16">
      <main className="max-w-[760px] w-full text-center">
        <div className="mx-auto w-fit relative">
          <div className="absolute inset-0 blur-3xl bg-[var(--accent)]/25 rounded-full scale-150" />
          <StarMark size={72} className="relative" />
        </div>
        <h1 className="font-display text-[44px] md:text-[64px] leading-[1.02] mt-6 tracking-wide">{BRAND}</h1>
        <p className="font-display italic champagne-text text-[22px] md:text-[30px] leading-tight mt-1">{TAGLINE}</p>
        <p className="mt-4 text-[14.5px] text-[var(--muted)] max-w-[600px] mx-auto leading-relaxed">{HERO_COPY}</p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          <Link href="/chat" className="btn-luxe btn-primary-luxe px-7 py-3 text-sm">
            Start researching
          </Link>
          <Link href="/api/metrics" className="btn-luxe px-7 py-3 text-sm hairline hover:bg-[var(--accent-soft)]">
            Run metrics API
          </Link>
        </div>
        <div className="mt-10 grid sm:grid-cols-2 gap-3 text-left">
          {/* Guardrails get their own detailed card below */}
          {FEATURES.filter((f) => f.key !== "guardrails").map((f) => (
            <div key={f.title} className="luxe-card rounded-2xl p-4">
              <p className="text-[14px] font-medium">{f.title}</p>
              <p className="text-[12.5px] text-[var(--muted)] mt-1 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 luxe-card rounded-2xl p-4 text-left">
          <p className="text-[14px] font-medium">Guardrails</p>
          <ul className="mt-1.5 space-y-1 text-[12.5px] text-[var(--muted)] list-disc pl-4">
            {GUARDRAILS.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        </div>
        <footer className="mt-8 text-[12px] text-[var(--muted)]">
          {CREDIT}
          <br />
          <span className="text-[11px]">{DISCLAIMER}</span>
        </footer>
      </main>
    </div>
  );
}
