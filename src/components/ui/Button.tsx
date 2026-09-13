import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "outline" | "subtle";
type Size = "sm" | "md" | "lg" | "icon";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "btn-luxe",
        size === "sm" && "px-4 py-1.5 text-[13px]",
        size === "md" && "px-5 py-2.5 text-sm",
        size === "lg" && "px-7 py-3.5 text-[15px]",
        size === "icon" && "w-9 h-9 !p-0",
        variant === "primary" && "btn-primary-luxe",
        variant === "ghost" && "text-[var(--foreground-dim)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)]",
        variant === "outline" && "hairline text-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]",
        variant === "subtle" && "bg-[var(--background-elev)] hairline text-[var(--foreground)] hover:bg-[var(--accent-soft)]",
        props.disabled && "opacity-50 pointer-events-none",
        className,
      )}
      {...props}
    />
  );
}
