/**
 * Batch high-frequency updates (streaming deltas) into at most one call per
 * `ms` milliseconds. Groq can emit hundreds of deltas per second; rendering
 * Markdown on each one blocks the main thread.
 */
export interface Throttled {
  /** Ask for a run; coalesced with other requests in the same window. */
  schedule(): void;
  /** Run now if something is pending (e.g. at end of stream). */
  flush(): void;
  /** Drop anything pending (e.g. on Stop). */
  cancel(): void;
}

export const STREAM_RENDER_MS = 50;

export function throttle(fn: () => void, ms = STREAM_RENDER_MS): Throttled {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = 0;
  const run = () => {
    timer = null;
    last = Date.now();
    fn();
  };
  return {
    schedule() {
      if (timer) return;
      timer = setTimeout(run, Math.max(0, ms - (Date.now() - last)));
    },
    flush() {
      if (!timer) return;
      clearTimeout(timer);
      run();
    },
    cancel() {
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}
