import { fetchResultSchedule } from "@/lib/resultSchedule";
import { m, useInView, useScroll, useTransform, useSpring, useReducedMotion } from "framer-motion";
import { useRef, useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, Bell, Users, GraduationCap,
  Trophy, ChevronRight,
  BookOpen, Sparkles, BarChart3, Image,
  Star, Award, MapPin, Phone, Mail,
  Shield, Zap, Globe, Lightbulb, RefreshCw,
  Volume2, BookMarked, X as XIcon, Clock, ExternalLink,
  UserPlus, Search, Lock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import { useSchoolSettings, safeMediaUrl, optimizedCloudinaryUrl } from "@/hooks/useSchoolSettings";
import { useAdmissionSettings, getAdmissionState } from "@/hooks/useAdmission";
import { useNotices } from "@/hooks/useNotices";
import { useTeachers } from "@/hooks/useTeachers";
import { useCountUp } from "@/hooks/useCountUp";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import EditorialNoticeCard from "@/components/shared/EditorialNoticeCard";
import NoticePollCard from "@/components/shared/NoticePollCard";
import TextToSpeechPlayer from "@/components/shared/TextToSpeechPlayer";
import type { Notice } from "@/hooks/useNotices";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cachedOrDirect } from "@/lib/publicData";
import { armAutoPublish } from "@/lib/autoPublish";
import DailyQuoteCard from "@/components/shared/DailyQuoteCard";
import Deferred from "@/components/shared/Deferred";
import { sortClassNames } from "@/lib/classOrder";

// PERF (homepage chunk diet): the AI assistant is a ~1,000-line widget that
// most visitors never open, yet it used to be statically bundled into the
// homepage chunk — every phone paid its parse/compile cost during the
// hydration pass. It is now split into its own chunk that loads at browser
// idle (Deferred mounts it, the import fires then, and the service worker
// caches it for offline reuse). The .catch() fallback renders nothing if the
// chunk can't load (first-ever visit while offline) — the site keeps working
// instead of crashing into the root error boundary.
const AIAssistantWidget = lazy(() =>
  import("@/components/shared/AIAssistantWidget")
    .then((mod) => ({ default: mod.default }))
    .catch(() => ({ default: () => null })),
);

/* ─── Animation variants ─── */
// PERF: short, small-distance reveals. Big offsets (y: 60) with long 0.7 s
// durations made sections visibly "crawl" in on slow phones and kept the
// compositor busy while the visitor was scrolling. These are quick and subtle.
const stagger = {
  parent: { hidden: {}, visible: { transition: { staggerChildren: 0.05 } } },
  child: {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
  },
};

// Section-level reveal is now handled per content block by <ScrollStage>,
// so this variant is intentionally a no-op (kept so existing props still work).
const sectionFadeUp = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0 },
};

/* Perf: several decorative background blobs/rings loop forever
   (repeat: Infinity) even when scrolled off-screen, which adds
   constant CPU/GPU work on lower-end phones. This just returns
   false when the OS-level "reduce motion" setting is on, so those
   loops don't run — the elements themselves stay visible, nothing
   is removed, they're just static instead of endlessly animating. */
function usePrefersMotion() {
  const [ok, setOk] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    setOk(!mq.matches);
    const handler = () => setOk(!mq.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);
  return ok;
}

/* ─── ScrollReveal ─── */
function ScrollReveal({ children, delay = 0, direction = "up" }: {
  children: React.ReactNode; delay?: number; direction?: "up" | "down" | "left" | "right";
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  return (
    <m.div ref={ref}
      initial={{ opacity: 0, y: direction === "up" ? 16 : direction === "down" ? -16 : 0, x: direction === "left" ? 16 : direction === "right" ? -16 : 0 }}
      animate={isInView ? { opacity: 1, y: 0, x: 0 } : {}}
      transition={{ duration: 0.35, delay: Math.min(delay, 0.15), ease: "easeOut" }}
    >{children}</m.div>
  );
}

/* ─── ScrollStage ───
   Scroll-LINKED reveal: content rises, un-scales and fades in as it enters,
   then dissolves (fade + shrink + lift) as it leaves the top of the screen.
   Section titles stay outside the stage so they remain crisp.
   Only transform + opacity are animated (GPU-composited, no blur) so it
   stays smooth on low-end phones. Tall blocks are measured by their own
   top / bottom edges, so content is never dimmed while being read. Falls
   back to a plain wrapper when the visitor prefers reduced motion. */
type StageVariant = "rise" | "zoom" | "left" | "right";
function ScrollStage({
  children, className = "", variant = "rise", enter = true, exitOffset,
}: {
  children: React.ReactNode; className?: string; variant?: StageVariant; enter?: boolean;
  exitOffset?: [string, string];
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: inRaw } = useScroll({ target: ref, offset: ["start end", "start 0.62"] as any });
  const { scrollYProgress: outRaw } = useScroll({ target: ref, offset: (exitOffset ?? ["end 0.38", "end 0"]) as any });
  const spring = { stiffness: 140, damping: 26, mass: 0.35 };
  const pin = useSpring(inRaw, spring);
  const pout = useSpring(outRaw, spring);
  const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

  const opacity = useTransform([pin, pout], ([i, o]: number[]) =>
    (enter ? clamp01(i * 1.15) : 1) * clamp01(1 - o * 1.1));
  const y = useTransform([pin, pout], ([i, o]: number[]) =>
    (enter && variant !== "zoom" ? (1 - clamp01(i)) * 56 : 0) - clamp01(o) * 44);
  const x = useTransform(pin, (i: number) =>
    !enter ? 0 : variant === "left" ? (1 - clamp01(i)) * -42 : variant === "right" ? (1 - clamp01(i)) * 42 : 0);
  const scale = useTransform([pin, pout], ([i, o]: number[]) => {
    const base = !enter ? 1 : variant === "zoom" ? 0.88 + 0.12 * clamp01(i) : 0.95 + 0.05 * clamp01(i);
    return base - clamp01(o) * 0.06;
  });

  if (reduce) return <div className={className}>{children}</div>;
  return (
    <m.div ref={ref} className={className} style={{ opacity, y, x, scale, willChange: "transform, opacity" }}>
      {children}
    </m.div>
  );
}

/* ─── Animated counter ─── */
/**
 * SEO/prerender-safe: starts at the FINAL value so build-time prerenders and
 * no-JavaScript crawlers always read the real number (never a misleading
 * "0+"). The 0→end animation plays only when scrolled into view (below).
 */
function useCountUpAnim(end: number, isInView: boolean) {
  const [count, setCount] = useState(end);
  useEffect(() => {
    if (!isInView) {
      setCount(end);
      return;
    }
    const duration = 2000;
    let frame = 0;
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(end * ease));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    setCount(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [end, isInView]);
  return count;
}
function AnimCounter({ value, suffix = "", isInView }: { value: number; suffix?: string; isInView: boolean }) {
  const c = useCountUpAnim(value, isInView);
  return <>{c}{suffix}</>;
}

/* ─── Premium stat tile (stats bar) ─── */
const StatTile = ({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) => (
  <div className={`group relative overflow-hidden rounded-xl border border-border/80 bg-gradient-to-b from-card to-secondary/40 px-3 py-4 md:py-5 text-center transition-all duration-300 hover:border-gold/60 hover:shadow-card ${wide ? "col-span-2 md:col-span-1" : ""}`}>
    <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-gold/70 to-transparent" />
    <div className="text-[1.55rem] md:text-[1.75rem] leading-none font-heading font-extrabold tabular-nums bg-gradient-to-r from-primary via-primary-light to-gold bg-clip-text text-transparent">{children}</div>
    <div className="mt-1.5 text-[10px] md:text-[11px] uppercase tracking-[0.16em] text-muted-foreground font-semibold">{label}</div>
  </div>
);

const CountStat = ({ value, label, suffix = "", wide }: { value: number; label: string; suffix?: string; wide?: boolean }) => {
  const { count, ref } = useCountUp(value);
  return (
    <div ref={ref} className={wide ? "col-span-2 md:col-span-1" : ""}>
      <StatTile label={label}>{count}{suffix}</StatTile>
    </div>
  );
};

// Same visual treatment as CountStat, for stats whose value is a grade
// string (e.g. "A+", "A1", "A++") rather than a number — board results
// aren't a quantity that can be counted up, so this renders statically.
const TextStat = ({ value, label, wide }: { value: string; label: string; wide?: boolean }) => (
  <StatTile label={label} wide={wide}>{value}</StatTile>
);

/* ─── Reusable section header ─── */
const SectionHeader = ({ eyebrow, title, subtitle, center = true }: { eyebrow?: string; title: string; subtitle?: string; center?: boolean }) => (
  <div className={`mb-10 md:mb-14 ${center ? "text-center" : ""}`}>
    {eyebrow && (
      <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1 eyebrow">
        <span className="w-1.5 h-1.5 rotate-45 bg-gold" />{eyebrow}
      </span>
    )}
    <h2 className="section-title">{title}</h2>
    <div className={`mt-4 flex items-center gap-2 ${center ? "justify-center" : ""}`}>
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-gold/70" />
      <span className="w-1.5 h-1.5 rotate-45 bg-gold" />
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-gold/70" />
    </div>
    {subtitle && <p className="section-subtitle">{subtitle}</p>}
  </div>
);

/* ─── Features data ─── */
const features = [
  { icon: BookOpen,    title: "Quality Curriculum", desc: "Comprehensive KPK board-aligned syllabus with modern teaching methods." },
  { icon: Trophy,      title: "Top Results",         desc: "Consistently achieving outstanding pass results across all classes." },
  { icon: GraduationCap, title: "Expert Teachers",  desc: "Qualified and experienced faculty dedicated to student success." },
];


/* ─── Free Dictionary API types ─── */
interface DictPhonetic { text?: string; audio?: string; }
interface DictDefinition { definition: string; example?: string; synonyms: string[]; }
interface DictMeaning { partOfSpeech: string; definitions: DictDefinition[]; }
interface DictEntry { word: string; phonetics: DictPhonetic[]; meanings: DictMeaning[]; }

/* ─── Word of the Day — 100% online via /api/word-of-day ──────────────────
 * The browser makes a SINGLE same-origin call to /api/word-of-day, which
 * is a Vercel serverless function that does the heavy lifting:
 *
 *   1. Wordnik's curated "word of the day"  (highest quality)
 *   2. Wordnik's previous-day word looked up in Free Dictionary
 *   3. Datamuse word picker + Free Dictionary lookup (last-resort fallback)
 *
 * Each upstream is tried in order; the first one that returns a real
 * word + definition + example wins. The chosen entry is cached on the
 * server for the rest of the day (PKT timezone), so every visitor sees
 * the same word, the lookup is instant, and we never hammer the APIs.
 *
 * Why server-side, not browser-side?
 *   • The project's CSP `connect-src` only whitelists `self` + a small
 *     list of approved domains — api.datamuse.com and api.dictionaryapi.dev
 *     are NOT on it, so browser fetch() to them was silently blocked,
 *     which is why the homepage always showed "Could not load today's
 *     word. Please check your connection."
 *   • The school's region has intermittent connectivity to those APIs;
 *     routing through Vercel's edge keeps it fast and reliable.
 *
 * RESILIENCE: the daily word itself is served from a curated dataset
 * embedded in the serverless function (zero upstream calls), so the API
 * response is generated in ~0 ms and can never time out. Per the site
 * owner's request there is deliberately NO client-side offline fallback:
 * if the /api/word-of-day call fails, the card shows the error state
 * with a Retry button — no locally computed substitute word.
 * ──────────────────────────────────────────────────────────────────────── */
/** Universal fetch timeout — AbortController + setTimeout.
 *  WHY NOT AbortSignal.timeout(): that static helper only exists on browsers
 *  shipped after mid-2022 (Chromium 103, Safari 16). On older mobile browsers
 *  — common among this school's visitors — `AbortSignal.timeout(…)` is
 *  undefined and calling it throws a TypeError, which used to fail the
 *  Word-of-the-Day fetch INSTANTLY on those devices even with a perfect
 *  connection (desktop Chrome was fine, so the bug looked "mobile-only").
 *  AbortController + setTimeout works everywhere this app can run. */
function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function getTodayEntry(): Promise<DictEntry | null> {
  try {
    const res = await fetchWithTimeout(
      "/api/word-of-day",
      { method: "GET", headers: { Accept: "application/json" } },
      // 10s client-side cap so the UI never hangs forever.
      10000
    );
    if (!res.ok) {
      console.error(`[WordOfDay] /api/word-of-day returned HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (!data || data.ok !== true || !data.word || !Array.isArray(data.meanings) || data.meanings.length === 0) {
      console.error("[WordOfDay] /api/word-of-day returned an empty/invalid body:", data);
      return null;
    }
    // The API returns the same shape as DictEntry (`word`, `phonetics`,
    // `meanings`) so the rest of the component needs no changes.
    return data as DictEntry;
  } catch (err) {
    console.error("[WordOfDay] /api/word-of-day fetch failed:", err);
    return null;
  }
}

/** Look up a word's definition via our /api/word-of-day?word=... proxy.
 *  Same-origin call → no CSP issues, no region blocks. */
async function lookupWord(word: string): Promise<DictEntry | null> {
  const w = word.toLowerCase().trim();
  if (!w) return null;
  try {
    const res = await fetchWithTimeout(
      `/api/word-of-day?word=${encodeURIComponent(w)}`,
      {},
      8000
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || data.ok !== true || !data.word) return null;
    return data as DictEntry;
  } catch {
    return null;
  }
}

/* ─── Global double-click definition popup ─── */
function GlobalDefinitionPopup() {
  const [popup, setPopup] = useState<{ word: string; x: number; y: number; entry: DictEntry | null; loading: boolean } | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = async (e: MouseEvent) => {
      if (e.detail !== 2) return;

      // ── Scope guard (fix for 2.1) ──────────────────────────────────────
      // Never trigger the dictionary popup when the double-click happens
      // inside an editable element. This includes native form controls,
      // contenteditable regions (TipTap, Lexical, plain divs), and any
      // element explicitly opted out via `[data-no-dict]`. Also bail out
      // while a modal/dialog is open so the lookup doesn't steal focus
      // or stack on top of an overlapping dialog.
      const target = e.target as Element | null;
      if (target) {
        const editable = target.closest(
          'input, textarea, select, ' +
          '[contenteditable=""], [contenteditable="true"], ' +
          '[role="textbox"], ' +
          '[data-no-dict]'
        );
        if (editable) return;
        // Skip if a shadcn/radix dialog or sheet is currently open.
        if (document.querySelector('[role="dialog"][data-state="open"], [role="presentation"][data-state="open"]')) {
          return;
        }
      }

      const sel = window.getSelection();
      const raw = sel?.toString().trim();
      if (!raw || raw.length < 2 || raw.length > 40 || /\s/.test(raw)) return;
      const word = raw.replace(/[^a-zA-Z'-]/g, "");
      if (!word) return;
      const x = Math.min(e.clientX, window.innerWidth - 280);
      const y = e.clientY + window.scrollY;
      setPopup({ word, x, y, entry: null, loading: true });
      const entry = await lookupWord(word);
      setPopup((prev) => prev && prev.word === word ? { ...prev, entry, loading: false } : prev);
    };
    document.addEventListener("dblclick", handler);
    return () => document.removeEventListener("dblclick", handler);
  }, []);

  useEffect(() => {
    if (!popup) return;
    const close = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) setPopup(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [popup]);

  if (!popup) return null;

  // CRASH GUARD: the dictionary proxy validates `word` and `meanings`, but a
  // malformed entry can still arrive with a missing/odd `phonetics` array —
  // the old unguarded `.find()` on it threw inside render and white-screened
  // the whole homepage. Optional chaining everywhere; the popup simply hides
  // the parts it doesn't have.
  const audioUrl = popup.entry?.phonetics?.find((p) => p.audio && p.audio.startsWith("http"))?.audio;
  const phonetic = popup.entry?.phonetics?.find((p) => p.text)?.text;
  const meaning = popup.entry?.meanings?.[0];
  const def = meaning?.definitions?.[0];

  const speakPopupWord = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(popup.word);
    utter.lang = "en-US"; utter.rate = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(v => v.lang.startsWith("en") && !v.name.includes("Google")) || voices.find(v => v.lang.startsWith("en"));
    if (v) utter.voice = v;
    window.speechSynthesis.speak(utter);
  };

  return (
    <div
      ref={popupRef}
      style={{ position: "absolute", top: popup.y + 14, left: popup.x, zIndex: 99999, maxWidth: 280 }}
      className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 px-4 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BookMarked className="w-3.5 h-3.5 text-white shrink-0" />
          <span className="font-black text-white text-sm truncate capitalize">{popup.word}</span>
          {phonetic && <span className="text-white/70 text-[11px] font-mono shrink-0">{phonetic}</span>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={speakPopupWord} className="p-1 rounded-full hover:bg-white/20 text-white transition-colors" title="Hear pronunciation">
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          <button onClick={() => setPopup(null)} className="p-1 rounded-full hover:bg-white/20 text-white transition-colors">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {/* Body */}
      <div className="p-3 text-xs space-y-1.5">
        {popup.loading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-2">
            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Looking up…
          </div>
        ) : !popup.entry ? (
          <p className="text-muted-foreground py-1">No definition found for "{popup.word}".</p>
        ) : (
          <>
            {meaning && <span className="text-[10px] font-bold uppercase tracking-wider text-azure-strong dark:text-azure bg-azure-soft px-2 py-0.5 rounded-full">{meaning.partOfSpeech}</span>}
            {def && <p className="text-foreground leading-relaxed mt-1">{def.definition}</p>}
            {def?.example && <p className="text-muted-foreground italic">"{def.example}"</p>}
            {def?.synonyms && def.synonyms.length > 0 && (
              <p className="text-muted-foreground">
                <span className="font-semibold text-foreground">Synonyms:</span> {def.synonyms.slice(0, 3).join(", ")}
              </p>
            )}
          </>
        )}
        <p className="text-[9px] text-muted-foreground/50 pt-0.5 border-t border-border">Double-click any word for definition</p>
      </div>
    </div>
  );
}

/* ─── Word of the Day section ─── */
function WordOfDaySection() {
  // getTodayEntry() returns today's word from /api/word-of-day, or null
  // when the API is unreachable — the error card with a Retry button is
  // shown in that case (no offline fallback, per the site owner's request).
  // Hold the entry in state and render nothing until it resolves.
  const [todayEntry, setTodayEntry] = useState<DictEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [activeMeaning, setActiveMeaning] = useState(0);

  // BUGFIX (stale-response race): the previous implementation stored a
  // per-call `cancelled` flag and returned it as a cleanup function that was
  // only wired up on mount. Clicking "Retry" called fetchEntry() directly,
  // so an older in-flight request was never cancelled and its LATE response
  // could overwrite the fresh one. A monotonically increasing sequence number
  // makes every outdated response a no-op instead.
  const requestSeq = useRef(0);

  const fetchEntry = useCallback(() => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(false);
    getTodayEntry().then((entry) => {
      if (requestSeq.current !== seq) return; // superseded by a newer request
      if (entry) {
        setTodayEntry(entry);
      } else {
        setError(true);
      }
      setLoading(false);
    }).catch(() => {
      if (requestSeq.current !== seq) return;
      setError(true);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    // PERF: this section sits well below the fold. Fetching the word the
    // instant the homepage mounts made the /api/word-of-day serverless call
    // compete with the Supabase content queries during the critical load
    // window. Deferring to browser-idle (fallback: 3.5s) keeps the word
    // loading "soon enough" for anyone scrolling down, while the initial
    // paint gets the whole network to itself.
    // BUGFIX (idle-callback leak): the previous version had no way to cancel
    // the pending requestIdleCallback on unmount, so `start()` could fire —
    // and kick off a fetch + setState — AFTER the section had left the page.
    let disposed = false;
    const start = () => { if (!disposed) fetchEntry(); };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let idleId: number | undefined;
    let timer: number | undefined;
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(start, { timeout: 3500 });
    } else {
      timer = window.setTimeout(start, 2000);
    }
    return () => {
      disposed = true;
      if (idleId !== undefined && typeof w.cancelIdleCallback === "function") {
        w.cancelIdleCallback(idleId);
      }
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [fetchEntry]);

  // Preload voices on mount (Chrome needs a gesture or small delay)
  useEffect(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  // Today's date label
  const todayLabel = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

  // Show loading or error state while fetching from online API
  if (loading) {
    return (
      <m.section
        initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}
        variants={sectionFadeUp}
        className="section-y cv-auto"
      >
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <SectionHeader
              title="Word of the Day"
            />
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <div className="max-w-2xl mx-auto">
              <div className="bg-card border border-gold/40 rounded-3xl overflow-hidden shadow-card">
                <div className="bg-gradient-to-r from-primary via-primary to-primary/80 px-5 py-8">
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span className="text-white/80 text-sm font-medium">Loading today's word…</span>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </m.section>
    );
  }

  if (error || !todayEntry) {
    return (
      <m.section
        initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}
        variants={sectionFadeUp}
        className="section-y cv-auto"
      >
        <div className="container mx-auto px-4">
          <ScrollReveal>
            <SectionHeader
              title="Word of the Day"
            />
          </ScrollReveal>
          <ScrollReveal delay={0.1}>
            <div className="max-w-2xl mx-auto">
              <div className="bg-card border border-gold/40 rounded-3xl overflow-hidden shadow-card">
                <div className="bg-gradient-to-r from-primary via-primary to-primary/80 px-5 py-8">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <span className="text-white/80 text-sm font-medium">Could not load today's word. Please check your connection.</span>
                    <button
                      onClick={fetchEntry}
                      className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/35 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors"
                    >
                      <RefreshCw className="w-4 h-4" /> Retry
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </m.section>
    );
  }

  const phonetic = todayEntry.phonetics?.find((p) => p.text)?.text ?? null;
  const meaning = todayEntry.meanings?.[activeMeaning] ?? todayEntry.meanings?.[0];

  // Web Speech API — works on every device, no network, no key, no blocked domains
  const speakWord = () => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(todayEntry.word);
    utter.lang = "en-US";
    utter.rate = 0.85;
    utter.pitch = 1;
    // Pick a natural English voice if available
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(v => v.lang.startsWith("en") && !v.name.includes("Google")) || voices.find(v => v.lang.startsWith("en"));
    if (enVoice) utter.voice = enVoice;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  };

  return (
    <m.section
      initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }}
      variants={sectionFadeUp}
      className="section-y cv-auto"
    >
      <div className="container mx-auto px-4">
        <ScrollReveal>
          <SectionHeader
            title="Word of the Day"
          />
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div className="max-w-2xl mx-auto">
            {/* Gold hairline frame */}
            <div className="rounded-[28px] bg-gradient-to-br from-[#E3B341] via-[#E3B341]/30 to-[#E3B341]/80 p-px shadow-card">
              <div className="overflow-hidden rounded-[27px] bg-card">

                {/* ── Hero ── */}
                <div
                  className="relative overflow-hidden px-5 pb-6 pt-5 sm:px-7 sm:pb-7 sm:pt-6 text-white"
                  style={{ background: "radial-gradient(120% 90% at 100% 0%, rgba(227,179,65,0.28) 0%, rgba(227,179,65,0) 55%), linear-gradient(135deg, #064e3b 0%, #065f46 55%, #047857 100%)" }}
                >
                  {/* oversized watermark letter */}
                  <span aria-hidden className="pointer-events-none absolute -right-2 -bottom-10 select-none font-heading italic text-[9rem] sm:text-[11rem] leading-none text-white/[0.06]">
                    {todayEntry.word.charAt(0).toUpperCase()}
                  </span>

                  <div className="relative flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E3B341]/50 bg-black/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-[#FDE68A]">
                      <span className="h-1.5 w-1.5 rotate-45 bg-[#E3B341]" /> Today
                    </span>
                    <span className="text-[11px] font-semibold tracking-wide text-white/80">{todayLabel}</span>
                  </div>

                  <div className="relative mt-5 flex items-center gap-4">
                    <button
                      onClick={speakWord}
                      aria-label="Hear pronunciation"
                      title="Tap to hear pronunciation"
                      className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FDE68A] to-[#E3B341] text-emerald-900 shadow-lg shadow-black/25 transition-transform active:scale-95 ${speaking ? "ring-4 ring-[#E3B341]/40" : ""}`}
                    >
                      {speaking && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-[#E3B341]/40" />}
                      <Volume2 className={`relative h-6 w-6 ${speaking ? "animate-pulse" : ""}`} />
                    </button>

                    <div className="min-w-0 flex-1">
                      <h3
                        className={`font-heading italic font-bold capitalize leading-[1.05] tracking-tight break-words text-white ${
                          todayEntry.word.length > 12 ? "text-3xl sm:text-4xl"
                          : todayEntry.word.length > 8 ? "text-4xl sm:text-5xl"
                          : "text-5xl sm:text-6xl"
                        }`}
                      >
                        {todayEntry.word}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {phonetic && <span className="font-heading text-[15px] italic text-[#FDE68A]">{phonetic}</span>}
                        {meaning?.partOfSpeech && (
                          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white/90">{meaning.partOfSpeech}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Part-of-speech tabs ── */}
                {(todayEntry.meanings?.length ?? 0) > 1 && (
                  <div className="flex flex-wrap gap-1.5 px-5 pt-5 sm:px-7">
                    {todayEntry.meanings.map((m, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveMeaning(i)}
                        className={`rounded-full border px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                          activeMeaning === i
                            ? "border-emerald-700 bg-emerald-800 text-white"
                            : "border-border bg-background text-muted-foreground hover:border-[#E3B341]/60"
                        }`}
                      >
                        {m.partOfSpeech}
                      </button>
                    ))}
                  </div>
                )}

                {/* ── Definitions ── */}
                {meaning && (
                  <div className="space-y-4 px-5 py-5 sm:px-7">
                    {meaning.definitions.slice(0, 3).map((def, i) => (
                      <div key={i} className={i > 0 ? "border-t border-border/60 pt-4" : ""}>
                        <div className="flex gap-3">
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#E3B341]/15 font-heading text-[12px] font-bold text-[#8a6508] dark:text-[#E3B341]">{i + 1}</span>
                          <div className="min-w-0 flex-1 space-y-2">
                            <p className="text-[15px] leading-relaxed text-foreground">{def.definition}</p>
                            {def.example && (
                              <p className="border-l-2 border-[#E3B341] pl-3 font-heading text-[14px] italic leading-relaxed text-muted-foreground">
                                “{def.example}”
                              </p>
                            )}
                            {def.synonyms?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {def.synonyms.slice(0, 4).map((syn) => (
                                  <span key={syn} className="rounded-full border border-emerald-600/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-300">{syn}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Footer ── */}
                <div className="flex items-center gap-2 border-t border-border/60 bg-muted/30 px-5 py-3 sm:px-7">
                  <BookMarked className="h-4 w-4 shrink-0 text-[#B8860B]" />
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    <span className="font-semibold text-foreground">Tip:</span> double-click any English word on this site to see its meaning. A new word every day.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </m.section>
  );
}

// ── School's own result countdown / live state ───────────────────────────
// Mirrors the exact logic already used on /results (useHasPublishedSchoolResults
// + the scheduled-result-publishes query in Results.tsx) so the homepage,
// the /results page, and the admin panel all agree on one source of truth:
// the `results` table's is_published / publish_at columns.
//
//   • If the school has published results (any row is_published = true) →
//     show a LIVE "View Result" banner and hide BISE Peshawar entirely.
//   • Else if the school has an active countdown (publish_at in the future
//     on unpublished rows) → show ONE countdown card for it (grouped by
//     publish_at, same as /results) and hide BISE Peshawar.
//   • Else (no school result, no schedule) → fall back to the BISE
//     Peshawar banner, same as before.
interface ScheduledGroup { publish_at: string; exam_type: string; year: number; classes: string[]; }

function useSchoolScheduledPublish() {
  return useQuery<ScheduledGroup[]>({
    queryKey: ["scheduled-result-publishes-raw"],
    queryFn: async () => {
      // Phase 5: cached public read (CDN s-maxage 30 s) — the homepage's
      // countdown schedule used to cost one DB query per visitor. After a
      // publish, markPublishBust (autoPublish) forces a fresh origin read.
      const data = await cachedOrDirect<
        { class: string; exam_type: string; year: number; publish_at: string }[]
      >("result-schedule", {}, async () => {
        // SECURITY: see src/lib/resultSchedule.ts — the publish schedule is
        // public, the unpublished RESULTS are not. This used to be a direct
        // read of the `results` table, which only worked because that table
        // had a blanket SELECT policy exposing every held-back result.
        const rows = await fetchResultSchedule("upcoming");
        return rows as { class: string; exam_type: string; year: number; publish_at: string }[];
      });
      if (!data || data.length === 0) return [];
      // Group by publish_at so "All Classes At Once" schedules collapse
      // into ONE countdown instead of one per class.
      const byPublishAt = new Map<string, ScheduledGroup>();
      for (const r of data) {
        const key = r.publish_at as string;
        if (!byPublishAt.has(key)) {
          byPublishAt.set(key, { publish_at: key, exam_type: r.exam_type, year: r.year, classes: [r.class] });
        } else {
          const g = byPublishAt.get(key)!;
          if (!g.classes.includes(r.class)) g.classes.push(r.class);
        }
      }
      // Sort classes on a COPY, never in place — mutating a React Query
      // cache entry's array with .sort() during render is what caused the
      // homepage "Something went wrong" crash (React detects the mutated
      // cached reference changing shape mid-render and throws).
      return Array.from(byPublishAt.values())
        .map(g => ({ ...g, classes: [...g.classes].sort(sortClassNames) }))
        .sort((a, b) => a.publish_at.localeCompare(b.publish_at));
    },
    // This used to refetch every 30 seconds for as long as the tab was open,
    // backgrounded or not. The watcher below already knows exactly when the
    // next publish is due and re-checks the cache itself, so a blind 30s poll
    // just kept the radio busy and added latency. Now it only refreshes when
    // the page is actually visible, and much less often.
    refetchInterval: (() => {
      if (typeof document !== "undefined" && document.hidden) return false;
      return 5 * 60 * 1000;
    })(),
    refetchIntervalInBackground: false,
    staleTime: 60 * 1000,
  });
}

// Arms exact-moment publishing for every active schedule while the homepage
// is open (src/lib/autoPublish.ts): server-clock sync, function pre-warm, the
// server flips the rows at 00:00:00 and the caches are updated in the same
// tick. It is the SAME publisher the Navbar strip and /results use — each
// publish_at is handled exactly once app-wide — so the old per-page polling
// watcher (raw phone clock + DB polling + blind invalidations, which raced the
// publisher and made the UI flicker) is gone.
function useHomeAutoPublishWatcher(schedules: ScheduledGroup[]) {
  const qc = useQueryClient();
  const key = schedules.map((s) => s.publish_at).join("|");
  useEffect(() => {
    if (!key) return;
    return armAutoPublish(key.split("|"), qc);
  }, [key, qc]);
}

function SchoolCountdownText({ targetDate }: { targetDate: string }) {
  const [text, setText] = useState("");
  useEffect(() => {
    const calc = () => {
      const diff = new Date(targetDate).getTime() - Date.now();
      if (diff <= 0) { setText("Publishing now…"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setText(`${d}d ${h}h ${m}m ${s}s`);
      else if (h > 0) setText(`${h}h ${m}m ${s}s`);
      else setText(`${m}m ${s}s`);
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [targetDate]);
  return <span className="font-mono font-bold tracking-wider">{text}</span>;
}

// ── Hero heading typewriter — "Where bright minds find their light." ──────
// Types out character-by-character across styled segments (gold spans +
// line breaks preserved), holds the finished line, deletes it, then loops
// forever. Segment-aware so the gold highlight colour and <br/> placement
// never break mid-type, unlike a naive plain-string typewriter.
type HeroSegment = { text: string; gold?: boolean; breakAfter?: boolean };
const HERO_SEGMENTS: HeroSegment[] = [
  { text: "Where " },
  { text: "bright", gold: true },
  { text: " ", breakAfter: true },
  { text: "minds" },
  { text: " find their", breakAfter: true },
  { text: "light.", gold: true },
];
const HERO_FULL_LENGTH = HERO_SEGMENTS.reduce((n, s) => n + s.text.length, 0);

function useHeroTypewriter() {
  const reduced = typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // PERF (LCP): start with the FULL heading so the first paint (and the prerendered
  // HTML) already contains the real LCP text. Starting at 0 made the heading
  // invisible until JS hydrated (~4.6 s on slow 4G). The type/delete loop still
  // runs afterwards, after a longer first hold so it never competes with load.
  const [count, setCount] = useState(HERO_FULL_LENGTH);
  const firstHold = useRef(true);
  const [deleting, setDeleting] = useState(false);
  // A decorative heading must not keep re-rendering a background tab. This
  // effect re-runs ~20×/second forever, so on a phone that is real, constant
  // main-thread work competing with scrolling and page paint.
  const [tabActive, setTabActive] = useState(
    typeof document === "undefined" ? true : !document.hidden
  );

  useEffect(() => {
    if (typeof document === "undefined") return;
    const sync = () => setTabActive(!document.hidden);
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  useEffect(() => {
    if (reduced) return; // static full heading, no animation loop
    if (!tabActive) return; // paused while the tab is in the background
    const TYPE_MS = 62;
    const DELETE_MS = 34;
    const HOLD_MS = 2200;
    const RESTART_MS = 500;

    let timer: ReturnType<typeof setTimeout>;

    if (!deleting && count < HERO_FULL_LENGTH) {
      timer = setTimeout(() => setCount(c => c + 1), TYPE_MS);
    } else if (!deleting && count === HERO_FULL_LENGTH) {
      timer = setTimeout(() => setDeleting(true), firstHold.current ? 7000 : HOLD_MS);
      firstHold.current = false;
    } else if (deleting && count > 0) {
      timer = setTimeout(() => setCount(c => c - 1), DELETE_MS);
    } else {
      // count === 0 && deleting — brief pause, then start typing again.
      timer = setTimeout(() => setDeleting(false), RESTART_MS);
    }

    return () => clearTimeout(timer);
  }, [count, deleting, tabActive]);

  // Slice the segment list down to `count` visible characters, preserving
  // each segment's gold/breakAfter flags for however much of it is shown.
  const visible: HeroSegment[] = [];
  let remaining = count;
  for (const seg of HERO_SEGMENTS) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, seg.text.length);
    visible.push({ text: seg.text.slice(0, take), gold: seg.gold, breakAfter: take === seg.text.length && seg.breakAfter });
    remaining -= take;
  }
  return visible;
}

function HeroTypewriterHeading({ className, textColor }: { className: string; textColor: string }) {
  const segments = useHeroTypewriter();
  const reduced = typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // PERF: the FULL heading is rendered invisibly to reserve its exact height,
  // and the typed text is overlaid on top. Previously the h1 grew one line at
  // a time while typing, so the whole hero re-centred and re-flowed ~16 times
  // per second — the "stuck / shaky" feel on the homepage. Now the layout is
  // fixed; only the overlay text changes. (The full sentence also stays in
  // the DOM for search engines and screen readers.)
  return (
    <m.h1
      variants={stagger.child}
      className={`${className} ${textColor} relative`}
      aria-label="Where bright minds find their light."
    >
      <span className="block invisible" aria-hidden="true">
        {HERO_SEGMENTS.map((seg, i) => (
          <span key={i}>
            <span className={seg.gold ? "lux-gold-text" : undefined}>{seg.text}</span>
            {seg.breakAfter && <br />}
          </span>
        ))}
      </span>
      <span className="block absolute inset-0" aria-hidden="true">
        {segments.map((seg, i) => (
          <span key={i}>
            <span className={seg.gold ? "lux-gold-text" : undefined}>{seg.text}</span>
            {seg.breakAfter && <br />}
          </span>
        ))}
        {!reduced && (
          <span className="inline-block w-[2px] h-[0.85em] -mb-[0.1em] ml-0.5 bg-[hsl(38_80%_40%)] dark:bg-[hsl(42_78%_62%)] align-middle" aria-hidden="true" />
        )}
      </span>
    </m.h1>
  );
}

// ── Homepage auto-publish watcher (no visible banner) ────────────────────
// The countdown banner itself was removed from the homepage per request —
// the countdown now lives only on /results. This component is kept mounted
// on Home purely so the auto-publish trigger (useHomeAutoPublishWatcher)
// still fires the instant any active schedule reaches zero, even if the
// visitor never opens /results. It renders nothing.
function HomeResultsBanner() {
  const { data: schedules = [] } = useSchoolScheduledPublish();
  useHomeAutoPublishWatcher(schedules);
  return null;
}

/* ══════════════════════════════════
   MAIN HOME COMPONENT
══════════════════════════════════ */
/* ─── Explore the site (bottom quick-links) ───────────────────────────────
   Lives at the END of the homepage, just above the footer, so visitors who
   scrolled the whole page get a one-tap route to every section.
   SEO: still a real <nav> of descriptive <a> links to EVERY public page.
   LIVE: nothing here is hardcoded copy that can go stale — the admission
   title / status / countdown come from the admin's admission settings, the
   notices card shows the latest published notice, the results card reflects
   the scheduled publish date, and the teachers / about / contact cards read
   the school settings. Cards fall back to neutral wording when data is
   missing, never to a wrong claim. */
interface ExploreSectionProps {
  settings?: { total_teachers?: number; established_year?: number; phone?: string | null } | null;
  admissionCfg?: Parameters<typeof getAdmissionState>[0];
  notices: Notice[];
  schedules: ScheduledGroup[];
}

type ExploreTone = "open" | "soon" | "closed" | "urgent" | "new";
interface ExploreItem {
  to: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  badge?: { label: string; tone: ExploreTone };
}

const TONE_CLASS: Record<ExploreTone, string> = {
  open:   "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  soon:   "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30",
  closed: "bg-muted text-muted-foreground border-border",
  urgent: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30",
  new:    "bg-primary/10 text-primary border-primary/25",
};
const DOT_CLASS: Record<ExploreTone, string> = {
  open: "bg-emerald-500", soon: "bg-amber-500", closed: "bg-muted-foreground/60",
  urgent: "bg-rose-500", new: "bg-primary",
};

const ExploreBadge = ({ label, tone }: { label: string; tone: ExploreTone }) => (
  <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-[2px] text-[9.5px] font-bold uppercase tracking-wider ${TONE_CLASS[tone]}`}>
    <span className="relative flex h-1.5 w-1.5">
      {(tone === "open" || tone === "urgent") && (
        <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 motion-safe:animate-ping ${DOT_CLASS[tone]}`} />
      )}
      <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${DOT_CLASS[tone]}`} />
    </span>
    {label}
  </span>
);

const ExploreSection = ({ settings, admissionCfg, notices, schedules }: ExploreSectionProps) => {
  const reduce = useReducedMotion();

  // ── Admissions: title, status and countdown all follow the admin settings.
  const adm = admissionCfg ? getAdmissionState(admissionCfg) : null;
  const session = admissionCfg?.session_year?.trim();
  const admTitle = session ? `Admissions ${session}` : "Admissions";
  let admDesc = "Apply online — no account needed";
  let admBadge: ExploreItem["badge"];
  if (adm) {
    if (adm.open) {
      admBadge = { label: "Open", tone: "open" };
      if (adm.daysLeft !== null) {
        admDesc = adm.daysLeft <= 1
          ? "Last day to apply — no account needed"
          : `Apply online · closes in ${adm.daysLeft} days`;
      }
    } else if (adm.reason === "not_started") {
      admBadge = { label: "Soon", tone: "soon" };
      admDesc = adm.daysToStart !== null && adm.daysToStart > 0
        ? `Applications open in ${adm.daysToStart} day${adm.daysToStart === 1 ? "" : "s"}`
        : "Applications open soon";
    } else {
      admBadge = { label: "Closed", tone: "closed" };
      admDesc = "Applications closed · track your application";
    }
  }

  // ── Results: show the next scheduled publish when the school has one.
  const nextResult = schedules[0];
  let resDesc = "BISE Peshawar & school results by roll number";
  let resBadge: ExploreItem["badge"];
  if (nextResult) {
    const when = new Date(nextResult.publish_at);
    if (!isNaN(when.getTime())) {
      resBadge = { label: "Soon", tone: "soon" };
      resDesc = `${nextResult.exam_type || "Result"}${nextResult.year ? ` ${nextResult.year}` : ""} · ${format(when, "d MMM, h:mm a")}`;
    }
  }

  // ── Notices: latest published notice (+ urgent / new flag).
  const latest = notices[0];
  const hasUrgent = notices.some((n) => n.is_urgent);
  const isFresh = latest ? Date.now() - new Date(latest.created_at).getTime() < 3 * 86400000 : false;
  const noticeDesc = latest?.title ? `Latest: ${latest.title}` : "Official announcements & exam schedules";
  const noticeBadge: ExploreItem["badge"] = hasUrgent
    ? { label: "Urgent", tone: "urgent" }
    : isFresh ? { label: "New", tone: "new" } : undefined;

  const staff = settings?.total_teachers ? `${settings.total_teachers}+ staff` : "Staff directory";
  const aboutDesc = settings?.established_year
    ? `Our history, mission & vision since ${settings.established_year}`
    : "Our history, mission & vision";
  const contactDesc = settings?.phone
    ? `Call ${settings.phone} · WhatsApp & map`
    : "Phone, WhatsApp, location map & contact form";

  const items: ExploreItem[] = [
    { to: "/admission",    icon: UserPlus,   title: admTitle,         desc: admDesc,  badge: admBadge },
    { to: "/results",      icon: BarChart3,  title: "Exam Results",   desc: resDesc,  badge: resBadge },
    { to: "/merit-list",   icon: Trophy,     title: "Merit List",     desc: "Official rankings & position holders" },
    { to: "/roll-no-slip", icon: BookMarked, title: "Roll No. Slip",  desc: "View & download your slip with QR code" },
    { to: "/notices",      icon: Bell,       title: "Notices",        desc: noticeDesc, badge: noticeBadge },
    { to: "/teachers",     icon: Users,      title: "Our Teachers",   desc: `${staff} · subjects & qualifications` },
    { to: "/about",        icon: BookOpen,   title: "About Us",       desc: aboutDesc },
    { to: "/faq",          icon: Lightbulb,  title: "FAQs",           desc: "Answers to common admission & exam questions" },
    { to: "/contact",      icon: Phone,      title: "Contact Us",     desc: contactDesc },
  ];

  return (
    <section
      className="relative overflow-hidden bg-gradient-to-b from-background via-secondary/30 to-background py-10 md:py-16"
      aria-label="Explore the website"
    >
      <div className="container mx-auto px-3.5 sm:px-4">
        <div className="mb-6 text-center md:mb-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 eyebrow">
            <span className="h-1.5 w-1.5 rotate-45 bg-gold" />Explore
          </span>
          <h2 className="section-title !text-[1.7rem] sm:!text-4xl">Everything on This Website</h2>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-gold/70" />
            <span className="h-1.5 w-1.5 rotate-45 bg-gold" />
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-gold/70" />
          </div>
          <p className="section-subtitle !text-[13px] sm:!text-base">
            Admissions, results, notices and every school section — one tap away
          </p>
        </div>

        <nav className="mx-auto grid max-w-5xl grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 lg:gap-4" aria-label="Website sections">
          {items.map(({ to, icon: Icon, title, desc, badge }, i) => {
            const featured = i === 0;
            return (
              <m.div
                key={to}
                className={featured ? "sm:col-span-2 lg:col-span-3" : ""}
                initial={reduce ? false : { opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.35, delay: Math.min(i, 5) * 0.05 }}
              >
                <Link
                  to={to}
                  className={`group relative flex min-h-[60px] min-w-0 items-center gap-3 overflow-hidden rounded-2xl border p-3 shadow-card transition-all duration-200 active:scale-[0.985] sm:p-4 card-lift ${
                    featured
                      ? "border-gold/50 bg-gradient-to-br from-card via-card to-gold/10"
                      : "border-border/70 bg-card"
                  }`}
                >
                  {featured && <span className="pointer-events-none absolute inset-x-5 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />}
                  <span className="lux-tile h-10 w-10 shrink-0 sm:h-11 sm:w-11">
                    <Icon className="h-[18px] w-[18px] sm:h-5 sm:w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-heading text-[14px] font-bold text-foreground sm:text-[15px]">{title}</span>
                      {badge && <ExploreBadge label={badge.label} tone={badge.tone} />}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[11.5px] leading-snug text-muted-foreground sm:text-xs">{desc}</span>
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary"
                    aria-hidden="true"
                  />
                </Link>
              </m.div>
            );
          })}
        </nav>
      </div>
    </section>
  );
};

const Home = () => {
  // PERF: the old hero parallax (useScroll + useTransform on y/opacity) ran
  // JavaScript on EVERY scroll event and forced the whole hero to repaint —
  // the main cause of the sticky/hanging scroll feel. The hero now simply
  // scrolls away like normal content.

  const statsRef    = useRef(null);
  const statsInView = useInView(statsRef, { once: true, margin: "-100px" });

  const { data: settings,          isLoading: settingsLoading }      = useSchoolSettings();
  const { data: admissionCfg } = useAdmissionSettings();
  const admissionFee = admissionCfg?.processing_fee;
  // Admin switched admission off → only "Apply Online" is locked; everything else stays.
  const applyClosed = Boolean(admissionCfg) && !getAdmissionState(admissionCfg).open;
  const { data: notices = [],      isLoading: noticesLoading }        = useNotices(4);
  // Same query key as HomeResultsBanner → React Query shares one cached request.
  const { data: exploreSchedules = [] } = useSchoolScheduledPublish();
  const { data: teachers = [],     isLoading: teachersLoading }       = useTeachers(4);

  // Track if banner image failed to load — show fallback bg instead of broken icon
  const [bannerFailed, setBannerFailed] = useState(false);
  const [bannerUsingOriginal, setBannerUsingOriginal] = useState(false);
  const [principalUsingOriginal, setPrincipalUsingOriginal] = useState(false);
  const [principalFailed, setPrincipalFailed] = useState(false);
  // Reset banner failed state when URL changes
  useEffect(() => {
    setBannerFailed(false);
    setBannerUsingOriginal(false);
  }, [settings?.banner_url]);
  useEffect(() => {
    setPrincipalUsingOriginal(false);
    setPrincipalFailed(false);
  }, [settings?.principal_photo_url]);

  // TTS player state — when set, the bottom TTS bar renders & auto-plays.
  // Wired up by the notices' onListen handlers (EditorialNoticeCard / poll cards).
  const [ttsItem, setTtsItem] = useState<{ title: string; content: string } | null>(null);

  const hasBannerPhoto = !!(settings?.banner_url && !bannerFailed);
  // The banner photo now renders inside a hexagon badge instead of as a
  // full-bleed background, so hero text/overlay always use the "no photo"
  // (light gradient background) styling regardless of whether a banner exists.
  const heroOverlay = "bg-transparent";
  const heroBadgeBg   = "bg-card/70 border border-azure/30 text-foreground/90";
  const heroTextColor = "lux-ink";
  const heroSubColor  = "text-foreground/80";
  const heroDescColor = "lux-soft";
  const heroCursorColor = "bg-primary/80";
  const heroStatCard = "bg-card border border-border";


  return (
    <>
    <PageLayout>

      {/* Invisible — keeps the auto-publish watcher alive on the homepage.
          The visible countdown banner now lives only on /results. */}
      <HomeResultsBanner />

      {/* ══ 2. HERO — deep emerald · deep gold (premium) ══ */}
      <section id="hero-section" className="lux-hero lux-hero-deep relative md:min-h-[88vh] flex items-start md:items-center overflow-hidden">
        <div className="absolute inset-0 lux-grid" aria-hidden="true" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[hsl(40_80%_45%)] to-transparent opacity-70" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[hsl(42_85%_58%)] to-transparent" aria-hidden="true" />

        <div className="container mx-auto px-5 sm:px-6 relative z-10 pt-9 pb-20 md:pt-6 md:pb-28">
          <div className="grid grid-cols-1 gap-10 items-center">
            <m.div initial={false} animate="visible" variants={stagger.parent} className="max-w-2xl relative min-w-0">

              <m.div variants={stagger.child}>
                <span className="lux-chip inline-flex max-w-full items-center gap-2.5 rounded-full pl-2 pr-4 py-1.5 text-[10.5px] sm:text-xs font-semibold tracking-[0.14em] uppercase">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(45_92%_62%)] to-[hsl(36_85%_42%)] text-white shrink-0"><Award className="w-3.5 h-3.5" /></span>
                  <span className="min-w-0 leading-snug">{settings?.established_year ? `Est. ${settings.established_year} · ` : ""}HSSC (1st Year & 2nd Year)</span>
                </span>
              </m.div>

              <HeroTypewriterHeading
                className="mt-5 sm:mt-6 text-[3.2rem] leading-[0.98] sm:text-[4.3rem] md:text-[5.2rem] lg:text-[6rem] premium-display"
                textColor={heroTextColor}
              />

              <m.p variants={stagger.child} className={`mt-4 sm:mt-5 text-[16px] md:text-lg ${heroDescColor} max-w-xl leading-relaxed`}>
                {settings?.description || "Government Higher Secondary School Ghallanai is committed to providing quality education and nurturing the future leaders of Pakistan."}
              </m.p>

              <m.div variants={stagger.child} className="mt-7 flex flex-wrap items-center gap-3">
                <Link to="/results" className="lux-btn lux-btn-ink">
                  View Results <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/about" aria-label="Learn more about our school" className="lux-btn lux-btn-line">
                  Learn more
                </Link>
              </m.div>
            </m.div>
          </div>
        </div>
      </section>

      {/* ══ 3. STATS BAR ══ */}
      <m.section initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} variants={sectionFadeUp} className="relative z-20 -mt-10">
        <div className="container mx-auto px-4">
          <ScrollStage variant="zoom">
          <div className="relative overflow-hidden bg-card rounded-3xl shadow-elevated border border-gold/30 p-3 md:p-5">
            <div className="absolute inset-x-6 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
            <div className="orb orb-gold w-56 h-56 -top-24 -right-16 opacity-70" />
            <div className="relative grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
              {settingsLoading ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`flex flex-col items-center gap-2 py-4 rounded-2xl border border-border ${i === 4 ? "col-span-2 md:col-span-1" : ""}`}><Skeleton className="h-7 w-16" /><Skeleton className="h-3 w-14" /></div>
              )) : (
                <>
                  {settings?.total_students ? <CountStat value={settings.total_students} suffix="+" label="Students" /> : null}
                  {settings?.total_teachers ? <CountStat value={settings.total_teachers} suffix="+" label="Teachers" /> : null}
                  {settings?.pass_percentage ? <CountStat value={settings.pass_percentage} suffix="%" label="Pass Rate" /> : null}
                  {settings?.established_year ? <CountStat value={settings.established_year} label="Established" /> : null}
                  <TextStat value={settings?.board_results || "A+"}   label="Results" wide />
                </>
              )}
            </div>
          </div>
          </ScrollStage>
        </div>
      </m.section>

      {/* ══ 4. SUBJECTS MARQUEE ══ */}
      <section className="py-5 bg-gradient-to-b from-secondary/40 to-background overflow-hidden border-y border-gold/20 mt-16" style={{ contain: "layout paint" }}>
        <div className="relative flex overflow-hidden">
          {/* PERF: translate3d + will-change promote this to a GPU-composited
              layer so the marquee never hits the main thread (Lighthouse
              "Avoid non-composited animations" fix). The two identical copies
              of the subject list let the keyframe translate exactly -50% for
              a seamless loop with no visible jump. */}
          <div
            className="flex gap-8 shrink-0"
            style={{
              animation: "marqueeScroll 40s linear infinite",
              willChange: "transform",
              transform: "translate3d(0,0,0)",
              backfaceVisibility: "hidden",
            }}
          >
            {["📐 Mathematics","⚡ Physics","🧪 Chemistry","🌿 Biology","📖 English","✍️ Urdu","🗺️ Pakistan Studies","☪️ Islamiyat","💻 Computer Science","📗 Mutalia Quran","🔬 General Science","🌍 Geography","🏛️ History","🪶 Pashto","🕌 Arabic",
              "📐 Mathematics","⚡ Physics","🧪 Chemistry","🌿 Biology","📖 English","✍️ Urdu","🗺️ Pakistan Studies","☪️ Islamiyat","💻 Computer Science","📗 Mutalia Quran","🔬 General Science","🌍 Geography","🏛️ History","🪶 Pashto","🕌 Arabic"]
              .map((s, i) => {
                const [emoji, ...rest] = s.split(" ");
                return (
                  <div key={i} className="flex items-center gap-2 shrink-0 pl-2 pr-4 py-1 rounded-full bg-card border border-border/80 shadow-sm">
                    <span className="text-lg">{emoji}</span>
                    <span className="text-sm font-semibold text-foreground whitespace-nowrap">{rest.join(" ")}</span>
                  </div>
                );
              })}
          </div>
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10" />
        </div>
        <style>{`@keyframes marqueeScroll { 0% { transform: translate3d(0,0,0); } 100% { transform: translate3d(-50%,0,0); } }`}</style>
      </section>

      {/* ══ 5. CAMPUS BANNER ══
          Full-bleed photo (the admin-uploaded banner_url) with a dark
          gradient overlay fading up from the bottom, an eyebrow label, and a
          large serif headline — matching the reference: "CAMPUS · <LOCATION>"
          above "A place shaped by mountains, made for learners." Sits above
          "Why Choose Us" as requested. Only renders when the admin has
          actually uploaded a banner image. */}
      {settings?.banner_url && !bannerFailed && (
        <m.section
          initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }} variants={sectionFadeUp}
          className="container mx-auto px-4 mt-10 md:mt-14"
        >
          <ScrollStage variant="zoom">
          <div className="relative w-full h-[15rem] sm:h-[18rem] md:h-[22rem] overflow-hidden rounded-2xl border border-gold/50 shadow-elevated">
            <img
              src={bannerUsingOriginal
                ? settings.banner_url
                : (optimizedCloudinaryUrl(settings.banner_url, { width: 1600 }) || settings.banner_url)}
              {...(!bannerUsingOriginal && {
                srcSet: [
                  `${optimizedCloudinaryUrl(settings.banner_url, { width: 800 })} 800w`,
                  `${optimizedCloudinaryUrl(settings.banner_url, { width: 1200 })} 1200w`,
                  `${optimizedCloudinaryUrl(settings.banner_url, { width: 1600 })} 1600w`,
                ].join(", "),
              })}
              sizes="(min-width: 1280px) 1152px, 100vw"
              alt="School campus"
              width={1600}
              height={600}
              className="absolute inset-0 w-full h-full object-cover object-center"
              loading="lazy"
              decoding="async"
              onError={(event) => {
                // A browser may reject a responsive Cloudinary transform or
                // choose a srcset candidate that is unavailable at its edge.
                // Retry the known-good original before hiding the whole banner.
                if (!bannerUsingOriginal) {
                  event.currentTarget.removeAttribute("srcset");
                  setBannerUsingOriginal(true);
                } else {
                  setBannerFailed(true);
                }
              }}
            />
            {/* dark gradient rising from the bottom so the overlaid text stays readable */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-end">
              <div className="px-5 sm:px-7 md:px-10 pb-6 md:pb-9">
                <span className="inline-flex items-center gap-2 rounded-full border border-gold/60 bg-black/30 px-3.5 py-1 text-gold text-[10px] md:text-xs font-bold uppercase tracking-[0.22em] mb-3">
                  <MapPin className="w-3 h-3" /> Campus · Mohmand
                </span>
                <h2 className="font-display text-2xl sm:text-3xl md:text-5xl font-medium text-white leading-tight max-w-2xl">
                  A place shaped by mountains, made for learners.
                </h2>
              </div>
            </div>
          </div>
          </ScrollStage>
        </m.section>
      )}

      {/* ══ 6. WHY CHOOSE US ══ */}
      <m.section initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} variants={sectionFadeUp} className="section-y bg-background cv-auto">
        <div className="container mx-auto px-4">
          <ScrollReveal><SectionHeader eyebrow="Our Strengths" title="Why Choose Us" subtitle="We provide a comprehensive educational experience that nurtures young minds" /></ScrollReveal>
          <ScrollStage>
          <m.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger.parent} className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 max-w-5xl mx-auto">
            {features.map((f, idx) => (
              <ScrollReveal key={f.title} delay={idx * 0.08}>
                <m.div variants={stagger.child} whileHover={{ y: -6 }} whileTap={{ scale: 0.98 }}
                  className="group relative overflow-hidden bg-card rounded-2xl p-6 shadow-card hover:shadow-elevated transition-all duration-300 border border-border/80 hover:border-gold/60 h-full">
                  <div className="orb orb-gold w-44 h-44 -top-16 -right-16 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <span aria-hidden="true" className="absolute top-4 right-5 font-heading text-4xl font-bold text-gold/20 select-none">0{idx + 1}</span>
                  <div className="relative w-12 h-12 rounded-xl gradient-hero text-gold flex items-center justify-center mb-4 shadow-card">
                    <f.icon className="w-6 h-6" />
                  </div>
                  <h3 className="relative font-heading font-bold text-foreground text-lg">{f.title}</h3>
                  <p className="relative text-sm text-muted-foreground mt-2 leading-relaxed">{f.desc}</p>
                  <div className="relative mt-4 h-[2px] w-10 bg-gradient-to-r from-gold to-transparent group-hover:w-20 transition-all duration-500" />
                </m.div>
              </ScrollReveal>
            ))}
          </m.div>
          </ScrollStage>
        </div>
      </m.section>

      {/* ══ 8. WORD OF THE DAY ══ */}
      <WordOfDaySection />


      {/* ══ 9. LATEST NOTICES ══ */}
      <m.section initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} variants={sectionFadeUp} className="section-y bg-background cv-auto">
        <div className="container mx-auto px-4">
          {/* ── Premium section header ── */}
          <div className="mb-8 md:mb-12 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1 eyebrow">
                <Bell className="w-3 h-3" /> Announcements
              </span>
              <h2 className="section-title">Latest Notices</h2>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                Official notices and announcements from our school administration.
              </p>
            </div>
            <Link to="/notices" className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border/80 bg-card px-4 h-8 text-xs font-semibold text-foreground hover:border-gold/60 hover:text-primary transition-colors">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <ScrollStage>
          {noticesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
            </div>
          ) : notices.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-2xl border border-border">
              <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">No notices published yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {notices.map((notice, i) => (
                notice.is_poll ? (
                  <NoticePollCard key={notice.id} item={notice} index={i} />
                ) : (
                  <EditorialNoticeCard
                    key={notice.id}
                    item={notice}
                    index={i}
                    onListen={(it: Notice, e: React.MouseEvent) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setTtsItem({ title: it.title, content: it.content || it.title });
                    }}
                  />
                )
              ))}
            </div>
          )}
          </ScrollStage>
        </div>
      </m.section>

      {/* ══ 11. TEACHERS ══ */}
      <m.section initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} variants={sectionFadeUp} className="section-y bg-background cv-auto">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-10">
            <div><span className="eyebrow">Our Faculty</span><h2 className="section-title">Meet Our Teachers</h2></div>
            <Link to="/teachers" className="shrink-0 inline-flex items-center gap-1 rounded-full border border-border/80 bg-card px-4 h-8 text-xs font-semibold text-foreground hover:border-gold/60 hover:text-primary transition-colors">All Teachers <ChevronRight className="w-3.5 h-3.5" /></Link>
          </div>
          <ScrollStage variant="zoom">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {teachersLoading ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl p-4 sm:p-6 text-center shadow-card"><Skeleton className="w-16 h-16 sm:w-20 sm:h-20 rounded-full mx-auto mb-4" /><Skeleton className="h-5 w-2/3 mx-auto mb-2" /><Skeleton className="h-3 w-1/2 mx-auto" /></div>
            )) : teachers.map((teacher) => (
              <m.div key={teacher.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} whileHover={{ y: -6 }}
                className="bg-card rounded-xl p-4 text-center shadow-card hover:shadow-elevated transition-all duration-300 border border-border/70 hover:border-gold/50 group">
                {teacher.photo_url
                  ? <img src={optimizedCloudinaryUrl(teacher.photo_url, { width: 128 }) || teacher.photo_url} alt={teacher.full_name} width={64} height={64} loading="lazy" decoding="async" className="w-16 h-16 rounded-full mx-auto mb-3 object-cover ring-2 ring-secondary group-hover:ring-primary/30 transition-all" />
                  : <div className="w-16 h-16 rounded-full mx-auto mb-3 bg-primary flex items-center justify-center text-white text-lg font-heading font-bold">{(teacher.full_name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2)}</div>
                }
                <h3 className="font-heading font-semibold text-[15px] text-foreground leading-snug">{teacher.full_name}</h3>
                {teacher.subject       && <p className="text-[13px] text-muted-foreground font-medium mt-0.5">{teacher.subject}</p>}
                {teacher.qualification && <p className="text-xs text-muted-foreground/80 mt-0.5">{teacher.qualification}</p>}
              </m.div>
            ))}
          </div>
          </ScrollStage>
        </div>
      </m.section>

      {/* ══ 13. DAILY QUOTE ══ */}
      <m.section initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} variants={sectionFadeUp} className="section-y bg-background cv-auto">
        <div className="container mx-auto px-4 max-w-4xl">
          <ScrollReveal><SectionHeader eyebrow="Daily Inspiration" title="Thought of the Day" /></ScrollReveal>
          <ScrollStage variant="zoom"><DailyQuoteCard /></ScrollStage>
        </div>
      </m.section>

      {/* ══ 15. ADMISSION — ACCURATE-MIRROR FLOW (rebuilt 01-Nov-2026) ══
          Online admission flow for Intermediate (1st/2nd Year) admissions.
          Full portal: /admission (register, login, profiles, apply, pay,
          track). */}
      <m.section initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} variants={sectionFadeUp} className="section-y relative overflow-hidden cv-auto">
        <div className="container mx-auto px-4 relative z-10">
          <div className="relative overflow-hidden rounded-[1.75rem] border border-gold/35 bg-gradient-to-br from-card via-card to-gold/[0.08] shadow-[0_24px_50px_-30px_hsl(var(--foreground)/.35)]">
            <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent" aria-hidden="true" />
            <div className="luxe-blob w-[260px] h-[260px] -top-28 -right-16 bg-[hsl(42_90%_60%/.16)] pointer-events-none" aria-hidden="true" />

            <div className="relative grid lg:grid-cols-[1.1fr_1fr] gap-6 lg:gap-10 p-5 sm:p-9">
              {/* Left: copy + CTAs */}
              <div className="text-center lg:text-left">
                <div className="mb-4 flex flex-wrap items-center justify-center lg:justify-start gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-foreground">
                    <span className={`h-1.5 w-1.5 rounded-full ${applyClosed ? "bg-red-500" : "bg-green-500 animate-pulse"}`} /> {applyClosed ? "Admissions Closed" : "Admissions Open"}
                  </span>
                  <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-gold-strong dark:text-gold">{applyClosed ? "Session —" : "Session 2026–27"}</span>
                </div>
                <h2 className="font-luxe text-[2.4rem] sm:text-6xl font-bold leading-[1] text-foreground">
                  Intermediate <span className="italic lux-gold-text">Admissions</span>
                </h2>
                <div className="luxe-orn my-4 lg:justify-start lg:[&::before]:hidden"><i /></div>
                <p className="mx-auto lg:mx-0 mb-6 max-w-xl text-[13.5px] sm:text-[15px] leading-relaxed text-muted-foreground">
                  Apply for 1st Year and 2nd Year in Arts, Pre-Medical, Pre-Engineering and ICS through our
                  online admission system. Fill in your personal and matric details, submit your
                  application and pay the {admissionFee ? <>Rs&nbsp;{admissionFee} </> : null}processing fee online with Easypaisa or a wallet.
                </p>
                <div className="grid grid-cols-2 gap-2.5 sm:flex sm:justify-center lg:justify-start">
                  {applyClosed ? (
                    <button type="button" disabled aria-disabled="true" title="Online admission is currently closed" className="inline-flex h-11 cursor-not-allowed items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-muted px-5 text-[13px] font-bold tracking-wide text-muted-foreground opacity-80">
                      <Lock className="w-4 h-4" strokeWidth={2} /> Apply Online
                    </button>
                  ) : (
                  <Link to="/admission/portal" className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-primary px-5 text-[13px] font-bold tracking-wide text-primary-foreground shadow-[0_12px_24px_-12px_hsl(var(--primary)/.8)] transition-all active:scale-[0.97] hover:brightness-110">
                    <UserPlus className="w-4 h-4" strokeWidth={2} /> Apply Online
                  </Link>
                  )}
                  <Link to="/admission#track" className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-gold/50 bg-card px-5 text-[13px] font-semibold tracking-wide text-foreground transition-colors hover:bg-gold/10 active:scale-[0.97]">
                    <Search className="w-4 h-4 text-gold" strokeWidth={2} /> Track Application
                  </Link>
                </div>
                <p className="mt-4 text-[11.5px] leading-relaxed text-muted-foreground">
                  Online applications only. Submit a separate application for each quota or program.
                </p>
              </div>

              {/* Right: how it works (5 steps) */}
              <div className="rounded-2xl border border-border bg-muted/40 p-5 sm:p-7">
                <p className="eyebrow mb-4 justify-center lg:justify-start">How it works</p>
                <ol className="relative">
                  {[
                    ["Complete Profiles", "CNIC or Form-B, personal and Matric (SSC) details"],
                    ["Submit Application", "Program, quota and security check"],
                    [admissionFee ? `Pay Rs ${admissionFee} Fee` : "Pay Processing Fee", "Online via Easypaisa or wallet"],
                    ["Track Application", "Tracking ID and status"],
                    ["Visit College", "Print form, bring original documents"],
                  ].map(([t, d], i, arr) => (
                    <li key={t} className="relative flex items-start gap-3.5 pb-4 last:pb-0">
                      {i < arr.length - 1 && <span aria-hidden className="absolute left-[13px] top-7 bottom-0 w-px bg-gold/40" />}
                      <span className="relative z-10 flex h-[27px] w-[27px] shrink-0 items-center justify-center rounded-full border border-gold bg-card text-[11px] font-bold text-gold-strong dark:text-gold">{i + 1}</span>
                      <div className="min-w-0 text-left">
                        <p className="font-luxe text-[1.2rem] font-bold leading-tight text-foreground">{t}</p>
                        <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{d}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </div>
      </m.section>

      {/* ══ 16. ABOUT PREVIEW ══ */}
      <m.section initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.1 }} variants={sectionFadeUp} className="section-y cv-auto relative overflow-hidden bg-background">
        <div className="absolute inset-0 opacity-40 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full border border-border/70" />
          <div className="absolute -bottom-24 -left-24 w-[22rem] h-[22rem] rounded-full border border-border/70" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <ScrollReveal direction="left">
              <div className="text-foreground text-center lg:text-left">
                <span className="eyebrow">About Us</span>
                <h2 className="mt-2 font-luxe text-[2.5rem] sm:text-6xl font-bold leading-[1] text-foreground">
                  Building <span className="italic lux-gold-text">Future Leaders</span>{settings?.established_year ? <span className="mt-1 block text-[0.5em] font-semibold tracking-wide text-muted-foreground">Since {settings.established_year}</span> : null}
                </h2>
                <div className="luxe-orn my-4 lg:justify-start lg:[&::before]:hidden"><i /></div>
                <p className="mx-auto lg:mx-0 mb-6 max-w-xl text-[14px] sm:text-base leading-relaxed text-muted-foreground">
                  {settings?.description || "Government Higher Secondary School Ghallanai has been serving the community of District Mohmand with dedication and excellence. We believe in nurturing every student's potential through quality education and modern teaching methodologies."}
                </p>
                <div className="mx-auto lg:mx-0 mb-7 grid max-w-xl gap-2.5 text-left">
                  {[
                    { icon: MapPin, label: "Address", text: settings?.address || "Ghallanai, District Mohmand, KPK" },
                    { icon: Phone,  label: "Phone",   text: settings?.phone   || "" },
                    { icon: Mail,   label: "Email",   text: settings?.email   || "" },
                  ].filter((it) => it.text).map((item, i) => (
                    <m.div key={i} initial={{ opacity: 0, x: -16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
                      className="luxe-tile-card flex items-center gap-3 !rounded-2xl px-3.5 py-2.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-b from-gold/20 to-gold/5 text-gold-strong dark:text-gold"><item.icon className="h-[18px] w-[18px]" /></span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</p>
                        <p className="break-words text-[13.5px] font-semibold text-foreground">{item.text}</p>
                      </div>
                    </m.div>
                  ))}
                </div>
                <Link to="/about" className="inline-block">
                  <m.span whileTap={{ scale: 0.97 }} className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-[13px] font-bold tracking-wide text-primary-foreground shadow-[0_12px_24px_-12px_hsl(var(--primary)/.8)] transition hover:brightness-110">
                    Learn More About Us <ArrowRight className="h-4 w-4" />
                  </m.span>
                </Link>
              </div>
            </ScrollReveal>
            <ScrollReveal direction="right" delay={0.2}>
              <div className="relative">
                <div className="aspect-[4/5] sm:aspect-square rounded-[1.75rem] bg-gradient-to-b from-gold/60 via-gold/20 to-primary/30 p-[3px] shadow-[0_30px_60px_-30px_hsl(var(--primary)/.6)]">
                  <div className="h-full w-full rounded-[1.6rem] bg-card p-1.5">
                  <div className="w-full h-full rounded-2xl bg-muted flex items-center justify-center overflow-hidden">
                    {settings?.principal_photo_url && !principalFailed ? (
                      <img
                        src={principalUsingOriginal
                          ? settings.principal_photo_url
                          : (optimizedCloudinaryUrl(settings.principal_photo_url, { width: 600 }) || settings.principal_photo_url)}
                        alt={settings?.principal_name || "Principal"}
                        width={600}
                        height={600}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                        onError={(event) => {
                          // Keep the principal card visible if the optimized
                          // delivery URL fails in a desktop browser.
                          if (!principalUsingOriginal) {
                            setPrincipalUsingOriginal(true);
                          } else {
                            setPrincipalFailed(true);
                          }
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full flex items-center justify-center ${settings?.principal_photo_url && !principalFailed ? "hidden" : ""}`}>
                      <GraduationCap className="w-40 h-40 text-muted-foreground/30" />
                    </div>
                  </div>
                  </div>
                </div>
                {settings?.principal_name && (
                  <div className="absolute bottom-5 left-5 right-5 rounded-xl border border-gold/30 bg-card/90 p-3 text-center backdrop-blur-md shadow-lg">
                    <p className="font-heading font-bold text-foreground text-sm">{settings.principal_name}</p>
                    <p className="text-xs text-muted-foreground">Principal</p>
                  </div>
                )}
                <div className="absolute top-5 left-5 rounded-2xl border border-gold/30 bg-card/90 p-2.5 shadow-lg backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow"><Star className="h-4 w-4 text-white" /></div>
                    <div><p className="text-lg font-black leading-none text-foreground">{settings?.pass_percentage || 95}%</p><p className="text-xs text-muted-foreground font-medium">Pass Rate</p></div>
                  </div>
                </div>
                <div className="absolute top-5 right-5 rounded-2xl border border-gold/30 bg-card/90 p-2.5 shadow-lg backdrop-blur-md">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-400 to-amber-400 shadow"><Award className="h-4 w-4 text-white" /></div>
                    <div><p className="text-lg font-black leading-none text-foreground">{settings?.board_results || "A+"}</p><p className="text-xs text-muted-foreground font-medium">Results</p></div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </m.section>

      {/* ══ 17. EXPLORE THE SITE — bottom quick links (live data) ══ */}
      <ExploreSection settings={settings} admissionCfg={admissionCfg} notices={notices} schedules={exploreSchedules} />

    </PageLayout>
    <Deferred><GlobalDefinitionPopup /></Deferred>
    <Deferred>
      <Suspense fallback={null}>
        <AIAssistantWidget />
      </Suspense>
    </Deferred>

    {/* TTS bar — auto-plays the moment a "Listen" pill is clicked on a notice card.
        Language (Urdu / English) is auto-detected from the article text. */}
    {ttsItem && (
      <TextToSpeechPlayer
        text={ttsItem.content}
        title={ttsItem.title}
        onClose={() => setTtsItem(null)}
      />
    )}
    </>
  );
};

export default Home;
