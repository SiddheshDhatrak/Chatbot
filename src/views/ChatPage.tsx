import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Topbar } from "@/components/layout/Topbar";
import { WelcomeHero } from "@/features/chat/WelcomeHero";
import { MessageList } from "@/features/chat/MessageList";
import { Composer } from "@/features/chat/Composer";
import { ArtifactPanel } from "@/features/chat/ArtifactPanel";
import { CommandPalette } from "@/features/chat/CommandPalette";
import { useChatStore } from "@/store/useChatStore";

export default function ChatPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const sessions = useChatStore((s) => s.sessions);
  const activeId = useChatStore((s) => s.activeId);
  const selectChat = useChatStore((s) => s.selectChat);
  const send = useChatStore((s) => s.send);

  useEffect(() => {
    if (id) {
      const exists = sessions.some((s) => s.id === id);
      if (exists) void selectChat(id);
      else navigate("/chat", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const active = sessions.find((s) => s.id === (id ?? activeId));
  const messages = active?.messages ?? [];

  const handleSend = async (text: string) => {
    await send(text);
    const current = useChatStore.getState().activeId;
    if (current && current !== id) navigate(`/chat/${current}`, { replace: true });
  };

  return (
    <AppShell>
      <Topbar title={active?.title ?? "New conversation"} />
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
      <CommandPalette />
    </AppShell>
  );
}
