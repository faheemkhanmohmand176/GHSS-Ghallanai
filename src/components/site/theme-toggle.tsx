"use client";

import { Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY } from "@/lib/theme";

/**
 * Sun-and-moon theme toggle (§5.3): morphs over 250ms,
 * persists to localStorage, never flashes. Icon selection is pure CSS
 * via the data-theme variant — no state, no hydration mismatch.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute("data-theme") === "dark" ? "bright" : "dark";
    root.setAttribute("data-theme", next);
    root.style.colorScheme = next;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle bright and dark theme"
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full text-foreground/80 transition-colors duration-150 hover:bg-secondary hover:text-foreground ${className}`}
    >
      <Moon className="h-5 w-5 transition-transform duration-[250ms] dark:hidden" aria-hidden />
      <Sun className="hidden h-5 w-5 transition-transform duration-[250ms] dark:block" aria-hidden />
    </button>
  );
}
