import { useCallback, useEffect, useState } from "react";

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
