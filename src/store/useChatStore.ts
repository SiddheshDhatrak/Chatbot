import "@/lib/storageKeys"; // renames old "claude-*" storage keys before persist reads them
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Theme } from "@/lib/theme";
import { getModel, setStoredModel } from "@/lib/models";
import {
  chatEvents,
  listSessions,
  getSession,
  renameSession,
  deleteSession,
} from "@/lib/api";
import { applyAgentEvent, newResearchView, type ResearchView } from "@/lib/research";
import { throttle, type Throttled } from "@/lib/throttle";
import { withStoppedMarker } from "@/lib/chatMarkers";

export type Role = "user" | "assistant";
export interface Message {
  id: string;
  role: Role;
  text: string;
  createdAt: number;
  streaming?: boolean;
  /** NEXORA: live trace, sources and metrics for a research answer. */
  research?: ResearchView;
  /** NEXORA: run that produced this answer (from the DB). */
  runId?: string | null;
}

const RESEARCH_STOPPED = "Research stopped before an answer was produced.";
export interface Session {
  id: string;
  title: string;
  updatedAt: number;
  messages: Message[];
  /** NEXORA: session contains research runs (sidebar icon). */
  hasResearch?: boolean;
}
export interface Artifact {
  title: string;
  language: string;
  code: string;
}

interface ChatState {
  sessions: Session[];
  activeId: string | null;
  isTyping: boolean;
  streamingId: string | null;
  artifact: Artifact | null;
  artifactOpen: boolean;
  sidebarOpen: boolean;
  theme: Theme;
  model: string;
  abortFlag: boolean;
  /** NEXORA: send messages to the research agent instead of plain chat. */
  researchMode: boolean;

  setResearchMode: (v: boolean) => void;
  setTheme: (t: Theme) => void;
  setModel: (m: string) => void;
  setSidebarOpen: (v: boolean) => void;
  setArtifactOpen: (v: boolean) => void;
  newChat: () => string;
  selectChat: (id: string) => Promise<void>;
  deleteChat: (id: string) => void;
  renameChat: (id: string, title: string) => void;
  loadSessions: () => Promise<void>;
  send: (text: string) => Promise<void>;
  stop: () => void;
  regenerate: () => Promise<void>;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const isTempId = (id: string | null) => !id || id.startsWith("local-");

/** In-flight fetch aborter for the active stream. */
let aborter: AbortController | null = null;
/** Throttled renderer of the active stream (cancelled on Stop). */
let streamRender: Throttled | null = null;

function titleFrom(text: string) {
  const t = text.replace(/[#*`>\n]/g, " ").trim().slice(0, 42);
  return t.length < text.trim().length ? `${t}…` : t || "New conversation";
}

/** Pull the first fenced code block out of a reply for the artifact panel. */
function extractArtifact(text: string): Artifact | null {
  const m = text.match(/```(\w*)\n([\s\S]*?)```/);
  if (!m) return null;
  const language = (m[1] || "text").slice(0, 20);
  const code = m[2]!.trim();
  if (code.length < 20) return null;
  return { title: `Artifact.${language}`, language, code };
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeId: null,
      isTyping: false,
      streamingId: null,
      artifact: null,
      artifactOpen: false,
      sidebarOpen: true,
      theme: "noir",
      model: typeof window !== "undefined" ? getModel() : "openai/gpt-oss-120b",
      abortFlag: false,
      researchMode: false,

      setResearchMode: (v) => set({ researchMode: v }),
      setTheme: (t) => set({ theme: t }),
      setModel: (m) => {
        setStoredModel(m);
        set({ model: m });
      },
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      setArtifactOpen: (v) => set({ artifactOpen: v }),

      newChat: () => {
        aborter?.abort();
        const id = `local-${uid()}`;
        const s: Session = {
          id,
          title: "New conversation",
          updatedAt: Date.now(),
          messages: [],
        };
        set((st) => ({
          sessions: [s, ...st.sessions],
          activeId: id,
          artifact: null,
          artifactOpen: false,
          isTyping: false,
          streamingId: null,
        }));
        return id;
      },

      selectChat: async (id) => {
        aborter?.abort();
        set({ activeId: id, artifactOpen: false, isTyping: false, streamingId: null });
        const s = get().sessions.find((x) => x.id === id);
        if (!s || isTempId(id) || s.messages.length > 0 || get().isTyping) return;
        try {
          const full = await getSession(id);
          if (get().activeId !== id) return;
          set((st) => ({
            sessions: st.sessions.map((x) =>
              x.id === id
                ? {
                    ...x,
                    title: full.title,
                    updatedAt: full.updatedAt,
                    messages: full.messages,
                  }
                : x,
            ),
          }));
        } catch (err) {
          console.error("[store] load session failed:", err);
        }
      },

      deleteChat: (id) => {
        if (get().activeId === id) aborter?.abort();
        set((st) => ({
          sessions: st.sessions.filter((s) => s.id !== id),
          activeId: st.activeId === id ? null : st.activeId,
          isTyping: st.activeId === id ? false : st.isTyping,
          streamingId: st.activeId === id ? null : st.streamingId,
        }));
        if (!isTempId(id)) deleteSession(id).catch((e) => console.error("[store] delete failed:", e));
      },

      renameChat: (id, title) => {
        set((st) => ({
          sessions: st.sessions.map((s) => (s.id === id ? { ...s, title } : s)),
        }));
        if (!isTempId(id)) renameSession(id, title).catch((e) => console.error("[store] rename failed:", e));
      },

      loadSessions: async () => {
        try {
          const metas = await listSessions();
          set((st) => {
            const byId = new Map(st.sessions.map((s) => [s.id, s]));
            const sessions: Session[] = metas.map((m) => {
              const local = byId.get(m.id);
              return {
                id: m.id,
                title: m.title,
                updatedAt: m.updatedAt,
                messages: local?.messages ?? [],
                hasResearch: m.hasResearch ?? local?.hasResearch,
              };
            });
            // keep unsent local-only drafts at the top
            for (const s of st.sessions) {
              if (isTempId(s.id) && !byId.has(s.id + ":seen")) sessions.unshift(s);
            }
            return { sessions };
          });
        } catch (err) {
          console.error("[store] list sessions failed:", err);
        }
      },

      stop: () => {
        // Abort the request and update the UI at once, even if deltas are still buffered.
        aborter?.abort();
        streamRender?.cancel();
        const sid = get().streamingId;
        set((st) => ({
          abortFlag: true,
          isTyping: false,
          streamingId: null,
          sessions: sid
            ? st.sessions.map((s) =>
                s.messages.some((m) => m.id === sid)
                  ? { ...s, messages: s.messages.map((m) => (m.id === sid ? { ...m, streaming: false } : m)) }
                  : s,
              )
            : st.sessions,
        }));
      },

      send: async (raw) => {
        const text = raw.trim();
        if (!text || get().isTyping) return;

        let activeId = get().activeId;
        if (!activeId) activeId = get().newChat();
        const tempSession = isTempId(activeId);
        const postId: string | null = tempSession ? null : activeId;

        const userMsg: Message = { id: uid(), role: "user", text, createdAt: Date.now() };
        const firstMsg =
          (get().sessions.find((s) => s.id === activeId)?.messages.length ?? 0) === 0;
        set((st) => ({
          sessions: st.sessions.map((s) =>
            s.id === activeId
              ? {
                  ...s,
                  title: firstMsg ? titleFrom(text) : s.title,
                  updatedAt: Date.now(),
                  messages: [...s.messages, userMsg],
                  ...(get().researchMode ? { hasResearch: true } : {}),
                }
              : s,
          ),
          isTyping: true,
          abortFlag: false,
        }));

        aborter?.abort();
        aborter = new AbortController();
        const signal = aborter.signal;

        const aId = uid();
        const research = get().researchMode;
        const aMsg: Message = {
          id: aId,
          role: "assistant",
          text: "",
          createdAt: Date.now(),
          streaming: true,
          ...(research ? { research: newResearchView() } : {}),
        };
        set((st) => ({
          sessions: st.sessions.map((s) =>
            s.id === activeId ? { ...s, messages: [...s.messages, aMsg] } : s,
          ),
          streamingId: aId,
        }));

        let serverId: string | null = postId;
        let acc = "";
        let shown = ""; // what the renderer has actually received
        let failed: string | null = null;

        // Deltas can arrive hundreds of times per second; render at most every 50 ms.
        const render = throttle(() => {
          if (get().abortFlag) return;
          shown = acc;
          const snapshot = acc;
          set((st) => ({
            sessions: st.sessions.map((s) =>
              s.id === activeId
                ? { ...s, messages: s.messages.map((m) => (m.id === aId ? { ...m, text: snapshot } : m)) }
                : s,
            ),
          }));
        });
        streamRender = render;

        try {
          for await (const ev of chatEvents(postId, text, signal, get().model, research ? "research" : undefined)) {
            if (ev.type === "session") {
              serverId = ev.sessionId;
              if (tempSession) {
                const oldId = activeId;
                activeId = ev.sessionId;
                set((st) => ({
                  sessions: st.sessions.map((s) =>
                    s.id === oldId ? { ...s, id: ev.sessionId } : s,
                  ),
                  activeId: ev.sessionId,
                }));
              }
            } else if (ev.type === "delta") {
              if (get().abortFlag) break;
              acc += ev.delta;
              render.schedule();
            } else if (ev.type === "agent") {
              // NEXORA trace/answer/metrics: fold into the message's research view.
              set((st) => ({
                sessions: st.sessions.map((s) =>
                  s.id === activeId
                    ? {
                        ...s,
                        messages: s.messages.map((m) =>
                          m.id === aId && m.research
                            ? {
                                ...m,
                                research: applyAgentEvent(m.research, ev.event),
                                ...(ev.event.type === "run_start" ? { runId: ev.event.runId } : {}),
                              }
                            : m,
                        ),
                      }
                    : s,
                ),
              }));
            } else if (ev.type === "error") {
              failed = ev.error;
              break;
            } else {
              break; // done
            }
          }
        } catch (err) {
          if (signal.aborted || get().abortFlag) {
            // stopped by user — keep partial text, just finalize below
          } else {
            failed = err instanceof Error ? err.message : "Request failed";
          }
        }

        const stopped = signal.aborted || get().abortFlag;
        // Stop: keep exactly what was on screen (no late buffered text). Otherwise render the rest.
        render.cancel();
        if (streamRender === render) streamRender = null;
        const finalText = failed
          ? `⚠️ I couldn't generate a reply (${failed}). Please check your connection / API key and try again.`
          : stopped && !research
            ? withStoppedMarker(shown)
            : acc ||
              (research && stopped
                ? RESEARCH_STOPPED
                : "⚠️ The model returned an empty reply. Please try again.");
        const artifact = failed ? null : extractArtifact(finalText);

        set((st) => ({
          sessions: st.sessions.map((s) =>
            s.id === activeId
              ? {
                  ...s,
                  updatedAt: Date.now(),
                  messages: s.messages.map((m) =>
                    m.id === aId
                      ? {
                          ...m,
                          text: finalText,
                          streaming: false,
                          // Stop the panel timer even if "done" never arrived (Stop / error).
                          ...(m.research && !m.research.finishedAt
                            ? { research: { ...m.research, finishedAt: Date.now() } }
                            : {}),
                        }
                      : m,
                  ),
                }
              : s,
          ),
          isTyping: false,
          streamingId: null,
          artifact: artifact ?? st.artifact,
          artifactOpen: artifact ? true : st.artifactOpen,
        }));

        // Reconcile titles/order with the DB (server is source of truth).
        try {
          const metas = await listSessions();
          const meta = metas.find((m) => m.id === serverId);
          set((st) => ({
            sessions: st.sessions.map((s) =>
              s.id === serverId && meta
                ? { ...s, title: meta.title, updatedAt: meta.updatedAt, hasResearch: meta.hasResearch ?? s.hasResearch }
                : s,
            ),
          }));
        } catch {
          /* non-fatal */
        }
      },

      regenerate: async () => {
        const { sessions, activeId } = get();
        const s = sessions.find((x) => x.id === activeId);
        const lastUser = [...(s?.messages ?? [])].reverse().find((m) => m.role === "user");
        if (!lastUser || get().isTyping || !activeId || isTempId(activeId)) return;
        // drop trailing assistant messages locally; server history already
        // ends at the user message, so a flagged re-send won't duplicate it
        set((st) => ({
          sessions: st.sessions.map((x) =>
            x.id === activeId
              ? {
                  ...x,
                  messages: x.messages.filter(
                    (_, i, arr) => !(i === arr.length - 1 && arr[i]!.role === "assistant"),
                  ),
                }
              : x,
          ),
        }));
        // Re-stream without re-saving the user message (see /api/chat).
        const aId = uid();
        set((st) => ({
          sessions: st.sessions.map((x) =>
            x.id === activeId
              ? {
                  ...x,
                  messages: [
                    ...x.messages,
                    { id: aId, role: "assistant", text: "", createdAt: Date.now(), streaming: true } as Message,
                  ],
                }
              : x,
          ),
          isTyping: true,
          abortFlag: false,
          streamingId: aId,
        }));
        aborter?.abort();
        aborter = new AbortController();
        let acc = "";
        let regenShown = "";
        // Same 50 ms batching as send(): never render once per delta.
        const regenRender = throttle(() => {
          if (get().abortFlag) return;
          const snapshot = acc;
          regenShown = acc;
          set((st) => ({
            sessions: st.sessions.map((x) =>
              x.id === activeId
                ? { ...x, messages: x.messages.map((m) => (m.id === aId ? { ...m, text: snapshot } : m)) }
                : x,
            ),
          }));
        });
        streamRender = regenRender;
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            signal: aborter.signal,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: activeId, message: lastUser.text, regenerate: true, model: get().model }),
          });
          const reader = res.body?.getReader();
          const decoder = new TextDecoder();
          let buf = "";
          if (reader) {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              const lines = buf.split("\n");
              buf = lines.pop() ?? "";
              for (const line of lines) {
                const t = line.trim();
                if (!t.startsWith("data:")) continue;
                const data = t.slice(5).trim();
                if (data === "[DONE]") break;
                try {
                  const json = JSON.parse(data);
                  if (typeof json.delta === "string") {
                    acc += json.delta;
                    regenRender.schedule();
                  }
                } catch {}
              }
            }
            reader.releaseLock();
          }
          regenRender.cancel(); // the final set below writes the full text
          if (streamRender === regenRender) streamRender = null;
          const artifact = extractArtifact(acc);
          set((st) => ({
            sessions: st.sessions.map((x) =>
              x.id === activeId
                ? {
                    ...x,
                    updatedAt: Date.now(),
                    messages: x.messages.map((m) =>
                      m.id === aId
                        ? { ...m, text: acc || "⚠️ Empty reply — please try again.", streaming: false }
                        : m,
                    ),
                  }
                : x,
            ),
            isTyping: false,
            streamingId: null,
            artifact: artifact ?? st.artifact,
            artifactOpen: artifact ? true : st.artifactOpen,
          }));
        } catch {
          regenRender.cancel();
          if (streamRender === regenRender) streamRender = null;
          const stoppedText = get().abortFlag ? withStoppedMarker(regenShown) : null;
          set((st) => ({
            sessions: st.sessions.map((x) =>
              x.id === activeId
                ? {
                    ...x,
                    messages: x.messages.map((m) =>
                      m.id === aId ? { ...m, text: stoppedText ?? "⚠️ Regeneration failed — please try again.", streaming: false } : m,
                    ),
                  }
                : x,
            ),
            isTyping: false,
            streamingId: null,
          }));
        }
      },
    }),
    {
      name: "nexora-store-v2",
      partialize: (s) =>
        ({ theme: s.theme, sidebarOpen: s.sidebarOpen, model: s.model, researchMode: s.researchMode }) as ChatState,
    },
  ),
);
