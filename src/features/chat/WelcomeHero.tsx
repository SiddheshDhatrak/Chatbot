"use client";
import { motion } from "framer-motion";
import { PenLine, Sparkles, Code2, Map } from "lucide-react";
import { StarMark } from "@/components/StarMark";
import { PROMPT_GALLERY } from "@/lib/mock";

const ICONS: Record<string, typeof PenLine> = {
  pen: PenLine,
  sparkles: Sparkles,
  code: Code2,
  map: Map,
};

export function WelcomeHero({ onPick }: { onPick: (prompt: string) => void }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="max-w-[760px] mx-auto w-full text-center pt-10 md:pt-16 pb-8 px-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="mx-auto w-fit relative"
      >
        <div className="absolute inset-0 blur-3xl bg-[var(--accent)]/25 rounded-full scale-150" />
        <StarMark size={72} className="relative" />
      </motion.div>
      <motion.h1
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="font-display text-[34px] md:text-[52px] leading-[1.05] mt-6"
      >
        {greeting}. <br />
        <span className="italic champagne-text">How shall we create today?</span>
      </motion.h1>
      <motion.p
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.22, duration: 0.6 }}
        className="mt-4 text-[14.5px] text-[var(--muted)] max-w-[520px] mx-auto leading-relaxed"
      >
        Claude composes, codes, reasons and refines — in a salon crafted for deep work.
        Choose a prelude below, or write your own overture.
      </motion.p>

      <div className="grid sm:grid-cols-2 gap-3 mt-8 text-left">
        {PROMPT_GALLERY.map((p, i) => {
          const Icon = ICONS[p.icon] ?? Sparkles;
          return (
            <motion.button
              key={p.title}
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => onPick(p.prompt)}
              className="luxe-card rounded-2xl p-4 group text-left hover:border-[var(--accent)]/50 hover:-translate-y-0.5 transition-all duration-300"
            >
              <span className="w-8 h-8 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)]/25 grid place-items-center text-[var(--accent)] mb-3 group-hover:scale-110 transition-transform">
                <Icon size={15} />
              </span>
              <span className="block text-[14px] font-medium">{p.title}</span>
              <span className="block text-[12.5px] text-[var(--muted)] mt-1 line-clamp-2 leading-relaxed">
                {p.prompt}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
