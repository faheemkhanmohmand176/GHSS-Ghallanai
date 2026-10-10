"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, X } from "lucide-react";

/**
 * GlobalDefinitionPopup — double-click any English word on the homepage for
 * an instant definition (Babi Khel feature). Looks the word up through
 * /api/word-of-day?word=… (server-side dictionary). Skips inputs, editable
 * areas and open dialogs.
 */
interface Def {
  word: string;
  phonetic?: string;
  meanings: { part: string; definitions: { definition: string; example?: string }[]; synonyms?: string[] }[];
}

export function DefinitionPopup() {
  const [def, setDef] = useState<Def | null>(null);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onDblClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        !target ||
        target.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], button, a")
      )
        return;
      const sel = window.getSelection?.();
      const text = sel?.toString()?.trim() ?? "";
      if (!/^[A-Za-z-]{2,40}$/.test(text)) return;
      if (sel && sel.rangeCount > 0) {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        setPos({ x: Math.min(rect.left + rect.width / 2, window.innerWidth - 170), y: rect.bottom + 8 });
      }
      setLoading(true);
      setDef(null);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        fetch(`/api/word-of-day?word=${encodeURIComponent(text.toLowerCase())}`)
          .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not found"))))
          .then((d: Def) => setDef(d))
          .catch(() => setDef(null))
          .finally(() => setLoading(false));
      }, 150);
    };
    document.addEventListener("dblclick", onDblClick);
    return () => {
      document.removeEventListener("dblclick", onDblClick);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("scroll", close, { passive: true, capture: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("scroll", close, { capture: true } as never);
      document.removeEventListener("keydown", onKey);
    };
  }, [pos]);

  if (!pos) return null;

  const first = def?.meanings?.[0];

  return (
    <div
      role="tooltip"
      aria-label={`Definition of ${def?.word ?? ""}`}
      className="fixed z-[70] w-72 -translate-x-1/2 rounded-xl border border-border bg-popover p-4 shadow-2xl"
      style={{
        left: Math.max(150, pos.x),
        top: Math.min(pos.y, window.innerHeight - 190),
      }}
    >
      <button
        type="button"
        onClick={() => setPos(null)}
        aria-label="Close definition"
        className="button-press absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-secondary"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>

      {loading && <p className="py-2 text-xs text-muted-foreground">Looking up…</p>}

      {!loading && !def && (
        <p className="py-2 text-xs text-muted-foreground">No definition found for this word.</p>
      )}

      {def && first && (
        <>
          <div className="flex items-baseline gap-2 pr-8">
            <p className="font-display text-lg font-bold">{def.word}</p>
            {def.phonetic && <p className="text-xs text-muted-foreground">{def.phonetic}</p>}
          </div>
          <p className="mt-1 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-primary">
            {first.part}
          </p>
          <p className="mt-2 text-xs leading-relaxed">{first.definitions?.[0]?.definition}</p>
          {first.definitions?.[0]?.example && (
            <p className="mt-1.5 rounded-lg bg-secondary px-2.5 py-1.5 text-[0.7rem] italic text-muted-foreground">
              “{first.definitions[0].example}”
            </p>
          )}
          {first.synonyms?.length ? (
            <p className="mt-2 text-[0.7rem] text-muted-foreground">
              <span className="font-semibold">Synonyms: </span>
              {first.synonyms.slice(0, 3).join(", ")}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (typeof window === "undefined" || !window.speechSynthesis) return;
              window.speechSynthesis.cancel();
              const u = new SpeechSynthesisUtterance(`${def.word}. ${first.definitions?.[0]?.definition ?? ""}`);
              u.rate = 0.9;
              u.lang = "en-US";
              window.speechSynthesis.speak(u);
            }}
            aria-label="Listen"
            className="button-press mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-[0.7rem] font-bold text-primary hover:bg-secondary"
          >
            <Volume2 className="h-3 w-3" aria-hidden /> Listen
          </button>
        </>
      )}
    </div>
  );
}
