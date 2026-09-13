"use client";
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Copy, Check, RotateCcw, Volume2, ThumbsUp, ThumbsDown } from "lucide-react";
import { useState } from "react";
import type { Message } from "@/store/useChatStore";
import { StarMark } from "@/components/StarMark";
import { Markdown } from "@/components/ui/Markdown";
import { cn } from "@/lib/cn";

export function MessageList({ messages }: { messages: Message[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastMessageText = messages[messages.length - 1]?.text.slice(-40);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, lastMessageText]);

  return (
    <div className="max-w-[800px] mx-auto w-full px-4 md:px-6 py-6 space-y-7">
      {messages.map((m) =>
        m.role === "user" ? (
          <UserBubble key={m.id} message={m} />
        ) : (
          <AssistantRow key={m.id} message={m} />
        ),
      )}
      <div ref={endRef} className="h-2" />
    </div>
  );
}

function UserBubble({ message }: { message: Message }) {
  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex justify-end"
    >
      <div
        className="max-w-[82%] md:max-w-[72%] px-5 py-3.5 rounded-[20px] rounded-br-[8px] text-[14.5px] leading-relaxed whitespace-pre-wrap"
        style={{ background: "var(--user-bubble)", color: "var(--user-ink)" }}
      >
        {message.text}
      </div>
    </motion.div>
  );
}

function AssistantRow({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);

  // thinking shimmer when empty + streaming
  if (!message.text) {
    return (
      <div className="flex gap-3.5">
        <StarMark size={30} className="mt-0.5" />
        <div className="flex items-center gap-1.5 pt-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-pulse"
              style={{ animationDelay: `${i * 0.22}s` }}
            />
          ))}
          <span className="ml-2 text-[12px] uppercase tracking-[0.2em] text-[var(--muted)]">
            Composing
          </span>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex gap-3.5 group"
    >
      <StarMark size={30} className="mt-1 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-[0.22em] text-[var(--muted)] mb-1.5">
          Claude
        </p>
        <Markdown text={message.text} streaming={message.streaming} />
        {!message.streaming && (
          <div className="flex items-center gap-1 mt-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <ActionBtn
              title="Copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(message.text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1400);
                } catch {}
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </ActionBtn>
            <ActionBtn title="Read aloud">
              <Volume2 size={13} />
            </ActionBtn>
            <ActionBtn title="Good response">
              <ThumbsUp size={13} />
            </ActionBtn>
            <ActionBtn title="Poor response">
              <ThumbsDown size={13} />
            </ActionBtn>
            <ActionBtn title="Retry" className="gap-1.5 !px-2.5">
              <RotateCcw size={13} /> <span className="text-[12px]">Retry</span>
            </ActionBtn>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ActionBtn({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "h-7 min-w-7 px-1.5 rounded-lg grid place-items-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
