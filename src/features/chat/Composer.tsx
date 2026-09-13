"use client";
import { useRef, useState, useEffect } from "react";
import { ArrowUp, Square, Plus, Mic, SlidersHorizontal } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";
import { cn } from "@/lib/cn";

export function Composer({ onSend }: { onSend: (t: string) => void }) {
  const [value, setValue] = useState("");
  const isTyping = useChatStore((s) => s.isTyping);
  const stop = useChatStore((s) => s.stop);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, [value]);

  const submit = () => {
    if (!value.trim() || isTyping) return;
    onSend(value);
    setValue("");
    requestAnimationFrame(() => taRef.current?.focus());
  };

  return (
    <div className="sticky bottom-0 px-4 md:px-6 pb-5 pt-3 bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent">
      <div className="max-w-[800px] mx-auto">
        <div
          className={cn(
            "rounded-[24px] p-2.5 pl-4 transition-all duration-300",
            "bg-[var(--composer)] backdrop-blur-2xl border",
            "border-[var(--border-strong, var(--border))] shadow-[var(--shadow-luxe)]",
            "focus-within:border-[var(--accent)]/60 focus-within:shadow-[0_0_0_4px_var(--ring)]",
          )}
          style={{ borderColor: "var(--border-strong, var(--border))" }}
        >
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Message Claude — ask for anything, beautifully…"
            className="w-full bg-transparent resize-none outline-none text-[14.5px] leading-relaxed placeholder:text-[var(--muted)] max-h-[180px] py-2"
          />
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1">
              <ComposerIcon title="Attach">
                <Plus size={16} />
              </ComposerIcon>
              <ComposerIcon title="Voice input">
                <Mic size={15} />
              </ComposerIcon>
              <ComposerIcon title="Tools & tone" className="hidden sm:grid">
                <SlidersHorizontal size={15} />
              </ComposerIcon>
              <span className="hidden md:inline ml-2 text-[11px] text-[var(--muted)]">
                Opus 4.5 · <kbd className="px-1.5 py-0.5 rounded-md hairline text-[10px]">↵</kbd> send ·{" "}
                <kbd className="px-1.5 py-0.5 rounded-md hairline text-[10px]">⇧↵</kbd> newline
              </span>
            </div>
            {isTyping ? (
              <button
                onClick={stop}
                className="btn-luxe btn-primary-luxe w-10 h-10 !p-0"
                title="Stop generating"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!value.trim()}
                className={cn(
                  "btn-luxe w-10 h-10 !p-0 transition-all",
                  value.trim() ? "btn-primary-luxe" : "bg-[var(--background-elev)] hairline text-[var(--muted)]",
                )}
                title="Send message"
              >
                <ArrowUp size={17} />
              </button>
            )}
          </div>
        </div>
        <p className="text-center text-[11px] text-[var(--muted)] mt-2.5 tracking-wide">
          Claude may compose imperfectly — please verify precious details.
        </p>
      </div>
    </div>
  );
}

function ComposerIcon({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "w-8 h-8 rounded-full grid place-items-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
