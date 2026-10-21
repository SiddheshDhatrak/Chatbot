/**
 * Normal-chat Stop: the route must stop reading the upstream stream as soon
 * as the client aborts, and save only the partial text with a "Stopped" marker.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const saved: { role: string; content: string }[] = [];
const upstream = { produced: 0, sawAbort: false, finished: false };

vi.mock("@/server/db", () => ({
  db: {
    session: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({ id: "s1", title: "New conversation" })),
      update: vi.fn(async () => ({})),
    },
    message: {
      count: vi.fn(async () => 0),
      create: vi.fn(async ({ data }: { data: { role: string; content: string } }) => {
        saved.push({ role: data.role, content: data.content });
        return data;
      }),
      findMany: vi.fn(async () => [{ role: "user", content: "hi" }]),
    },
  },
}));

// Upstream that never ends on its own: one chunk every 5 ms until aborted.
vi.mock("@/server/ai", () => ({
  SYSTEM_PROMPT: "test",
  async *streamReply(_messages: unknown, opts?: { signal?: AbortSignal }) {
    for (;;) {
      if (opts?.signal?.aborted) {
        upstream.sawAbort = true;
        return;
      }
      upstream.produced++;
      yield `chunk${upstream.produced} `;
      await new Promise((r) => setTimeout(r, 5));
    }
  },
}));

vi.mock("@/server/agent", () => ({ runAgent: vi.fn(), splitSources: vi.fn(), STOPPED_MESSAGE: "stopped" }));

const { POST } = await import("./route");

beforeEach(() => {
  saved.length = 0;
  Object.assign(upstream, { produced: 0, sawAbort: false, finished: false });
});

describe("POST /api/chat (normal mode) on Stop", () => {
  it("stops reading the upstream after abort and saves only the partial text, marked", async () => {
    const ac = new AbortController();
    const req = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "write forever" }),
      headers: { "Content-Type": "application/json" },
      signal: ac.signal,
    });
    const res = await POST(req as never);
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    let received = "";
    while (!received.includes("chunk5 ")) received += dec.decode((await reader.read()).value);

    ac.abort(); // client pressed Stop / disconnected
    await reader.cancel().catch(() => {});
    const atAbort = upstream.produced;
    await new Promise((r) => setTimeout(r, 150)); // the upstream would make ~30 more chunks

    expect(upstream.sawAbort).toBe(true);
    expect(upstream.produced - atAbort).toBeLessThanOrEqual(1); // stopped reading
    const assistant = saved.filter((m) => m.role === "assistant");
    expect(assistant).toHaveLength(1);
    expect(assistant[0]!.content).toMatch(/_\[Stopped\]_$/);
    expect(assistant[0]!.content).toContain("chunk5");
    expect(assistant[0]!.content).not.toContain(`chunk${atAbort + 5} `);
    expect(assistant[0]!.content).not.toMatch(/couldn't generate/);
  });

  it("an uninterrupted answer is saved in full, without the marker", async () => {
    vi.doMock("@/server/ai", () => ({
      SYSTEM_PROMPT: "test",
      async *streamReply() {
        yield "Hello ";
        yield "world.";
      },
    }));
    vi.resetModules();
    const { POST: post } = await import("./route");
    const res = await post(
      new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify({ message: "hi" }) }) as never,
    );
    const text = await res.text();
    expect(text).toContain("[DONE]");
    expect(saved.filter((m) => m.role === "assistant").map((m) => m.content)).toEqual(["Hello world."]);
  });
});
