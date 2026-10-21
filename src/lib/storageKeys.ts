/**
 * Browser-storage keys were renamed from "claude-*" to "nexora-*" in the
 * rebrand. Copy any old value to its new key once, then drop the old key,
 * so saved theme, model, feedback and sidebar state survive the rename.
 * Runs on import: modules that read these keys import this file first.
 */
const RENAMES: [from: string, to: string][] = [
  ["claude-theme", "nexora-theme"],
  ["claude-model", "nexora-model"],
  ["claude-feedback-v1", "nexora-feedback-v1"],
  ["claude-luxe-store-v2", "nexora-store-v2"],
];

export function migrateLegacyStorage(): void {
  try {
    if (typeof localStorage === "undefined") return;
    for (const [from, to] of RENAMES) {
      const old = localStorage.getItem(from);
      if (old === null) continue;
      if (localStorage.getItem(to) === null) localStorage.setItem(to, old);
      localStorage.removeItem(from);
    }
  } catch {
    /* private mode / storage blocked: nothing to migrate */
  }
}

migrateLegacyStorage();
