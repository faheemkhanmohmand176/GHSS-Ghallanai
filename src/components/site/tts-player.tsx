"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Square, X, Volume2 } from "lucide-react";

/**
 * TextToSpeechPlayer — bottom "Listen" bar (Babi Khel feature).
 * Any card's Listen pill dispatches `ghss:tts` with a title + text; this
 * single mounted player renders the bar and speaks sentence-by-sentence
 * with a speed selector (persisted). English-only content by school policy.
 */

interface TtsRequest {
  title: string;
  text: string;
}

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

export function ListenButton({ title, text, label = "Listen" }: { title: string; text: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent<TtsRequest>("ghss:tts", { detail: { title, text } }))
      }
      className="button-press inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-background/70 px-3.5 text-xs font-bold text-primary hover:border-primary/40 hover:bg-secondary"
      aria-label={`Listen to ${title}`}
    >
      <Volume2 className="h-3.5 w-3.5" aria-hidden />
      {label}
    </button>
  );
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?۔])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .reduce<string[]>((acc, s) => {
      // clamp chunks to ~180 chars
      while (s.length > 180) {
        let cut = s.lastIndexOf(" ", 180);
        if (cut < 60) cut = 180;
        acc.push(s.slice(0, cut));
        s = s.slice(cut).trim();
      }
      acc.push(s);
      return acc;
    }, []);
}

export function TextToSpeechPlayer() {
  const [req, setReq] = useState<TtsRequest | null>(null);
  const [playing, setPlaying] = useState(false);
  const [chunkIdx, setChunkIdx] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [chunkCount, setChunkCount] = useState(0);
  const chunksRef = useRef<string[]>([]);
  const idxRef = useRef(0);

  function stop() {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setPlaying(false);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const s = localStorage.getItem("ghss-tts-speed");
        if (s) setSpeed(Number(s));
      } catch {
        /* private mode */
      }
    }, 0);
    const onTts = (e: Event) => {
      const detail = (e as CustomEvent<TtsRequest>).detail;
      if (!detail?.text) return;
      stop();
      chunksRef.current = splitSentences(detail.text);
      idxRef.current = 0;
      setChunkIdx(0);
      setChunkCount(chunksRef.current.length);
      setReq(detail);
    };
    window.addEventListener("ghss:tts", onTts);
    return () => {
      clearTimeout(t);
      window.removeEventListener("ghss:tts", onTts);
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    };
  }, []);

  const speakFrom = useCallback(
    (start: number, rate: number) => {
      if (typeof window === "undefined" || !window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const list = chunksRef.current;
      if (!list.length) return;
      idxRef.current = start;
      setChunkIdx(start);
      setPlaying(true);

      const speakNext = (i: number) => {
        if (i >= list.length) {
          setPlaying(false);
          return;
        }
        idxRef.current = i;
        setChunkIdx(i);
        const u = new SpeechSynthesisUtterance(list[i]);
        u.rate = rate;
        u.lang = "en-US";
        u.onend = () => speakNext(i + 1);
        u.onerror = () => setPlaying(false);
        window.speechSynthesis.speak(u);
      };
      speakNext(start);
    },
    []
  );

  if (!req) return null;

  return (
    <div
      role="region"
      aria-label="Text to speech player"
      className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 px-3 pb-3 lg:bottom-4"
    >
      <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-full border border-border bg-background/95 px-3 py-2 shadow-2xl backdrop-blur">
        <p className="min-w-0 flex-1 truncate pl-2 text-xs font-bold">
          {req.title}
          <span className="ml-2 font-medium text-muted-foreground">
            {chunkCount > 0 ? `${chunkIdx + 1}/${chunkCount}` : ""}
          </span>
        </p>
        <div className="flex items-center gap-1" role="group" aria-label="Playback controls">
          <button
            type="button"
            onClick={() => (playing ? stop() : speakFrom(idxRef.current || 0, speed))}
            aria-label={playing ? "Pause" : "Play"}
            className="button-press inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            {playing ? <Pause className="h-4.5 w-4.5" aria-hidden /> : <Play className="h-4.5 w-4.5" aria-hidden />}
          </button>
          <button
            type="button"
            onClick={() => {
              stop();
              setReq(null);
            }}
            aria-label="Close player"
            className="button-press inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary"
          >
            <Square className="h-4 w-4" aria-hidden />
          </button>
          <select
            value={speed}
            aria-label="Reading speed"
            onChange={(e) => {
              const v = Number(e.target.value);
              setSpeed(v);
              try {
                localStorage.setItem("ghss-tts-speed", String(v));
              } catch {
                /* ignore */
              }
              if (playing) speakFrom(idxRef.current || 0, v);
            }}
            className="h-10 rounded-full border border-border bg-background px-2 text-xs font-semibold"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}×
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setReq(null)}
            aria-label="Dismiss"
            className="button-press inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-secondary"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      {chunkCount > 0 && (
        <div className="mx-auto mt-1 h-1 max-w-2xl overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-gold transition-all"
            style={{ width: `${((chunkIdx + 1) / chunkCount) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
