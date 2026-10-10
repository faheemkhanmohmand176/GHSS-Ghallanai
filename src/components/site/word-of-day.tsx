"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, CalendarDays, RotateCw } from "lucide-react";

/**
 * WordOfTheDay — Babi Khel homepage English-learning card.
 * Fetches /api/word-of-day (curated, PKT-date-seeded) on idle so it never
 * competes with first paint. Speaker uses the Web Speech API. The card is
 * English-only by design (school policy).
 */
interface WordData {
  date: string;
  word: string;
  phonetic: string;
  meanings: {
    part: string;
    definitions: { definition: string; example?: string }[];
    synonyms?: string[];
  }[];
}

export function WordOfDay() {
  const [data, setData] = useState<WordData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [speaking, setSpeaking] = useState(false);
  const [activePart, setActivePart] = useState(0);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      fetch("/api/word-of-day")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad status"))))
        .then((d: WordData) => {
          if (!cancelled) {
            setData(d);
            setState("ready");
          }
        })
        .catch(() => {
          if (!cancelled) setState("error");
        });
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(load, { timeout: 3500 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(id as number);
      };
    }
    const t = setTimeout(load, 1200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [state === "error"]);

  function speak() {
    if (!data || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(
      `${data.word}. ${data.meanings
        .slice(0, 2)
        .map((m) => `${m.part}. ${m.definitions[0]?.definition ?? ""}`)
        .join(" ")}`
    );
    u.rate = 0.85;
    u.lang = "en-US";
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utterRef.current = u;
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }

  useEffect(() => {
    return () => {
      utterRef.current = null;
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const prettyDate = data?.date
    ? new Date(data.date + "T00:00:00").toLocaleDateString("en-PK", {
        day: "numeric",
        month: "short",
      })
    : "";

  return (
    <section aria-labelledby="wotd" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20">
      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
        <div>
          <p className="kicker">English Learning</p>
          <h2 id="wotd" className="mt-3 text-h2 font-display font-bold">
            Word of the <span className="text-gold">Day</span>
          </h2>
          <p className="mt-2 max-w-md text-small leading-relaxed text-muted-foreground">
            One carefully chosen word every day — with meaning, example and pronunciation. A small
            daily habit that grows vocabulary across both years and all four programmes.
          </p>
        </div>

        <div className="card-lift overflow-hidden rounded-2xl border border-border bg-card">
          {/* Banner */}
          <div className="flex items-center justify-between gap-3 bg-primary-strong px-5 py-4 text-white dark:bg-[#0a1810]">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#E8F5EC]/80">
              <CalendarDays className="h-4 w-4 text-gold" aria-hidden />
              {prettyDate || "Today"}
            </p>
            <button
              type="button"
              onClick={speak}
              disabled={!data}
              aria-label={speaking ? "Speaking the word" : "Listen to the word"}
              className={`button-press inline-flex h-11 w-11 items-center justify-center rounded-full bg-gold text-[#1A2E22] transition-transform ${
                speaking ? "animate-pulse ring-4 ring-gold/30" : "hover:scale-105"
              }`}
            >
              <Volume2 className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="p-5 sm:p-6">
            {state === "loading" && (
              <div className="space-y-3" aria-busy>
                <div className="h-9 w-40 animate-pulse rounded-lg bg-secondary" />
                <div className="h-4 w-64 animate-pulse rounded bg-secondary" />
                <div className="h-4 w-56 animate-pulse rounded bg-secondary" />
              </div>
            )}

            {state === "error" && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-small text-muted-foreground">
                  The word service is unreachable right now.
                </p>
                <button
                  type="button"
                  onClick={() => setState("loading")}
                  className="button-press inline-flex h-10 items-center gap-2 rounded-full border border-border px-4 text-small font-semibold hover:bg-secondary"
                >
                  <RotateCw className="h-4 w-4" aria-hidden /> Retry
                </button>
              </div>
            )}

            {state === "ready" && data && (
              <>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <p
                    className={`font-display font-bold leading-none ${
                      data.word.length > 12 ? "text-3xl" : "text-4xl"
                    }`}
                  >
                    {data.word}
                  </p>
                  <p className="text-small text-muted-foreground">{data.phonetic}</p>
                </div>

                {data.meanings.length > 1 && (
                  <div role="tablist" aria-label="Parts of speech" className="mt-3 flex flex-wrap gap-1.5">
                    {data.meanings.map((m, i) => (
                      <button
                        key={m.part}
                        role="tab"
                        aria-selected={activePart === i}
                        onClick={() => setActivePart(i)}
                        className={`button-press h-8 rounded-full px-3.5 text-xs font-semibold capitalize transition-colors ${
                          activePart === i
                            ? "bg-primary text-primary-foreground"
                            : "border border-border text-foreground/70 hover:bg-secondary"
                        }`}
                      >
                        {m.part}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-4 space-y-3">
                  {data.meanings[activePart]?.definitions.slice(0, 3).map((d, i) => (
                    <div key={i}>
                      <p className="text-small leading-relaxed">
                        <span className="mr-2 font-bold text-gold">{i + 1}.</span>
                        {d.definition}
                      </p>
                      {d.example && (
                        <p className="mt-1 rounded-lg bg-secondary px-3 py-2 text-xs italic leading-relaxed text-muted-foreground">
                          “{d.example}”
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {data.meanings[activePart]?.synonyms?.length ? (
                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Synonyms
                    </span>
                    {data.meanings[activePart].synonyms!.slice(0, 4).map((s) => (
                      <span
                        key={s}
                        className="rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-xs font-semibold text-foreground/75"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                ) : null}

                <p className="mt-4 border-t border-border/70 pt-3 text-xs text-muted-foreground">
                  Pro tip: double-click any English word on this page for its definition.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
