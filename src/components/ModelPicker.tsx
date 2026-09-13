"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { AVAILABLE_MODELS, getModel, modelLabel } from "@/lib/models";
import { useChatStore } from "@/store/useChatStore";
import { cn } from "@/lib/cn";

export function ModelPicker({ className }: { className?: string }) {
  const storeModel = useChatStore((s) => s.model);
  const setModel = useChatStore((s) => s.setModel);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // hydrate from localStorage on mount (persist may lag)
    try {
      const saved = getModel();
      if (saved && saved !== useChatStore.getState().model) {
        useChatStore.getState().setModel(saved);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", fn);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", fn);
      window.removeEventListener("keydown", esc);
    };
  }, []);

  const current = storeModel || getModel();

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Choose model"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hairline bg-[var(--background-elev)] text-[13px] font-medium hover:border-[var(--accent)] transition"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden />
        {modelLabel(current)}
        <ChevronDown size={14} className={cn("opacity-60 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute top-full mt-2 left-0 min-w-[230px] z-50 luxe-card rounded-2xl p-1.5 !bg-[var(--background-elev)]"
        >
          {AVAILABLE_MODELS.map((m) => (
            <button
              key={m.id}
              role="option"
              aria-selected={m.id === current}
              onClick={() => {
                setModel(m.id);
                setOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-[13px] transition",
                m.id === current
                  ? "bg-[var(--accent-soft)] text-[var(--foreground)]"
                  : "text-[var(--foreground-dim)] hover:bg-[var(--accent-soft)]/60 hover:text-[var(--foreground)]",
              )}
            >
              <span className="flex-1 min-w-0">
                <span className="block font-medium truncate">{m.label}</span>
                <span className="block text-[11px] text-[var(--muted)] truncate font-mono">{m.id} · {m.hint}</span>
              </span>
              {m.id === current && <Check size={14} className="text-[var(--accent)] shrink-0" />}
            </button>
          ))}
          <p className="px-3 py-2 text-[11px] text-[var(--muted)]">Sent with each request · stored locally</p>
        </div>
      )}
    </div>
  );
}
