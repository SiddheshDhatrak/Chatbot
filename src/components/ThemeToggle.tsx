"use client";
import { useEffect } from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { setTheme } from "@/lib/theme";
import { useChatStore } from "@/store/useChatStore";
import { cn } from "@/lib/cn";

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useChatStore((s) => s.theme);
  const storeSet = useChatStore((s) => s.setTheme);

  useEffect(() => {
    setTheme(theme);
    storeSet(theme);
  }, [theme, storeSet]);

  return (
    <button
      onClick={() => storeSet(theme === "noir" ? "ivory" : "noir")}
      title={theme === "noir" ? "Switch to Ivory Editorial" : "Switch to Noir Opulent"}
      className={cn(
        "relative w-9 h-9 rounded-full hairline glass grid place-items-center overflow-hidden group",
        "hover:border-[var(--accent)] transition-all duration-300",
        className,
      )}
    >
      <span
        className={cn(
          "absolute inset-0 transition-transform duration-500",
          theme === "noir" ? "translate-y-0" : "translate-y-full",
        )}
      >
        <MoonStar size={16} className="m-auto mt-[10px] text-[var(--accent)]" />
      </span>
      <span
        className={cn(
          "absolute inset-0 transition-transform duration-500",
          theme === "ivory" ? "translate-y-0" : "-translate-y-full",
        )}
      >
        <SunMedium size={16} className="m-auto mt-[10px] text-[var(--accent)]" />
      </span>
    </button>
  );
}
