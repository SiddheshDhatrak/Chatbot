import { cn } from "@/lib/cn";

export function StarMark({ className, size = 36 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="claude-g" x1="0" y1="0" x2="48" y2="48">
          <stop offset="0%" stopColor="#E8D5B5" />
          <stop offset="45%" stopColor="#C9A96A" />
          <stop offset="75%" stopColor="#D97757" />
          <stop offset="100%" stopColor="#C9A96A" />
        </linearGradient>
      </defs>
      {/* Claude-like asterisk bloom */}
      <g fill="url(#claude-g)">
        <path d="M24 4c1.2 7.5 4.2 12.4 8 15.2L44 24l-12 4.8c-3.8 2.8-6.8 7.7-8 15.2-1.2-7.5-4.2-12.4-8-15.2L4 24l12-4.8c3.8-2.8 6.8-7.7 8-15.2Z" />
        <circle cx="24" cy="24" r="3.2" fill="var(--background)" opacity="0.85" />
      </g>
    </svg>
  );
}
