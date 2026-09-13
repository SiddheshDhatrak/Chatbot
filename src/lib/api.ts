export interface ApiMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
}

export interface ApiSessionMeta {
  id: string;
  title: string;
  updatedAt: number;
  createdAt: number;
  messageCount: number;
}

export type ChatEvent =
  | { type: "session"; sessionId: string }
  | { type: "delta"; delta: string }
  | { type: "error"; error: string }
  | { type: "done" };

/** POST /api/chat and yield SSE events as they arrive. */
export async function* chatEvents(
  sessionId: string | null,
  message: string,
  signal: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const res = await fetch("/api/chat", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message }),
  });
  if (!res.ok || !res.body) {
    let detail = "";
    try {
      detail = (await res.json())?.error ?? "";
    } catch {
      /* non-JSON error */
    }
    yield { type: "error", error: detail || `Request failed (${res.status})` };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  try {
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
        if (data === "[DONE]") {
          yield { type: "done" };
          return;
        }
        try {
          const json = JSON.parse(data);
          if (typeof json.delta === "string" && json.delta)
            yield { type: "delta", delta: json.delta };
          else if (typeof json.sessionId === "string")
            yield { type: "session", sessionId: json.sessionId };
          else if (typeof json.error === "string")
            yield { type: "error", error: json.error };
        } catch {
          /* ignore partial frames */
        }
      }
    }
    yield { type: "done" };
  } finally {
    reader.releaseLock();
  }
}

export async function listSessions(): Promise<ApiSessionMeta[]> {
  const res = await fetch("/api/sessions");
  if (!res.ok) throw new Error(`list failed (${res.status})`);
  const json = await res.json();
  return json.sessions ?? [];
}

export async function getSession(
  id: string,
): Promise<{ id: string; title: string; updatedAt: number; messages: ApiMessage[] }> {
  const res = await fetch(`/api/sessions/${id}`);
  if (!res.ok) throw new Error(`load failed (${res.status})`);
  return (await res.json()).session;
}

export async function renameSession(id: string, title: string): Promise<void> {
  const res = await fetch(`/api/sessions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error(`rename failed (${res.status})`);
}

export async function deleteSession(id: string): Promise<void> {
  const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`delete failed (${res.status})`);
}
