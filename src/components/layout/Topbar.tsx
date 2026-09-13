import { Link } from "react-router-dom";
import { PanelLeftOpen, MoreHorizontal } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ModelPicker } from "@/components/ModelPicker";
import { ShareButton } from "@/components/ShareButton";

export function Topbar({ title }: { title: string }) {
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const activeId = useChatStore((s) => s.activeId);

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
        <ModelPicker />
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
        <ShareButton
          getUrl={() =>
            activeId && !activeId.startsWith("local-")
              ? `${window.location.origin}/chat/${activeId}`
              : null
          }
          disabled={!activeId || activeId.startsWith("local-")}
        />
        <button
          className="w-9 h-9 rounded-full grid place-items-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition"
          title="More actions (⌘K for commands)"
          onClick={() => window.dispatchEvent(new Event("claude:palette"))}
        >
          <MoreHorizontal size={17} />
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
