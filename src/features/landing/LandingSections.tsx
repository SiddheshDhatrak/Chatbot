import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  Check,
  CircleCheck,
  ListTree,
  NotebookPen,
  Search,
  ShieldCheck,
  Telescope,
} from "lucide-react";
import { StarMark } from "@/components/StarMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { BRAND, CREDIT, DISCLAIMER, FEATURES, GUARDRAILS, HERO_COPY, STEPS, TAGLINE } from "./content";

const fade = (delay = 0) => ({
  initial: { y: 28, opacity: 0 },
  whileInView: { y: 0, opacity: 1 },
  viewport: { once: true, margin: "-80px" },
  transition: { delay, duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
});

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Guardrails", href: "#guardrails" },
];

const FEATURE_ICONS = {
  research: Telescope,
  trace: ListTree,
  citations: BadgeCheck,
  notes: NotebookPen,
  guardrails: ShieldCheck,
} as const;

export function LandingNav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 pt-4">
        <div className="glass rounded-full pl-4 pr-2 py-2 flex items-center justify-between shadow-[var(--shadow-luxe)]">
          <Link to="/" className="flex items-center gap-2">
            <StarMark size={28} />
            <span className="font-display text-[18px] tracking-wide">{BRAND}</span>
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
              <Button size="sm">
                Start researching <ArrowRight size={14} />
              </Button>
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
      <motion.div
        {...fade(0)}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full hairline glass text-[12px] text-[var(--foreground-dim)]"
      >
        <Telescope size={13} className="text-[var(--accent)]" />
        ReAct agent · web search · cited answers
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </motion.div>
      <motion.h1 {...fade(0.08)} className="font-display text-[48px] md:text-[92px] leading-[0.98] mt-7 tracking-wide">
        {BRAND}
      </motion.h1>
      <motion.p {...fade(0.12)} className="font-display italic champagne-text text-[24px] md:text-[38px] leading-tight mt-2">
        {TAGLINE}
      </motion.p>
      <motion.p
        {...fade(0.16)}
        className="mt-6 text-[15px] md:text-[17px] text-[var(--muted)] max-w-[660px] mx-auto leading-relaxed"
      >
        {HERO_COPY}
      </motion.p>
      <motion.div {...fade(0.24)} className="mt-9 flex items-center justify-center gap-3 flex-wrap">
        <Link to="/chat">
          <Button size="lg">
            Start researching <ArrowRight size={16} />
          </Button>
        </Link>
        <a href="#how">
          <Button size="lg" variant="outline">
            How it works
          </Button>
        </a>
      </motion.div>

      {/* Stylized preview of a real research answer: trace, cited answer, sources */}
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
              <span className="ml-3 text-[12px] text-[var(--muted)] font-mono">nexora — research mode</span>
              <span className="ml-auto text-[11px] px-2.5 py-1 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] border border-[var(--accent)]/25">
                ● example
              </span>
            </div>
            <div className="grid md:grid-cols-[1fr_320px]">
              <div className="p-5 md:p-7 space-y-4">
                <div className="flex justify-end">
                  <div
                    className="px-4 py-3 rounded-2xl rounded-br-md text-[13.5px] max-w-[85%]"
                    style={{ background: "var(--user-bubble)", color: "var(--user-ink)" }}
                  >
                    What is the context window of GPT-OSS 120B according to Groq docs?
                  </div>
                </div>
                <div className="flex gap-3">
                  <StarMark size={26} />
                  <div className="text-[13.5px] leading-relaxed text-[var(--foreground-dim)]">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)] mb-1">{BRAND} · Research</p>
                    According to Groq&rsquo;s model page, GPT-OSS 120B has a context window of{" "}
                    <strong className="text-[var(--foreground)]">131,072 tokens</strong>
                    <sup className="ml-0.5 px-1 rounded-[5px] text-[10px] font-semibold text-[var(--accent)] bg-[var(--accent-soft)]">
                      1
                    </sup>
                    .
                    <div className="mt-3 flex items-center gap-2 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[12px]">
                      <span className="text-[var(--accent)] font-semibold">1</span>
                      <span className="text-[var(--foreground)]">OpenAI GPT-OSS 120B - GroqDocs</span>
                      <span className="ml-auto px-1.5 rounded-full border border-emerald-500/40 text-emerald-500 text-[10px]">read</span>
                    </div>
                    <p className="mt-2 text-[11px] text-[var(--muted)]">41s · 3 tool calls · 1 page read · 1 note · support 100%</p>
                  </div>
                </div>
              </div>
              <div className="border-t md:border-t-0 md:border-l border-[var(--border)] p-5 bg-[var(--background-elev)]/50 text-[12px]">
                <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Research trace</p>
                <ol className="mt-3 space-y-2.5">
                  {[
                    { icon: Search, tool: "web_search", text: '"Groq GPT-OSS 120B context window"' },
                    { icon: BookOpen, tool: "read_page", text: "console.groq.com/docs/model/…" },
                    { icon: NotebookPen, tool: "save_note", text: '"GPT-OSS 120B context window"' },
                  ].map((s, i) => (
                    <li key={s.tool} className="flex gap-2">
                      <span className="text-[var(--muted)] w-3">{i + 1}</span>
                      <s.icon size={13} className="mt-0.5 shrink-0 text-[var(--accent)]" />
                      <span className="min-w-0">
                        <span className="px-1.5 rounded-md border border-[var(--accent)]/30 bg-[var(--accent-soft)] text-[10.5px]">{s.tool}</span>{" "}
                        <span className="text-[var(--muted)] break-all">{s.text}</span>
                      </span>
                      <CircleCheck size={12} className="ml-auto mt-0.5 shrink-0 text-emerald-500" />
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

export function Bento() {
  const spans = ["md:col-span-2", "", "", "md:col-span-2", "md:col-span-4"];
  return (
    <section id="features" className="max-w-[1200px] mx-auto px-4 md:px-6 py-24 scroll-mt-24">
      <motion.p {...fade()} className="text-[11px] uppercase tracking-[0.3em] text-[var(--accent)]">
        Features
      </motion.p>
      <motion.h2 {...fade(0.06)} className="font-display text-[34px] md:text-[56px] leading-tight mt-3 max-w-[760px]">
        Research you can <span className="italic champagne-text">verify.</span>
      </motion.h2>
      <div className="grid md:grid-cols-4 gap-4 mt-10">
        {FEATURES.map((f, i) => {
          const Icon = FEATURE_ICONS[f.key];
          return (
            <motion.div
              key={f.title}
              {...fade(i * 0.06)}
              className={`luxe-card rounded-3xl p-6 group hover:-translate-y-1 hover:border-[var(--accent)]/40 transition-all duration-400 ${spans[i] ?? ""}`}
            >
              <span className="w-10 h-10 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)]/25 grid place-items-center text-[var(--accent)] group-hover:scale-110 transition-transform">
                <Icon size={17} />
              </span>
              <h3 className="font-display text-[20px] mt-4">{f.title}</h3>
              <p className="text-[13.5px] text-[var(--muted)] mt-2 leading-relaxed">{f.body}</p>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-[var(--border)] bg-[var(--background-soft)]/60 scroll-mt-24">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-20">
        <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--accent)]">How it works</p>
        <h2 className="font-display text-[30px] md:text-[44px] mt-3">The ReAct loop, in the open.</h2>
        <p className="mt-3 text-[14px] text-[var(--muted)] max-w-[680px] leading-relaxed">
          LLM (the brain) + agent harness (state, tools, memory, guardrails) + tools (the web) = an autonomous
          research system. Turn on <strong className="text-[var(--foreground)]">Research</strong> in the composer to use it.
        </p>
        <div className="grid md:grid-cols-5 gap-4 mt-10">
          {STEPS.map((s, i) => (
            <motion.div key={s.title} {...fade(i * 0.07)} className="luxe-card rounded-3xl p-5">
              <p className="text-[11px] text-[var(--accent)] font-semibold tabular-nums">0{i + 1}</p>
              <h3 className="font-display text-[19px] mt-1">{s.title}</h3>
              <p className="text-[13px] text-[var(--muted)] mt-2 leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Guardrails() {
  return (
    <section id="guardrails" className="max-w-[1100px] mx-auto px-4 md:px-6 py-20 scroll-mt-24">
      <div className="luxe-card rounded-[26px] p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-8">
        <div className="flex-1">
          <p className="text-[11px] uppercase tracking-[0.3em] text-[var(--accent)]">Guardrails</p>
          <h2 className="font-display text-[28px] md:text-[38px] mt-2">
            Web content is <span className="italic champagne-text">data, never instructions.</span>
          </h2>
          <ul className="mt-5 space-y-2.5 text-[13.5px] text-[var(--foreground-dim)]">
            {GUARDRAILS.map((g) => (
              <li key={g} className="flex gap-2">
                <Check size={15} className="text-[var(--accent)] mt-0.5 shrink-0" />
                {g}
              </li>
            ))}
          </ul>
        </div>
        <Link to="/chat" className="shrink-0">
          <Button size="lg">
            Try a research question <ArrowRight size={16} />
          </Button>
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
        Ask once.
        <br />
        <span className="italic champagne-text">Get answers with evidence.</span>
      </h2>
      <Link to="/chat" className="inline-block mt-9">
        <Button size="lg">
          Open {BRAND} <ArrowUpRight size={16} />
        </Button>
      </Link>
      <footer className="mt-20 pt-8 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-3 text-[12px] text-[var(--muted)]">
        <span className="font-display text-[15px] text-[var(--foreground-dim)]">
          {BRAND} — {TAGLINE}
        </span>
        <span className="text-center md:text-right">
          {CREDIT}
          <br />
          <span className="text-[11px]">{DISCLAIMER}</span>
        </span>
      </footer>
    </section>
  );
}

/** @deprecated renamed to Guardrails */
export const StorageNote = Guardrails;

/**
 * Deprecated stubs — kept so older imports don't break.
 * The landing doesn't render fictional brands, quotes, or pricing.
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
