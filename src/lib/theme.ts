export type Theme = "noir" | "ivory";

const KEY = "claude-theme";

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "ivory" ? "ivory" : "noir";
  } catch {
    return "noir";
  }
}

export function setTheme(t: Theme) {
  try {
    localStorage.setItem(KEY, t);
  } catch {}
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.style.colorScheme = t === "ivory" ? "light" : "dark";
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "noir" ? "ivory" : "noir";
  setTheme(next);
  return next;
}
