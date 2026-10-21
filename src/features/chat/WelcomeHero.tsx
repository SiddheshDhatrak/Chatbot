"use client";
import { motion } from "framer-motion";
import { ArrowLeftRight, Clock, Network, Target, Telescope } from "lucide-react";
import { StarMark } from "@/components/StarMark";
import { RESEARCH_EXAMPLES, type ResearchExample } from "@/lib/examples";
import { useChatStore } from "@/store/useChatStore";

const ICONS: Record<ResearchExample["icon"], typeof Network> = {
  hop: Network,
  clock: Clock,
  compare: ArrowLeftRight,
  fact: Target,
};

/**
 * Empty chat state. Picking an example fills the composer and turns Research
 * mode on; the user still presses Send.
 */
export function WelcomeHero() {
  const fillComposer = useChatStore((s) => s.fillComposer);
  const setResearchMode = useChatStore((s) => s.setResearchMode);

  const pick = (q: string) => {
    setResearchMode(true);
    fillComposer(q);
  };

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
        What should we research?
      </motion.h1>
      <motion.p
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.22, duration: 0.6 }}
        className="mt-4 text-[14.5px] text-[var(--muted)] max-w-[560px] mx-auto leading-relaxed"
      >
        In <span className="inline-flex items-center gap-1 text-[var(--accent)] font-medium"><Telescope size={13} />Research</span> mode
        NEXORA searches the web, reads the pages, saves notes and answers with checked citations. Pick an
        example to load it, or ask your own question.
      </motion.p>

      <div className="grid sm:grid-cols-2 gap-3 mt-8 text-left">
        {RESEARCH_EXAMPLES.map((ex, i) => {
          const Icon = ICONS[ex.icon];
          return (
            <motion.button
              key={ex.question}
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => pick(ex.question)}
              title="Load into the composer with Research mode on"
              className="luxe-card rounded-2xl p-4 group text-left hover:border-[var(--accent)]/50 hover:-translate-y-0.5 transition-all duration-300"
            >
              <span className="flex items-center gap-2 mb-2.5">
                <span className="w-8 h-8 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)]/25 grid place-items-center text-[var(--accent)] group-hover:scale-110 transition-transform">
                  <Icon size={15} />
                </span>
                <span className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">{ex.kind}</span>
              </span>
              <span className="block text-[13.5px] leading-relaxed text-[var(--foreground)]">{ex.question}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
