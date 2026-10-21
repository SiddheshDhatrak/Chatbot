import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { callGroqWithTools, onProviderFailure } from "@/server/groqTools";
import { makeGroq429Logger, SCREEN_CHARS, type ErrorContext } from "./errorLog";

// A long, realistic Groq 429 body (longer than the 300-char screen line).
const BODY = JSON.stringify({
  error: {
    message:
      "Rate limit reached for model `openai/gpt-oss-120b` in organization `org_test` service tier `on_demand` on tokens per day (TPD): " +
      "Limit 200000, Used 199850, Requested 2410. Please try again in 0.01s. Need more tokens? Upgrade to Dev Tier today at " +
      "https://console.groq.com/settings/billing " + "x".repeat(400),
    type: "tokens",
    code: "rate_limit_exceeded",
  },
});

afterEach(() => vi.unstubAllGlobals());

describe("eval/errors.log", () => {
  it("logs every Groq 429 (incl. the internal retry) untruncated, with headers and question id", async () => {
    process.env.GROQ_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(BODY, {
          status: 429,
          headers: {
            "retry-after": "0",
            "x-ratelimit-limit-tokens": "8000",
            "x-ratelimit-remaining-tokens": "12",
            "x-ratelimit-reset-tokens": "7.66s",
            "x-ratelimit-limit-requests": "1000",
            "content-type": "application/json",
          },
        }),
      ),
    );
    const file = path.join(mkdtempSync(path.join(tmpdir(), "nexora-eval-")), "errors.log");
    const ctx: ErrorContext = { questionId: "q07_everest_height", mode: "nexora" };
    const screen: string[] = [];
    const off = onProviderFailure(makeGroq429Logger(file, ctx, (s) => screen.push(s)));

    await expect(callGroqWithTools([{ role: "user", content: "hi" }], [], "openai/gpt-oss-120b")).rejects.toThrow(/429/);
    off();

    const log = readFileSync(file, "utf8");
    expect(log.match(/question=q07_everest_height mode=nexora provider=Groq status=429/g)).toHaveLength(2); // try + retry
    expect(log).toContain("attempt=1");
    expect(log).toContain("attempt=2");
    expect(log).toContain(BODY); // complete, untruncated body
    expect(log).toContain("x-ratelimit-remaining-tokens: 12");
    expect(log).toContain("x-ratelimit-reset-tokens: 7.66s");
    expect(log).toContain("retry-after: 0");
    expect(log).not.toContain("content-type"); // only rate-limit headers
    expect(log).toMatch(/^\[\d{4}-\d{2}-\d{2}T/m); // timestamp
    expect(screen).toHaveLength(2);
    // Screen shows the first 300 characters of the message, then an ellipsis.
    expect(screen[0]).toContain("Groq 429: {");
    expect(screen[0]!.split("] ")[1]!.length).toBe(SCREEN_CHARS + 1);
  });
});
