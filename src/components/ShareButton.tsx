"use client";
import { useState } from "react";
import { Share, Check, Link2 } from "lucide-react";
import { copyText } from "@/lib/speech";
import { cn } from "@/lib/cn";

export function ShareButton({
  getUrl,
  disabled,
  className,
  variant = "pill",
}: {
  getUrl: () => string | null;
  disabled?: boolean;
  className?: string;
  variant?: "pill" | "icon";
}) {
  const [state, setState] = useState<"idle" | "ok" | "fail">("idle");

  const onShare = async () => {
    const url = getUrl();
    if (!url) {
      setState("fail");
      setTimeout(() => setState("idle"), 1600);
      return;
    }
    // Prefer native share sheet on mobile, fall back to copy-link.
    try {
      const nav = navigator as Navigator & { share?: (d: { title?: string; url: string }) => Promise<void> };
      if (nav.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await nav.share({ title: "Claude conversation", url });
        return;
      }
    } catch {
      /* user cancelled — don't show an error */
      return;
    }
    const ok = await copyText(url);
    setState(ok ? "ok" : "fail");
    setTimeout(() => setState("idle"), 1600);
  };

  if (variant === "icon") {
    return (
      <button
        onClick={onShare}
        disabled={disabled}
        title={state === "ok" ? "Link copied" : "Copy link to this conversation"}
        className={cn(
          "w-9 h-9 rounded-full grid place-items-center transition",
          "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)]",
          state === "ok" && "text-[var(--accent)]",
          className,
        )}
      >
        {state === "ok" ? <Check size={16} /> : <Link2 size={16} />}
      </button>
    );
  }

  return (
    <button
      onClick={onShare}
      disabled={disabled}
      title="Copy link to this conversation"
      className={cn(
        "btn-luxe px-4 py-2 text-[13px] hairline hidden sm:inline-flex hover:bg-[var(--accent-soft)]",
        state === "ok" && "border-[var(--accent)]/60 text-[var(--accent)]",
        className,
      )}
    >
      {state === "ok" ? <Check size={14} /> : <Share size={14} />}
      {state === "ok" ? "Copied" : state === "fail" ? "Copy failed" : "Share"}
    </button>
  );
}
