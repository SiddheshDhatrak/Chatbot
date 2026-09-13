import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Code2,
  Eye,
  Layers,
  MemoryStick,
  Sparkles,
  Check,
  Star,
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
            {["Atelier", "Artifacts", "Mémoire", "Tarifs"].map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} className="hover:text-[var(--foreground)] transition">
                {l}
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
        Claude Opus 4.5 — now composing in the salon
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
        The AI companion for those who notice everything — reasoning, writing and code,
        presented in an interface worthy of your finest hours.
      </motion.p>
      <motion.div {...fade(0.24)} className="mt-9 flex items-center justify-center gap-3 flex-wrap">
        <Link to="/chat">
          <Button size="lg">Begin composing <ArrowRight size={16} /></Button>
        </Link>
        <a href="#atelier">
          <Button size="lg" variant="outline">Visit the atelier</Button>
        </a>
      </motion.div>

      {/* product frame */}
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
                ● live
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
                  {["Maison header", "Curated list", "Gilded footer"].map((r) => (
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

export function LogoMarquee() {
  const names = ["MAISON NOIR", "Atelier Cinq", "VELOURS", "Opéra Privé", "GILDED & CO", "Salon Sept"];
  return (
    <section className="py-10 border-y border-[var(--border)] overflow-hidden">
      <p className="text-center text-[11px] uppercase tracking-[0.3em] text-[var(--muted)] mb-6">
        Adored by discerning teams
      </p>
      <div className="flex gap-12 justify-center flex-wrap px-6">
        {names.map((n) => (
          <span key={n} className="font-display text-[19px] text-[var(--muted)] hover:text-[var(--foreground)] transition tracking-wide">
            {n}
          </span>
        ))}
      </div>
    </section>
  );
}

export function Bento() {
  const cards = [
    { icon: Code2, title: "Artifacts, atelier-grade", body: "Code, documents and designs open beside the conversation — versioned, downloadable, exquisite.", span: "md:col-span-2" },
    { icon: MemoryStick, title: "Mémoire", body: "Claude remembers your taste, your tone, your canon." },
    { icon: Eye, title: "Vision", body: "Drop in a façade, a gown, a graph — Claude reads it like a critic." },
    { icon: Layers, title: "Projects", body: "Wardrobes of knowledge, tailored per maison." },
    { icon: Sparkles, title: "Opus reasoning", body: "Slow where it matters. Decisive where it counts.", span: "md:col-span-2" },
  ];
  return (
    <section id="atelier" className="max-w-[1200px] mx-auto px-4 md:px-6 py-24">
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

export function Pricing() {
  const tiers = [
    { name: "Flâneur", price: "Free", feats: ["Claude Sonnet access", "10 artifacts / mo", "Community salon"], cta: "Stroll in", hot: false },
    { name: "Connoisseur", price: "$20", feats: ["Claude Opus 4.5 priority", "Unlimited artifacts", "Projects + mémoire", "Early atelier previews"], cta: "Join the salon", hot: true },
    { name: "Maison", price: "Custom", feats: ["SSO & audit trails", "Private atelier cloud", "Dedicated couturier (CSM)"], cta: "Speak with us", hot: false },
  ];
  return (
    <section id="tarifs" className="max-w-[1100px] mx-auto px-4 md:px-6 py-24">
      <h2 className="font-display text-[34px] md:text-[52px] text-center">Choose your <span className="italic champagne-text">salon.</span></h2>
      <div className="grid md:grid-cols-3 gap-5 mt-12">
        {tiers.map((t, i) => (
          <motion.div key={t.name} {...fade(i * 0.08)} className={`rounded-[26px] p-7 relative ${t.hot ? "luxe-card border !border-[var(--accent)]/50 scale-[1.03]" : "hairline bg-[var(--background-soft)]"}`}>
            {t.hot && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-[0.2em] px-3 py-1 rounded-full btn-primary-luxe btn-luxe">
                Most coveted
              </span>
            )}
            <p className="font-display text-[22px]">{t.name}</p>
            <p className="mt-2"><span className="font-display text-[40px]">{t.price}</span>{t.price.startsWith("$") && <span className="text-[var(--muted)] text-[13px]"> / month</span>}</p>
            <ul className="mt-5 space-y-2.5 text-[13.5px] text-[var(--foreground-dim)]">
              {t.feats.map((f) => (
                <li key={f} className="flex gap-2"><Check size={15} className="text-[var(--accent)] mt-0.5 shrink-0" />{f}</li>
              ))}
            </ul>
            <Link to="/chat" className="block mt-7">
              <Button variant={t.hot ? "primary" : "outline"} size="md" className="w-full">{t.cta}</Button>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

export function Testimonials() {
  const quotes = [
    { q: "It writes like my best editor and codes like my best engineer.", a: "Creative Director, Velours" },
    { q: "The first AI that feels furnished. Every pixel earns its place.", a: "Founder, Opéra Privé" },
    { q: "Artifacts replaced three tools in our maison.", a: "CTO, Gilded & Co" },
  ];
  return (
    <section className="border-y border-[var(--border)] bg-[var(--background-soft)]/60">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-20 grid md:grid-cols-3 gap-6">
        {quotes.map((t, i) => (
          <motion.figure key={i} {...fade(i * 0.07)}>
            <div className="flex gap-1 text-[var(--accent)] mb-4">
              {Array.from({ length: 5 }).map((_, s) => (<Star key={s} size={13} fill="currentColor" />))}
            </div>
            <blockquote className="font-display text-[20px] leading-snug italic">“{t.q}”</blockquote>
            <figcaption className="mt-4 text-[12px] uppercase tracking-[0.18em] text-[var(--muted)]">{t.a}</figcaption>
          </motion.figure>
        ))}
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
        <span>Crafted with restraint · Noir & Ivory editions</span>
      </footer>
    </section>
  );
}
