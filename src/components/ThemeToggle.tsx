"use client";

import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      className="px-3 py-1.5 rounded border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] hover:opacity-90"
    >
      {theme === "light" ? "Dark" : "Light"}
    </button>
  );
}
