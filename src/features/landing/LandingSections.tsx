import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Code2,
  Database,
  Search,
  Sparkles,
  Check,
  Zap,
} from "lucide-react";
import { StarMark } from "@/components/StarMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/Button";

const fade = (delay = 0) => ({
  initial: { y: 28, opacity: 0 },
  whileInView: { y: 0, opacity: 1 },
  viewport: { once: true, margin: "-80px" },
  transition: { delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
});

const NAV_LINKS = [
  { label: "Atelier", href: "#atelier" },
  { label: "How it works", href: "#how" },
  { label: "Storage", href: "#storage" },
];

export function LandingNav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 pt-4">
        <div className="glass rounded-full pl-4 pr-2 py-2 flex items-center justify-between shadow-[var(--shadow-luxe)]">
          <Link to="/" className="flex items-center gap-2">
            <StarMark size={28} />
            <span className="font-display text-[18px]">Claude</span>
          </Link>
          <div className="hidden md:flex items-center gap-7 text-[13.5px] text-[var(--foreground-dim)]">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-[var(--foreground)] transition">
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/chat">
              <Button size="sm">Enter salon <ArrowRight size={14} /></Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

export function LandingHero() {
  return (
    <section className="relative pt-[150px] md:pt-[170px] pb-16 px-4 text-center overflow-hidden">
      <motion.div {...fade(0)} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full hairline glass text-[12px] text-[var(--foreground-dim)]">
        <Sparkles size={13} className="text-[var(--accent)]" />
        Groq-powered streaming · SQLite-backed history
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </motion.div>
      <motion.h1
        {...fade(0.08)}
        className="font-display text-[44px] md:text-[84px] leading-[0.98] mt-7 max-w-[960px] mx-auto"
      >
        Intelligence,
        <br />
        <span className="italic champagne-text">tailored like couture.</span>
      </motion.h1>
      <motion.p {...fade(0.16)} className="mt-6 text-[15px] md:text-[17px] text-[var(--muted)] max-w-[620px] mx-auto leading-relaxed">
        A self-hosted chat salon: pick a Groq model, stream replies live, and keep
        every conversation in your own SQLite database. No accounts, no tiers.
      </motion.p>
      <motion.div {...fade(0.24)} className="mt-9 flex items-center justify-center gap-3 flex-wrap">
        <Link to="/chat">
          <Button size="lg">Begin composing <ArrowRight size={16} /></Button>
        </Link>
        <a href="#atelier">
          <Button size="lg" variant="outline">See what it does</Button>
        </a>
      </motion.div>

      {/* product frame — stylized preview of the real workspace */}
      <motion.div
        initial={{ y: 80, opacity: 0, rotateX: 12 }}
        whileInView={{ y: 0, opacity: 1, rotateX: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        className="max-w-[980px] mx-auto mt-16 [perspective:1200px]"
      >
        <div className="luxe-card rounded-[28px] p-2 md:p-3 text-left">
          <div className="rounded-[20px] overflow-hidden border border-[var(--border)] bg-[var(--background-soft)]">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-[var(--border)]">
              {["#e08a6d", "#c9a96a", "#7fb685"].map((c) => (
                <span key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
              ))}
              <span className="ml-3 text-[12px] text-[var(--muted)] font-mono">claude — salon privé</span>
              <span className="ml-auto text-[11px] px-2.5 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/25">
                ● live preview
              </span>
            </div>
            <div className="grid md:grid-cols-[1fr_300px]">
              <div className="p-5 md:p-7 space-y-5">
                <div className="flex justify-end">
                  <div className="px-4 py-3 rounded-2xl rounded-br-md text-[13.5px] max-w-[80%]" style={{ background: "var(--user-bubble)", color: "var(--user-ink)" }}>
                    Refactor this list — make it worthy of production.
                  </div>
                </div>
                <div className="flex gap-3">
                  <StarMark size={26} />
                  <div className="text-[13.5px] leading-relaxed text-[var(--foreground-dim)]">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] mb-1">Claude</p>
                    Consider it tailored — stable keys, memoized rows, semantic markup.
                    <pre className="mt-3 text-[11.5px] font-mono p-3.5 rounded-xl overflow-x-auto border border-[var(--border)] bg-[var(--code-bg)] text-[#f5f1e8]">
{`const Row = memo(({ value }) => <li>{value}</li>);`}
                    </pre>
                  </div>
                </div>
              </div>
              <div className="border-t md:border-t-0 md:border-l border-[var(--border)] p-5 bg-[var(--background-elev)]/50">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Artifact · List.tsx</p>
                <div className="mt-3 space-y-2">
                  {["Streamed reply", "Code sidebar", "Copy & download"].map((r) => (
                    <div key={r} className="h-11 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent)]/20 grid place-items-center text-[12px] text-[var(--muted)]">
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

export function Bento() {
  const cards = [
    { icon: Zap, title: "Live streaming", body: "Replies stream token-by-token over SSE. Stop anytime; partial answers are kept, not lost.", span: "md:col-span-2" },
    { icon: Database, title: "Your history, kept", body: "Sessions and messages persist in SQLite. Search, rename, and delete from the sidebar." },
    { icon: Code2, title: "Artifacts sidebar", body: "Fenced code blocks open beside the chat with copy and download. HTML/SVG previews render live." },
    { icon: Search, title: "Workspace craft", body: "Model switcher, voice dictation, file context, read-aloud, retry, and ⌘K command palette.", span: "md:col-span-2" },
  ];
  return (
    <section id="atelier" className="max-w-[1200px] mx-auto px-4 md:px-6 py-24 scroll-mt-24">
      <motion.p {...fade()} className="text-[11px] uppercase tracking-[0.3em] text-[var(--accent)]">L’atelier</motion.p>
      <motion.h2 {...fade(0.06)} className="font-display text-[34px] md:text-[56px] leading-tight mt-3 max-w-[700px]">
        Every detail, <span className="italic champagne-text">considered.</span>
      </motion.h2>
      <div className="grid md:grid-cols-4 gap-4 mt-10">
        {cards.map((c, i) => (
          <motion.div key={c.title} {...fade(i * 0.06)} className={`luxe-card rounded-3xl p-6 group hover:-translate-y-1 hover:border-[var(--accent)]/40 transition-all duration-400 ${c.span ?? ""}`}>
            <span className="w-10 h-10 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)]/25 grid place-items-center text-[var(--accent)] group-hover:scale-110 transition-transform">
              <c.icon size={17} />
            </span>
            <h3 className="font-display text-[20px] mt-4">{c.title}</h3>
            <p className="text-[13.5px] text-[var(--muted)] mt-2 leading-relaxed">{c.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    { title: "1. Pick a model", body: "Choose from the Groq models in the top bar. The choice is sent with every request and remembered locally." },
    { title: "2. Compose", body: "Type, dictate with the mic, or attach a text file for context. Enter sends, Shift+Enter adds a newline." },
    { title: "3. Refine", body: "Retry a reply, read it aloud, copy it, or vote — feedback is saved on this device." },
  ];
  return (
    <section id="how" className="border-y border-[var(--border)] bg-[var(--background-soft)]/60 scroll-mt-24">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-20">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--accent)]">How it works</p>
        <h2 className="font-display text-[30px] md:text-[44px] mt-3">Three steps to a good reply.</h2>
        <div className="grid md:grid-cols-3 gap-5 mt-10">
          {steps.map((s, i) => (
            <motion.div key={s.title} {...fade(i * 0.07)} className="luxe-card rounded-3xl p-6">
              <h3 className="font-display text-[19px]">{s.title}</h3>
              <p className="text-[13.5px] text-[var(--muted)] mt-2 leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StorageNote() {
  const points = ["SQLite file at DATABASE_URL", "Rename, search & delete included", "Share copies a link — nothing is public"];
  return (
    <section id="storage" className="max-w-[1100px] mx-auto px-4 md:px-6 py-20 scroll-mt-24">
      <div className="luxe-card rounded-[26px] p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-8">
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--accent)]">Storage</p>
          <h2 className="font-display text-[28px] md:text-[38px] mt-2">Runs locally. <span className="italic champagne-text">Keeps locally.</span></h2>
          <ul className="mt-5 space-y-2.5 text-[13.5px] text-[var(--foreground-dim)]">
            {points.map((f) => (
              <li key={f} className="flex gap-2"><Check size={15} className="text-[var(--accent)] mt-0.5 shrink-0" />{f}</li>
            ))}
          </ul>
        </div>
        <Link to="/chat" className="shrink-0">
          <Button size="lg">Open your salon <ArrowRight size={16} /></Button>
        </Link>
      </div>
    </section>
  );
}

export function FinalCTA() {
  return (
    <section className="max-w-[900px] mx-auto px-4 py-24 text-center">
      <StarMark size={52} className="mx-auto" />
      <h2 className="font-display text-[36px] md:text-[60px] leading-tight mt-6">
        Your finest thinking,
        <br /><span className="italic champagne-text">beautifully accompanied.</span>
      </h2>
      <Link to="/chat" className="inline-block mt-9">
        <Button size="lg">Enter the salon <ArrowUpRight size={16} /></Button>
      </Link>
      <footer className="mt-20 pt-8 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-3 text-[12px] text-[var(--muted)]">
        <span className="font-display italic text-[15px] text-[var(--foreground-dim)]">Claude — maison d’IA</span>
        <span>Self-hosted demo · Groq + SQLite · Noir & Ivory editions</span>
      </footer>
    </section>
  );
}

/**
 * Deprecated stubs — kept so older imports don't break.
 * The honest landing no longer renders fictional brands, quotes, or pricing.
 */
export function LogoMarquee() {
  return null;
}

export function Pricing() {
  return null;
}

export function Testimonials() {
  return null;
}
