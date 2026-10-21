import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * NEXORA brand mark: an "N" monogram with an evidence dot (same design as
 * the favicon in public/nexora-mark.svg). Kept under the StarMark name so
 * existing imports keep working.
 */
export function StarMark({ className, size = 36 }: { className?: string; size?: number }) {
  const gid = `nexora-mark-${useId().replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn("shrink-0", className)} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="48" y2="48">
          <stop offset="0%" stopColor="#E8D5B5" />
          <stop offset="55%" stopColor="#C9A96A" />
          <stop offset="100%" stopColor="#5FA8A0" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="var(--background-elev, #0E1416)" stroke="var(--border-strong, rgba(255,255,255,.14))" />
      <path d="M14 35V13h4.6l10.8 14.4V13H34v22h-4.6L18.6 20.6V35z" fill={`url(#${gid})`} />
      <circle cx="37.5" cy="36.5" r="3" fill="#5FA8A0" />
    </svg>
  );
}
