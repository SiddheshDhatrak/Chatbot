import Link from "next/link";
import { StarMark } from "@/components/StarMark";

const FEATURES = [
  { title: "Live streaming", body: "Groq replies stream token-by-token with stop & retry." },
  { title: "Kept history", body: "SQLite-backed sessions — search, rename, delete." },
  { title: "Artifacts", body: "Code blocks open in a sidebar with copy & download." },
];

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
          A self-hosted AI chat salon — pick a Groq model, stream replies live,
          and keep every conversation in your own SQLite database. No accounts, no tiers.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
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
        <div className="mt-10 grid sm:grid-cols-3 gap-3 text-left">
          {FEATURES.map((f) => (
            <div key={f.title} className="luxe-card rounded-2xl p-4">
              <p className="text-[14px] font-medium">{f.title}</p>
              <p className="text-[12.5px] text-[var(--muted)] mt-1 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 text-[12px] text-[var(--muted)]">
          Groq-powered streaming · SQLite-backed memory · model switcher, voice, retry & share included
        </p>
      </main>
    </div>
  );
}
