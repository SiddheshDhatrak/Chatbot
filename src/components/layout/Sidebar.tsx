import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquarePlus,
  Search,
  PanelLeftClose,
  Trash2,
  MessageSquareText,
  Pencil,
} from "lucide-react";
import { useChatStore } from "@/store/useChatStore";
import { StarMark } from "@/components/StarMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/cn";
import { groupLabel, timeAgo } from "@/lib/cn";

export function Sidebar() {
  const sessions = useChatStore((s) => s.sessions);
  const activeId = useChatStore((s) => s.activeId);
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const newChat = useChatStore((s) => s.newChat);
  const selectChat = useChatStore((s) => s.selectChat);
  const deleteChat = useChatStore((s) => s.deleteChat);
  const renameChat = useChatStore((s) => s.renameChat);
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const groups = useMemo(() => {
    const filtered = sessions.filter((s) =>
      s.title.toLowerCase().includes(q.toLowerCase()),
    );
    const map = new Map<string, typeof filtered>();
    for (const s of filtered) {
      const g = groupLabel(s.updatedAt);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(s);
    }
    return [...map.entries()];
  }, [sessions, q]);

  if (!sidebarOpen) return null;

  return (
    <motion.aside
      initial={{ x: -280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -280, opacity: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-[280px] shrink-0 h-full flex flex-col glass !rounded-none !border-y-0 !border-l-0 max-md:fixed max-md:z-40 max-md:h-[100dvh]"
    >
      {/* brand */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <StarMark size={30} />
          <span>
            <span className="font-display text-[19px] leading-none block">Claude</span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
              Maison d’IA
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-9 h-9 rounded-full grid place-items-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition"
            title="Close sidebar"
          >
            <PanelLeftClose size={17} />
          </button>
        </div>
      </div>

      <div className="px-3">
        <button
          onClick={() => {
            const id = newChat();
            navigate(`/chat/${id}`);
          }}
          className="btn-luxe btn-primary-luxe w-full py-2.5 text-sm"
        >
          <MessageSquarePlus size={16} /> New conversation
        </button>
        <div className="mt-3 relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search conversations…"
            className="w-full bg-[var(--background-elev)] hairline rounded-full pl-9 pr-4 py-2 text-[13px] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent)] transition"
          />
        </div>
      </div>

      {/* history */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        <AnimatePresence initial={false}>
          {groups.map(([label, items]) => (
            <div key={label}>
              <p className="px-2 mb-1.5 text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                {label}
              </p>
              <div className="space-y-0.5">
                {items.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      selectChat(s.id);
                      navigate(`/chat/${s.id}`);
                    }}
                    className={cn(
                      "group flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer text-[13.5px] transition-all",
                      s.id === activeId
                        ? "bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[var(--foreground)]"
                        : "border border-transparent text-[var(--foreground-dim)] hover:bg-[var(--background-elev)] hover:text-[var(--foreground)]",
                    )}
                  >
                    <MessageSquareText size={14} className="shrink-0 opacity-60" />
                    <span className="flex-1 truncate">{s.title}</span>
                    <span className="hidden group-hover:flex items-center gap-1">
                      <button
                        title="Rename"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = window.prompt("Rename conversation", s.title);
                          if (next?.trim()) renameChat(s.id, next.trim());
                        }}
                        className="opacity-50 hover:opacity-100"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChat(s.id);
                          if (s.id === activeId) navigate("/chat");
                        }}
                        className="opacity-50 hover:opacity-100 hover:text-red-400"
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  </div>
                ))}
              </div>
              <p className="sr-only">{items[0] ? timeAgo(items[0].updatedAt) : ""}</p>
            </div>
          ))}
        </AnimatePresence>
        {groups.length === 0 && (
          <p className="text-center text-[13px] text-[var(--muted)] pt-10 font-display italic text-[16px]">
            No conversations found.
          </p>
        )}
      </div>

      <div className="p-3 border-t border-[var(--border)]">
        <div className="luxe-card rounded-2xl p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full grid place-items-center font-display text-[15px] text-[var(--accent-ink)] bg-gradient-to-br from-[var(--accent)] to-[var(--brand)]">
            ✦
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate">Local workspace</p>
            <p className="text-[11px] text-[var(--muted)]">SQLite-backed · stored on this machine</p>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}
