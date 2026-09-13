"use client";
import { useRef, useState, useEffect } from "react";
import { ArrowUp, Square, Plus, Mic, MicOff, X, FileText } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";
import { modelLabel } from "@/lib/models";
import { hasVoiceInput, startDictation } from "@/lib/speech";
import { cn } from "@/lib/cn";

interface Attachment {
  name: string;
  chars: number;
  content: string;
}

const MAX_FILE_CHARS = 8000;
const MAX_TOTAL_CHARS = 20000;
const ACCEPT = ".txt,.md,.markdown,.json,.csv,.ts,.tsx,.js,.jsx,.py,.html,.css,.xml,.yml,.yaml,.log";

function extOf(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? (parts.pop() || "txt").slice(0, 10) : "txt";
}

export function Composer({ onSend }: { onSend: (t: string) => void }) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [listening, setListening] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const isTyping = useChatStore((s) => s.isTyping);
  const model = useChatStore((s) => s.model);
  const stop = useChatStore((s) => s.stop);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef<{ stop: () => void } | null>(null);
  const voiceBase = useRef("");

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 180) + "px";
  }, [value]);

  useEffect(
    () => () => {
      voiceRef.current?.stop();
    },
    [],
  );

  const pickFiles = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setAttachError(null);
    const next: Attachment[] = [...files];
    let total = next.reduce((n, f) => n + f.chars, 0);
    for (const file of Array.from(list).slice(0, 4)) {
      if (file.size > 500_000) {
        setAttachError(`“${file.name}” is too large (max ~500 KB).`);
        continue;
      }
      try {
        const raw = await file.text();
        if (!raw.trim()) {
          setAttachError(`“${file.name}” looks empty — skipped.`);
          continue;
        }
        const sliced = raw.slice(0, MAX_FILE_CHARS);
        if (total + sliced.length > MAX_TOTAL_CHARS) {
          setAttachError("Attachment budget reached (20k chars). Send first, then attach more.");
          break;
        }
        total += sliced.length;
        next.push({ name: file.name, chars: sliced.length, content: sliced });
      } catch {
        setAttachError(`Could not read “${file.name}”. Try a plain-text file.`);
      }
    }
    setFiles(next.slice(0, 4));
  };

  const toggleVoice = () => {
    if (listening) {
      voiceRef.current?.stop();
      setListening(false);
      return;
    }
    voiceBase.current = value;
    const handle = startDictation(
      (text, final) => {
        setValue((voiceBase.current ? voiceBase.current + " " : "") + text);
        if (final) voiceBase.current = (voiceBase.current ? voiceBase.current + " " : "") + text;
      },
      () => setListening(false),
    );
    if (!handle) {
      setAttachError("Voice input isn't supported in this browser — try Chrome or Edge.");
      return;
    }
    voiceRef.current = handle;
    setListening(true);
  };

  const submit = () => {
    if ((!value.trim() && files.length === 0) || isTyping) return;
    const blocks = files.map(
      (f) => `\n\n[Attachment: ${f.name}]\n\`\`\`${extOf(f.name)}\n${f.content}\n\`\`\``,
    );
    onSend((value.trim() + blocks.join("")).trim().slice(0, 24000));
    setValue("");
    setFiles([]);
    setAttachError(null);
    requestAnimationFrame(() => taRef.current?.focus());
  };

  const canSend = (value.trim().length > 0 || files.length > 0) && !isTyping;
  const voiceSupported = hasVoiceInput();

  return (
    <div className="sticky bottom-0 px-4 md:px-6 pb-5 pt-3 bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent">
      <div className="max-w-[800px] mx-auto">
        <div
          className={cn(
            "rounded-[24px] p-2.5 pl-4 transition-all duration-300",
            "bg-[var(--composer)] backdrop-blur-2xl border",
            "border-[var(--border-strong, var(--border))] shadow-[var(--shadow-luxe)]",
            "focus-within:border-[var(--accent)]/60 focus-within:shadow-[0_0_0_4px_var(--ring)]",
          )}
          style={{ borderColor: "var(--border-strong, var(--border))" }}
        >
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 pb-2">
              {files.map((f) => (
                <span
                  key={f.name}
                  className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full text-[12px] bg-[var(--accent-soft)] border border-[var(--accent)]/30 text-[var(--foreground)]"
                >
                  <FileText size={13} className="text-[var(--accent)]" />
                  <span className="max-w-[140px] truncate">{f.name}</span>
                  <span className="text-[var(--muted)]">{(f.chars / 1000).toFixed(1)}k</span>
                  <button
                    onClick={() => setFiles((p) => p.filter((x) => x.name !== f.name))}
                    className="w-5 h-5 rounded-full grid place-items-center hover:bg-[var(--background-elev)]"
                    title={`Remove ${f.name}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder="Message Claude — ask for anything, beautifully…"
            className="w-full bg-transparent resize-none outline-none text-[14.5px] leading-relaxed placeholder:text-[var(--muted)] max-h-[180px] py-2"
          />
          {attachError && (
            <p className="text-[12px] text-amber-500 pb-1" role="alert">
              {attachError}
            </p>
          )}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-1">
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  void pickFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <ComposerIcon title="Attach a text file (txt, md, code — parsed as context)" onClick={() => fileRef.current?.click()}>
                <Plus size={16} />
              </ComposerIcon>
              <ComposerIcon
                title={voiceSupported ? (listening ? "Stop dictation" : "Voice input") : "Voice input not supported in this browser"}
                onClick={toggleVoice}
                active={listening}
                disabled={!voiceSupported}
              >
                {listening ? <MicOff size={15} /> : <Mic size={15} />}
              </ComposerIcon>
              <span className="hidden md:inline ml-2 text-[11px] text-[var(--muted)]">
                {modelLabel(model)} · <kbd className="px-1.5 py-0.5 rounded-md hairline text-[10px]">↵</kbd> send ·{" "}
                <kbd className="px-1.5 py-0.5 rounded-md hairline text-[10px]">⇧↵</kbd> newline
              </span>
            </div>
            {isTyping ? (
              <button
                onClick={stop}
                className="btn-luxe btn-primary-luxe w-10 h-10 !p-0"
                title="Stop generating"
              >
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!canSend}
                className={cn(
                  "btn-luxe w-10 h-10 !p-0 transition-all",
                  canSend ? "btn-primary-luxe" : "bg-[var(--background-elev)] hairline text-[var(--muted)]",
                )}
                title="Send message"
              >
                <ArrowUp size={17} />
              </button>
            )}
          </div>
        </div>
        <p className="text-center text-[11px] text-[var(--muted)] mt-2.5 tracking-wide">
          {listening ? "Listening… speak now." : "Claude may compose imperfectly — please verify precious details."}
        </p>
      </div>
    </div>
  );
}

function ComposerIcon({
  children,
  className,
  active,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        "w-8 h-8 rounded-full grid place-items-center text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--accent-soft)] transition",
        active && "text-red-400 bg-red-500/10 animate-pulse",
        props.disabled && "opacity-35 pointer-events-none",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
