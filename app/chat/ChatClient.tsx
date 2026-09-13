"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  MessageSquarePlus,
  Search,
  Trash2,
  MessageSquareText,
  Pencil,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useChatStore } from "@/store/useChatStore";
import { getTheme } from "@/lib/theme";
import { StarMark } from "@/components/StarMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WelcomeHero } from "@/features/chat/WelcomeHero";
import { MessageList } from "@/features/chat/MessageList";
import { Composer } from "@/features/chat/Composer";
import { ArtifactPanel } from "@/features/chat/ArtifactPanel";
import { cn, groupLabel } from "@/lib/cn";

const MODEL_LABEL = "Groq · Llama 3.3 70B";

export default function ChatClient({ sessionId }: { sessionId?: string }) {
  const router = useRouter();
  const sessions = useChatStore((s) => s.sessions);
  const activeId = useChatStore((s) => s.activeId);
  const sidebarOpen = useChatStore((s) => s.sidebarOpen);
  const setSidebarOpen = useChatStore((s) => s.setSidebarOpen);
  const newChat = useChatStore((s) => s.newChat);
  const selectChat = useChatStore((s) => s.selectChat);
  const deleteChat = useChatStore((s) => s.deleteChat);
  const renameChat = useChatStore((s) => s.renameChat);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const send = useChatStore((s) => s.send);
  const [q, setQ] = useState("");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", getTheme());
    void loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sessionId) void selectChat(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const active = sessions.find((s) => s.id === (sessionId ?? activeId));
  const messages = active?.messages ?? [];

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

  const handleSend = async (text: string) => {
    await send(text);
    const current = useChatStore.getState().activeId;
    if (current && current !== sessionId) router.replace(`/chat/${current}`);
  };

  return (
    <div className="h-[100dvh] flex overflow-hidden">
      {sidebarOpen && (
        <motion.aside
          initial={{ x: -280, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-[280px] shrink-0 h-full flex flex-col glass !rounded-none !border-y-0 !border-l-0 max-md:fixed max-md:z-40 max-md:h-[100dvh]"
        >
          <div className="px-4 pt-5 pb-3 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <StarMark size={30} />
              <span>
                <span className="font-display text-[19px] leading-none block">Claude</span>
                <span className="text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]">
                  Maison d&rsquo;IA
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
                newChat();
                router.push("/chat");
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

          <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
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
                        void selectChat(s.id);
                        router.push(`/chat/${s.id}`);
                      }}
                      className={cn(
                        "group flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer text-[13.5px] transition-all",
                        s.id === (sessionId ?? activeId)
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
                            if (s.id === (sessionId ?? activeId)) router.push("/chat");
                          }}
                          className="opacity-50 hover:opacity-100 hover:text-red-400"
                        >
                          <Trash2 size={12} />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <p className="text-center text-[13px] text-[var(--muted)] pt-10 font-display italic text-[16px]">
                No conversations found.
              </p>
            )}
          </div>
        </motion.aside>
      )}

      <div className="flex-1 min-w-0 flex flex-col relative">
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
            <span className="px-3 py-1.5 rounded-full hairline bg-[var(--background-elev)] text-[13px] font-medium">
              {MODEL_LABEL}
            </span>
            <span className="hidden lg:block text-[13px] text-[var(--muted)] truncate max-w-[280px] ml-2">
              {active?.title ?? "New conversation"}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Link
              href="/"
              className="hidden sm:inline-flex text-[13px] text-[var(--muted)] hover:text-[var(--foreground)] px-3 py-2 transition"
            >
              Maison
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <div className="flex-1 flex min-h-0">
          <div className="flex-1 min-w-0 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto">
              {messages.length === 0 ? (
                <WelcomeHero onPick={handleSend} />
              ) : (
                <MessageList messages={messages} />
              )}
            </div>
            <Composer onSend={handleSend} />
          </div>
          <ArtifactPanel />
        </div>
      </div>
    </div>
  );
}
