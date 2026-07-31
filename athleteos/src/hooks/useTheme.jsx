import { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "athleteos-theme";

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function useTheme() {
  const [theme, setTheme] = useState(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* stockage indisponible (navigation privée) */ }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(previous => (previous === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggleTheme };
}

export function ThemeToggleButton({ theme, onToggle, compact = false }) {
  const isDark = theme === "dark";
  const label = isDark ? "Passer en mode clair" : "Passer en mode sombre";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className={[
        "flex items-center justify-center rounded-xl border transition-all tap-feedback",
        compact ? "w-11 h-11 p-0" : "gap-2 px-3 py-2 text-[12px] font-semibold",
      ].join(" ")}
      style={{ background: "var(--c-surface-2)", borderColor: "var(--c-border)", color: "var(--c-text-2)" }}
    >
      {isDark ? <Moon size={compact ? 16 : 13} /> : <Sun size={compact ? 16 : 13} />}
      {!compact && <span>{isDark ? "Sombre" : "Clair"}</span>}
    </button>
  );
}
