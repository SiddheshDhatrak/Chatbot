import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { MessageSquarePlus, SunMedium, Home, Search } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";
import { toggleTheme } from "@/lib/theme";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const newChat = useChatStore((s) => s.newChat);
  const sessions = useChatStore((s) => s.sessions);
  const selectChat = useChatStore((s) => s.selectChat);

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const custom = () => setOpen(true);
    window.addEventListener("keydown", fn);
    window.addEventListener("claude:palette", custom);
    return () => {
      window.removeEventListener("keydown", fn);
      window.removeEventListener("claude:palette", custom);
    };
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm grid justify-items-center pt-[14vh] px-4"
      onClick={() => setOpen(false)}
    >
      <Command
        label="Command menu"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[560px] luxe-card rounded-2xl overflow-hidden !bg-[var(--background-elev)]"
      >
        <div className="flex items-center gap-2 px-4 border-b border-[var(--border)]">
          <Search size={15} className="text-[var(--muted)]" />
          <Command.Input
            autoFocus
            placeholder="Type a command or search conversations…"
            className="flex-1 bg-transparent outline-none py-3.5 text-[14px] placeholder:text-[var(--muted)]"
          />
          <kbd className="text-[10px] px-1.5 py-1 rounded-md hairline text-[var(--muted)]">esc</kbd>
        </div>
        <Command.List className="max-h-[340px] overflow-auto p-2">
          <Command.Empty className="p-6 text-center text-[13px] text-[var(--muted)] font-display italic text-[16px]">
            Nothing gilded found.
          </Command.Empty>
          <Command.Group heading="Actions" className="text-[11px] uppercase tracking-widest text-[var(--muted)] px-2 py-1">
            <Item
              icon={<MessageSquarePlus size={14} />}
              label="New conversation"
              onSelect={() => {
                const id = newChat();
                setOpen(false);
                navigate(`/chat/${id}`);
              }}
            />
            <Item
              icon={<Home size={14} />}
              label="Go to Maison (landing)"
              onSelect={() => {
                setOpen(false);
                navigate("/");
              }}
            />
            <Item
              icon={<SunMedium size={14} />}
              label="Toggle Noir / Ivory theme"
              onSelect={() => {
                const t = toggleTheme();
                useChatStore.getState().setTheme(t);
                setOpen(false);
              }}
            />
          </Command.Group>
          <Command.Group heading="Recent" className="text-[11px] uppercase tracking-widest text-[var(--muted)] px-2 py-1 mt-2">
            {sessions.slice(0, 6).map((s) => (
              <Item
                key={s.id}
                label={s.title}
                onSelect={() => {
                  selectChat(s.id);
                  setOpen(false);
                  navigate(`/chat/${s.id}`);
                }}
              />
            ))}
          </Command.Group>
        </Command.List>
        <div className="flex items-center gap-3 px-4 py-2.5 border-t border-[var(--border)] text-[11px] text-[var(--muted)]">
          <span><kbd className="px-1 rounded hairline">↑↓</kbd> navigate</span>
          <span><kbd className="px-1 rounded hairline">↵</kbd> select</span>
          <span className="ml-auto font-display italic">maison d’IA</span>
        </div>
      </Command>
    </div>
  );
}

function Item({ icon, label, onSelect }: { icon?: React.ReactNode; label: string; onSelect: () => void }) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13.5px] cursor-pointer text-[var(--foreground-dim)] aria-selected:bg-[var(--accent-soft)] aria-selected:text-[var(--foreground)]"
    >
      {icon && <span className="text-[var(--accent)]">{icon}</span>}
      <span className="truncate">{label}</span>
    </Command.Item>
  );
}
