"use client";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Download, Eye, Code2 } from "lucide-react";
import { useState } from "react";
import { useChatStore } from "@/store/useChatStore";

export function ArtifactPanel() {
  const artifact = useChatStore((s) => s.artifact);
  const open = useChatStore((s) => s.artifactOpen);
  const setOpen = useChatStore((s) => s.setArtifactOpen);
  const [tab, setTab] = useState<"code" | "preview">("code");
  const [copied, setCopied] = useState(false);

  return (
    <AnimatePresence>
      {open && artifact && (
        <motion.aside
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-[420px] max-w-[92vw] shrink-0 h-full border-l border-[var(--border)] bg-[var(--background-soft)] flex flex-col max-lg:fixed max-lg:right-0 max-lg:z-40 max-lg:h-[100dvh] max-lg:shadow-[var(--shadow-luxe)]"
        >
          <div className="h-[60px] flex items-center justify-between px-4 border-b border-[var(--border)]">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">Artifact</p>
              <p className="text-[14px] font-medium truncate">{artifact.title}</p>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex p-0.5 rounded-full hairline bg-[var(--background-elev)] text-[12px]">
                <button
                  onClick={() => setTab("code")}
                  className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition ${tab === "code" ? "bg-[var(--accent-soft)] text-[var(--foreground)]" : "text-[var(--muted)]"}`}
                >
                  <Code2 size={13} /> Code
                </button>
                <button
                  onClick={() => setTab("preview")}
                  className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 transition ${tab === "preview" ? "bg-[var(--accent-soft)] text-[var(--foreground)]" : "text-[var(--muted)]"}`}
                >
                  <Eye size={13} /> Preview
                </button>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-full grid place-items-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border)]">
            <span className="text-[11px] px-2 py-1 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[var(--accent)] uppercase tracking-widest">
              {artifact.language}
            </span>
            <span className="text-[12px] text-[var(--muted)]">v3 · tailored just now</span>
            <span className="flex-1" />
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(artifact.code);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1400);
                } catch {}
              }}
              className="w-8 h-8 rounded-full grid place-items-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition"
              title="Copy artifact"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
            <button
              onClick={() => {
                const blob = new Blob([artifact.code], { type: "text/plain" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = artifact.title.replace(/\s+/g, "-").toLowerCase();
                a.click();
              }}
              className="w-8 h-8 rounded-full grid place-items-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition"
              title="Download"
            >
              <Download size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-4">
            {tab === "code" ? (
              <pre className="text-[12.5px] leading-relaxed font-mono p-4 rounded-2xl overflow-x-auto border border-[var(--border)] bg-[var(--code-bg)] text-[var(--ivory-100,#f5f1e8)]">
                <code>{artifact.code}</code>
              </pre>
            ) : (
              <div className="luxe-card rounded-2xl p-6 text-center">
                <p className="font-display text-[22px] italic">Live preview</p>
                <p className="text-[13px] text-[var(--muted)] mt-2 leading-relaxed">
                  A rendered salon preview of <b>{artifact.title}</b> would atelier here —
                  interactive, responsive, gilded.
                </p>
                <div className="mt-5 space-y-2 text-left">
                  {[ "Maison header", "Curated list", "Gilded footer" ].map((row) => (
                    <div key={row} className="h-10 rounded-xl bg-[var(--accent-soft)] border border-[var(--accent)]/20 grid place-items-center text-[12px] text-[var(--muted)]">
                      {row}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
