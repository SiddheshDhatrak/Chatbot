import { Link } from "react-router-dom";
import { PanelLeftOpen, Share, MoreHorizontal, ChevronDown } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";
import { ThemeToggle } from "@/components/ThemeToggle";

const MODELS = ["Claude Opus 4.5", "Claude Sonnet 4.5", "Claude Haiku 4"];

export function Topbar({ title }: { title: string }) {
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);

  return (
    <header className="h-[60px] shrink-0 flex items-center justify-between px-4 md:px-6 border-b border-[var(--border)] glass !border-x-0 !border-t-0 z-20">
      <div className="flex items-center gap-2 min-w-0">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-9 h-9 rounded-full grid place-items-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition"
            title="Open sidebar"
          >
            <PanelLeftOpen size={17} />
          </button>
        )}
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hairline bg-[var(--background-elev)] text-[13px] font-medium hover:border-[var(--accent)] transition">
          {MODELS[0]} <ChevronDown size={14} className="opacity-60" />
        </button>
        <span className="hidden lg:block text-[13px] text-[var(--muted)] truncate max-w-[280px] ml-2">
          {title}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Link
          to="/"
          className="hidden sm:inline-flex text-[13px] text-[var(--muted)] hover:text-[var(--foreground)] px-3 py-2 transition"
        >
          Maison
        </Link>
        <button className="btn-luxe px-4 py-2 text-[13px] hairline hidden sm:inline-flex hover:bg-[var(--accent-soft)]">
          <Share size={14} /> Share
        </button>
        <button className="w-9 h-9 rounded-full grid place-items-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition">
          <MoreHorizontal size={17} />
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
