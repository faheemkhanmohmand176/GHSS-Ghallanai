// src/components/shared/CommandPalette.tsx
// Global search & command palette — Ctrl/⌘+K, "/" or the navbar search icon.
//
// v2 (2026-11) — rebuilt to match the current website:
//   • Every action and page is the REAL, current route of the site
//     (Admission, Track Application, Roll No. Slip, Results, Merit List,
//     Notices, Teachers, About, Contact, FAQs …) — nothing stale.
//   • LIVE admission status: the "Apply for Admission" row shows whether
//     admissions are open / opening soon / closed, the session and the days
//     left, read from the same admission settings the Admission page uses.
//   • Searches pages, the official FAQ answers (same dataset as /faq and the
//     AI assistant), live notices and teachers — with typo-tolerant fuzzy
//     matching, Roman-Urdu keywords (natija, dakhla, rabta …) and an
//     always-available "search the whole site" fallback to /search.
//   • Empty state: quick actions, latest notices, popular searches, recents.
//   • Mobile-first: 16px input (no iOS zoom), 52px+ touch rows, safe-area
//     aware, list height follows the on-screen keyboard (visualViewport).
//   • Voice search kept (Web Speech API; hidden where unsupported).
//
// Performance: the shell below only listens for the shortcut / open event.
// The data hooks + Fuse indexes live in <PaletteSheet/>, which is mounted
// ONLY while the palette is open — zero background cost on every page.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { m, AnimatePresence } from "framer-motion";
import Fuse from "fuse.js";
import {
  Search, Hash, FileText, Phone, Moon, SunMedium, CornerDownLeft, ArrowUp, ArrowDown,
  X, Clock, Sparkles, Mic, MicOff, UserPlus, ScanSearch, Medal, MessageCircle, Home,
  Bell, Users, Info, Mail, HelpCircle, ListOrdered, ArrowUpRight, TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useNotices } from "@/hooks/useNotices";
import { useTeachers } from "@/hooks/useTeachers";
import { useSchoolSettings } from "@/hooks/useSchoolSettings";
import { useAdmissionSettings, getAdmissionState, formatAdmissionDate } from "@/hooks/useAdmission";
import { useTheme } from "@/hooks/useTheme";
import { whatsappLink, SCHOOL_WHATSAPP_DISPLAY } from "@/lib/schoolContact";
import { FAQ_ITEMS } from "../../data/faqData.mjs";

const RECENTS_KEY = "ghss_cmdk_recent_searches";
const MAX_RECENTS = 5;

// Tiny global open API — any button anywhere (e.g. the navbar search icon)
// can open the palette without prop drilling.
const OPEN_EVENT = "ghss:open-command-palette";
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

/* ── recents ─────────────────────────────────────────────────────────── */
function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === "string").slice(0, MAX_RECENTS)
      : [];
  } catch {
    return [];
  }
}
function pushRecent(query: string) {
  const q = query.trim();
  if (!q) return;
  try {
    const cur = readRecents().filter((r) => r.toLowerCase() !== q.toLowerCase());
    localStorage.setItem(RECENTS_KEY, JSON.stringify([q, ...cur].slice(0, MAX_RECENTS)));
  } catch {
    /* storage unavailable — recents just won't persist */
  }
}

/* ── navigation helper: route + optional #anchor scroll ──────────────── */
function scrollToAnchor(hash: string) {
  let tries = 0;
  const t = window.setInterval(() => {
    const el = document.getElementById(hash);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.clearInterval(t);
    } else if (++tries > 25) {
      window.clearInterval(t);
    }
  }, 120);
}

/* ── voice search (Web Speech API) ───────────────────────────────────── */
const VOICE_LANG = "en-US";
function getSpeechRecognitionCtor(): any {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}
const VOICE_ERRORS: Record<string, string> = {
  "not-allowed": "Microphone permission denied. Allow mic access in your browser settings.",
  "service-not-allowed": "Microphone permission denied. Allow mic access in your browser settings.",
  "no-speech": "Didn't catch that. Tap the mic and try again.",
  "audio-capture": "No microphone found on this device.",
  network: "Voice search needs an internet connection.",
};

/* ── row model ───────────────────────────────────────────────────────── */
type BadgeTone = "ok" | "warn" | "muted";
interface PaletteRow {
  id: string;
  group: string;
  title: string;
  subtitle?: string;
  keywords?: string[];
  icon: LucideIcon;
  badge?: { text: string; tone: BadgeTone };
  external?: boolean;
  /** Remember the typed query as a recent search when this row is chosen. */
  remember?: boolean;
  run: () => void;
}

const BADGE_CLASS: Record<BadgeTone, string> = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/25",
  muted: "bg-muted text-muted-foreground ring-border",
};

// Static page index (everything that is NOT already a quick action).
// Keywords include a few Roman-Urdu words visitors really type.
const PAGES: { to: string; title: string; subtitle: string; icon: LucideIcon; keywords: string[] }[] = [
  { to: "/", title: "Home", subtitle: "Latest news, results countdown & shortcuts", icon: Home, keywords: ["home", "main", "homepage", "start", "landing"] },
  { to: "/admission#merit-lists", title: "Admission Merit Lists", subtitle: "Published program & category merit lists", icon: ListOrdered, keywords: ["admission merit", "selected students", "listed", "not listed", "selection list", "merit list admission"] },
  { to: "/notices", title: "Notices & Announcements", subtitle: "Official circulars, date sheets & holidays", icon: Bell, keywords: ["notice", "notices", "announcement", "circular", "date sheet", "datesheet", "holiday", "schedule", "ittela"] },
  { to: "/teachers", title: "Our Teachers", subtitle: "Faculty, subjects & qualifications", icon: Users, keywords: ["teacher", "teachers", "staff", "faculty", "lecturer", "professor", "sir", "ustad", "asatiza"] },
  { to: "/about", title: "About the School", subtitle: "History, mission, vision & facilities", icon: Info, keywords: ["about", "history", "mission", "vision", "principal", "emis", "established", "facilities"] },
  { to: "/contact", title: "Contact & Location", subtitle: "Phone, email, map & message form", icon: Mail, keywords: ["contact", "phone", "email", "address", "location", "map", "directions", "rabta", "message"] },
  { to: "/faq", title: "FAQs", subtitle: "Answers about admission, results & the website", icon: HelpCircle, keywords: ["faq", "faqs", "help", "questions", "support", "how to"] },
];

const POPULAR = ["Admission fee", "Roll number slip", "Check result", "Merit list", "Date sheet"];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" });

/* ═══════════════════════════════════════════════════════════════════════
   Shell — only listens for the shortcut / open event
   ═══════════════════════════════════════════════════════════════════════ */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isK = e.key.toLowerCase() === "k";
      if ((e.metaKey || e.ctrlKey) && isK) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/" && !open) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag !== "input" && tag !== "textarea" && tag !== "select" && !target?.isContentEditable) {
          e.preventDefault();
          setOpen(true);
        }
      }
    };
    const onOpenEvent = () => setOpen(true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_EVENT, onOpenEvent);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_EVENT, onOpenEvent);
    };
  }, [open]);

  const close = useCallback(() => setOpen(false), []);
  if (!open) return null;
  return createPortal(<PaletteSheet onClose={close} />, document.body);
}

/* ═══════════════════════════════════════════════════════════════════════
   The palette itself (mounted only while open)
   ═══════════════════════════════════════════════════════════════════════ */
function PaletteSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { data: school } = useSchoolSettings();
  const { data: admission } = useAdmissionSettings();
  const { data: notices = [] } = useNotices();
  const { data: teachers = [] } = useTeachers();

  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents] = useState<string[]>(() => readRecents());
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── lock page scroll + focus the input ───────────────────────────────
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = prev;
      cancelAnimationFrame(raf);
    };
  }, []);

  // ── list height follows the on-screen keyboard ───────────────────────
  const [vvh, setVvh] = useState(() =>
    typeof window === "undefined" ? 800 : window.visualViewport?.height ?? window.innerHeight
  );
  useEffect(() => {
    const vv = window.visualViewport;
    const update = () => setVvh(vv?.height ?? window.innerHeight);
    update();
    vv?.addEventListener("resize", update);
    window.addEventListener("resize", update);
    return () => {
      vv?.removeEventListener("resize", update);
      window.removeEventListener("resize", update);
    };
  }, []);
  const listMaxHeight = Math.max(200, Math.min(vvh - 190, 560));

  // ── voice search ─────────────────────────────────────────────────────
  const [voiceSupported] = useState(() => !!getSpeechRecognitionCtor());
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [voiceError, setVoiceError] = useState("");
  const recognitionRef = useRef<any>(null);

  const stopVoice = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
  }, []);
  const startVoice = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    try { recognitionRef.current?.abort(); } catch { /* noop */ }
    setVoiceError("");
    setInterim("");
    const rec = new Ctor();
    rec.lang = VOICE_LANG;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setListening(true);
    rec.onresult = (e: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interimText += r[0].transcript;
      }
      if (interimText) setInterim(interimText);
      if (finalText) {
        setInterim("");
        setQuery(finalText.trim().replace(/[.]+$/, ""));
      }
    };
    rec.onerror = (e: any) => setVoiceError(VOICE_ERRORS[e?.error] || "Voice search failed. Please try again.");
    rec.onend = () => {
      setListening(false);
      setInterim("");
      recognitionRef.current = null;
    };
    recognitionRef.current = rec;
    try { rec.start(); } catch { setListening(false); }
  }, []);
  const toggleVoice = useCallback(() => (listening ? stopVoice() : startVoice()), [listening, startVoice, stopVoice]);
  useEffect(() => () => {
    try { recognitionRef.current?.abort(); } catch { /* noop */ }
  }, []);

  // ── navigation ───────────────────────────────────────────────────────
  const goTo = useCallback(
    (href: string) => {
      navigate(href);
      const hash = href.split("#")[1];
      if (hash) window.setTimeout(() => scrollToAnchor(hash), 150);
    },
    [navigate]
  );

  // ── quick actions (live) ─────────────────────────────────────────────
  const quickActions = useMemo<PaletteRow[]>(() => {
    const rows: PaletteRow[] = [];

    // Admission — status comes from the same settings the Admission page uses.
    const st = getAdmissionState(admission);
    let admHint = "Apply online · programs, seats & fee";
    let admBadge: PaletteRow["badge"];
    if (admission) {
      if (st.open) {
        admHint = `Session ${admission.session_year}` +
          (st.daysLeft != null ? ` · ${st.daysLeft} day${st.daysLeft === 1 ? "" : "s"} left` : "") +
          ` · Fee Rs ${admission.processing_fee}`;
        admBadge = { text: "Open", tone: "ok" };
      } else if (st.reason === "not_started") {
        admHint = `Opens ${formatAdmissionDate(st.openDate)}`;
        admBadge = { text: "Soon", tone: "warn" };
      } else if (st.reason === "ended") {
        admHint = `Last date was ${formatAdmissionDate(st.lastDate)}`;
        admBadge = { text: "Closed", tone: "muted" };
      } else {
        admHint = "Online admission is currently closed";
        admBadge = { text: "Closed", tone: "muted" };
      }
    }
    rows.push({
      id: "qa-admission",
      group: "Quick actions",
      title: st.open ? "Apply for Admission" : "Admission",
      subtitle: admHint,
      badge: admBadge,
      icon: UserPlus,
      keywords: ["admission", "apply", "enroll", "enrol", "register", "form", "fee", "programs", "seats", "1st year", "2nd year", "inter", "hssc", "dakhla", "quota", "documents"],
      run: () => goTo("/admission"),
    });
    rows.push({
      id: "qa-track",
      group: "Quick actions",
      title: "Track Admission Application",
      subtitle: "Check your status with your Tracking ID",
      icon: ScanSearch,
      keywords: ["track", "status", "tracking id", "application status", "payment status", "my application"],
      run: () => goTo("/admission#track"),
    });
    rows.push({
      id: "qa-roll-slip",
      group: "Quick actions",
      title: "Roll No. Slip",
      subtitle: "Find, download & share your exam roll slip",
      icon: Hash,
      keywords: ["roll", "roll no", "roll number", "slip", "admit card", "exam roll", "qr", "parchi"],
      run: () => goTo("/roll-no-slip"),
    });
    rows.push({
      id: "qa-results",
      group: "Quick actions",
      title: "Check Result & Download DMC",
      subtitle: "Search by exam roll no. · BISE Peshawar results too",
      icon: FileText,
      keywords: ["result", "results", "dmc", "marks", "report card", "grade", "bise", "board result", "hssc", "semester", "natija", "nataij"],
      run: () => goTo("/results"),
    });
    rows.push({
      id: "qa-merit",
      group: "Quick actions",
      title: "Merit List",
      subtitle: "Official rankings & position holders",
      icon: Medal,
      keywords: ["merit", "merit list", "topper", "toppers", "position", "position holder", "rank", "ranking", "top students"],
      run: () => goTo("/merit-list"),
    });

    const phone = school?.phone?.trim();
    if (phone) {
      rows.push({
        id: "qa-call",
        group: "Quick actions",
        title: "Call School Office",
        subtitle: phone,
        icon: Phone,
        keywords: ["call", "phone", "office", "number", "helpline"],
        run: () => { window.location.href = `tel:${phone.replace(/[^+\d]/g, "")}`; },
      });
    }
    rows.push({
      id: "qa-whatsapp",
      group: "Quick actions",
      title: "WhatsApp the School",
      subtitle: SCHOOL_WHATSAPP_DISPLAY,
      icon: MessageCircle,
      external: true,
      keywords: ["whatsapp", "chat", "message", "wa", "support"],
      run: () =>
        window.open(whatsappLink("Assalam o Alaikum, I have a question about GHSS Ghallanai."), "_blank", "noopener,noreferrer"),
    });

    // Theme: the site only has "Device (system)" and "Dark". If the device
    // itself is dark there is nothing to switch, so the row is hidden.
    const isDarkNow = document.documentElement.classList.contains("dark");
    if (!isDarkNow) {
      rows.push({
        id: "qa-theme",
        group: "Quick actions",
        title: "Switch to Dark Mode",
        subtitle: "Easier on the eyes at night",
        icon: Moon,
        keywords: ["dark", "dark mode", "night", "theme", "appearance"],
        run: () => setTheme("dark"),
      });
    } else if (theme === "dark") {
      rows.push({
        id: "qa-theme",
        group: "Quick actions",
        title: "Switch to Light Mode",
        subtitle: "Follow your device appearance",
        icon: SunMedium,
        keywords: ["light", "light mode", "bright", "day", "theme", "appearance"],
        run: () => setTheme("system"),
      });
    }
    return rows;
  }, [admission, school?.phone, theme, setTheme, goTo]);

  const pageRows = useMemo<PaletteRow[]>(
    () =>
      PAGES.map((p) => ({
        id: `pg-${p.to}`,
        group: "Pages",
        title: p.title,
        subtitle: p.subtitle,
        icon: p.icon,
        keywords: p.keywords,
        remember: true,
        run: () => goTo(p.to),
      })),
    [goTo]
  );

  // live (published, not expired) notices
  const liveNotices = useMemo(() => {
    const now = Date.now();
    return notices
      .filter((n) => n.is_published !== false && (!n.expires_at || new Date(n.expires_at).getTime() > now))
      .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || +new Date(b.created_at) - +new Date(a.created_at));
  }, [notices]);

  const noticeRow = useCallback(
    (n: (typeof liveNotices)[number], group: string): PaletteRow => ({
      id: `nt-${n.id}`,
      group,
      title: n.title,
      subtitle: `${n.is_urgent ? "Urgent · " : ""}${n.category || "General"} · ${shortDate(n.created_at)}`,
      icon: Bell,
      badge: n.is_urgent ? { text: "Urgent", tone: "warn" } : undefined,
      remember: true,
      run: () => goTo(`/notices/${n.id}`),
    }),
    [goTo]
  );

  // ── fuzzy indexes ────────────────────────────────────────────────────
  const goFuse = useMemo(
    () =>
      new Fuse([...quickActions, ...pageRows], {
        keys: [
          { name: "title", weight: 0.5 },
          { name: "keywords", weight: 0.35 },
          { name: "subtitle", weight: 0.15 },
        ],
        threshold: 0.34,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [quickActions, pageRows]
  );
  const faqFuse = useMemo(
    () =>
      new Fuse(FAQ_ITEMS as { id: string; category: string; question: string; answer: string }[], {
        keys: [
          { name: "question", weight: 0.7 },
          { name: "answer", weight: 0.3 },
        ],
        threshold: 0.32,
        ignoreLocation: true,
        minMatchCharLength: 3,
      }),
    []
  );
  const noticeFuse = useMemo(
    () =>
      new Fuse(liveNotices, {
        keys: [
          { name: "title", weight: 0.7 },
          { name: "content", weight: 0.2 },
          { name: "category", weight: 0.1 },
        ],
        threshold: 0.32,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [liveNotices]
  );
  const teacherFuse = useMemo(
    () =>
      new Fuse(teachers, {
        keys: [
          { name: "full_name", weight: 0.6 },
          { name: "subject", weight: 0.3 },
          { name: "qualification", weight: 0.1 },
        ],
        threshold: 0.3,
        ignoreLocation: true,
        minMatchCharLength: 2,
      }),
    [teachers]
  );

  // ── rows for the current query ───────────────────────────────────────
  const q = query.trim();
  const rows = useMemo<PaletteRow[]>(() => {
    if (!q) {
      return [
        ...quickActions,
        ...liveNotices.slice(0, 3).map((n) => noticeRow(n, "Latest notices")),
        ...pageRows.map((r) => ({ ...r, remember: false })),
      ];
    }
    const out: PaletteRow[] = [];
    const go = goFuse.search(q, { limit: 8 }).map((r) => r.item);
    out.push(...go.filter((r) => r.group === "Quick actions").slice(0, 4));
    out.push(...go.filter((r) => r.group === "Pages").slice(0, 4));

    for (const r of faqFuse.search(q, { limit: 3 })) {
      const f = r.item;
      out.push({
        id: `faq-${f.id}`,
        group: "FAQs",
        title: f.question,
        subtitle: f.answer.length > 130 ? `${f.answer.slice(0, 127).trimEnd()}…` : f.answer,
        icon: HelpCircle,
        remember: true,
        run: () => goTo(`/faq#faq-${slug(f.category)}`),
      });
    }
    for (const r of noticeFuse.search(q, { limit: 4 })) out.push(noticeRow(r.item, "Notices"));
    for (const r of teacherFuse.search(q, { limit: 4 })) {
      const t = r.item;
      out.push({
        id: `tc-${t.id}`,
        group: "Teachers",
        title: t.full_name,
        subtitle: [t.subject, t.qualification].filter(Boolean).join(" · ") || "Teacher",
        icon: Users,
        remember: true,
        run: () => goTo("/teachers"),
      });
    }
    out.push({
      id: "search-all",
      group: "Search",
      title: `Search the whole site for “${q}”`,
      subtitle: "Notices, teachers and pages on the full search page",
      icon: Search,
      remember: true,
      run: () => goTo(`/search?q=${encodeURIComponent(q)}`),
    });
    return out;
  }, [q, quickActions, pageRows, liveNotices, noticeRow, goFuse, faqFuse, noticeFuse, teacherFuse, goTo]);

  useEffect(() => setActiveIndex(0), [q]);

  const runRow = useCallback(
    (row: PaletteRow) => {
      if (row.remember) pushRecent(q || row.title);
      row.run();
      onClose();
    },
    [q, onClose]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, Math.max(rows.length - 1, 0))); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
      else if (e.key === "Enter") { e.preventDefault(); const row = rows[activeIndex]; if (row) runRow(row); }
    },
    [rows, activeIndex, onClose, runRow]
  );

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-row-index="${activeIndex}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const showChips = q.length === 0;
  const hasOnlyFallback = q.length > 0 && rows.length === 1 && rows[0].id === "search-all";

  return (
    <AnimatePresence>
      <m.div
        key="palette"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[100] flex items-start justify-center px-2.5 sm:px-4 pt-[max(0.625rem,env(safe-area-inset-top))] sm:pt-[10vh]"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        style={{ background: "linear-gradient(180deg, rgba(6,24,18,0.62), rgba(3,10,8,0.78))", backdropFilter: "blur(3px)" }}
        role="dialog"
        aria-modal="true"
        aria-label="Search the GHSS Ghallanai website"
      >
        <m.div
          initial={{ opacity: 0, y: -14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-gold/30 bg-card shadow-2xl ring-1 ring-black/5"
          onKeyDown={onKeyDown}
        >
          <div className="h-[3px] bg-gradient-to-r from-primary via-emerald-500 to-amber-400" aria-hidden="true" />

          {/* ── input row ── */}
          <div className="flex items-center gap-2 border-b border-border/70 px-3.5 py-2.5 sm:px-4 sm:py-3">
            <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={inputRef}
              value={listening && interim ? interim : query}
              onChange={(e) => { setQuery(e.target.value); if (voiceError) setVoiceError(""); }}
              placeholder={listening ? "Listening…" : "Search admission, results, notices, FAQs…"}
              className="min-w-0 flex-1 border-none bg-transparent py-1.5 text-base text-foreground outline-none placeholder:text-muted-foreground/70"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="search"
              inputMode="search"
              aria-label="Search the website"
            />
            {query && !listening && (
              <button
                type="button"
                onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                aria-label="Clear search"
                className="shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                Clear
              </button>
            )}
            {voiceSupported && (
              <button
                type="button"
                onClick={toggleVoice}
                aria-label={listening ? "Stop voice search" : "Start voice search"}
                aria-pressed={listening}
                className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
                  listening
                    ? "bg-gradient-to-br from-gold to-gold-strong text-white shadow-[0_0_0_4px_hsl(var(--gold)/0.25)]"
                    : "bg-primary/10 text-primary hover:bg-primary/20"
                }`}
              >
                {listening && <span className="absolute inset-0 animate-ping rounded-full bg-gold/40" aria-hidden="true" />}
                {listening ? <MicOff className="relative h-[18px] w-[18px]" /> : <Mic className="relative h-[18px] w-[18px]" />}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close search"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>

          {/* ── voice status ── */}
          <AnimatePresence initial={false}>
            {(listening || voiceError) && (
              <m.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden border-b border-border/70"
              >
                {listening ? (
                  <div className="flex items-center gap-3 bg-gradient-to-r from-gold/10 via-transparent to-primary/5 px-4 py-3" role="status" aria-live="polite">
                    <div className="flex h-5 items-end gap-[3px]" aria-hidden="true">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <m.span
                          key={i}
                          className="w-[3px] rounded-full bg-gold"
                          animate={{ height: ["25%", "100%", "40%", "85%", "25%"] }}
                          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
                          style={{ height: "25%" }}
                        />
                      ))}
                    </div>
                    <p className="flex-1 truncate text-xs text-muted-foreground">
                      {interim ? <span className="font-medium text-foreground">{interim}</span> : "Listening… speak now"}
                    </p>
                    <button onClick={stopVoice} className="text-[11px] font-semibold text-primary hover:underline">Stop</button>
                  </div>
                ) : (
                  <p className="bg-destructive/5 px-4 py-2.5 text-xs text-destructive" role="alert">{voiceError}</p>
                )}
              </m.div>
            )}
          </AnimatePresence>

          {/* ── results ── */}
          <div ref={listRef} className="overflow-y-auto overscroll-contain pb-2" style={{ maxHeight: listMaxHeight }}>
            {showChips && (
              <div className="px-3.5 pt-3 pb-1">
                {recents.length > 0 && (
                  <>
                    <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
                      <Clock className="h-3 w-3" /> Recent
                    </p>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {recents.map((r) => (
                        <button key={r} onClick={() => setQuery(r)} className="rounded-full border border-border bg-secondary/60 px-3 py-1.5 text-xs text-foreground/85 transition-colors hover:bg-secondary">
                          {r}
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80">
                  <TrendingUp className="h-3 w-3" /> Popular
                </p>
                <div className="mb-1 flex flex-wrap gap-1.5">
                  {POPULAR.map((p) => (
                    <button key={p} onClick={() => setQuery(p)} className="rounded-full border border-gold/30 bg-gold/[0.06] px-3 py-1.5 text-xs font-medium text-foreground/85 transition-colors hover:bg-gold/15">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasOnlyFallback && (
              <div className="px-4 pt-6 pb-2 text-center">
                <Sparkles className="mx-auto mb-2 h-5 w-5 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No direct match for &ldquo;{q}&rdquo;</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Try “admission”, “roll slip”, “result” or a teacher’s name{voiceSupported ? " — or tap the mic" : ""}
                </p>
              </div>
            )}

            {rows.map((row, idx) => {
              const active = idx === activeIndex;
              const first = rows[idx - 1]?.group !== row.group;
              const Icon = row.icon;
              const isFaq = row.group === "FAQs";
              return (
                <div key={row.id}>
                  {first && (
                    <p className="sticky top-0 z-[1] bg-card/95 px-4 pt-3 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80 backdrop-blur">
                      {row.group}
                    </p>
                  )}
                  <button
                    data-row-index={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => runRow(row)}
                    className={`flex min-h-[52px] w-full items-center gap-3 px-3.5 py-2 text-left transition-colors ${
                      active ? "bg-primary/10" : "hover:bg-secondary/60"
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"}`}>
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[14px] font-semibold leading-snug text-foreground ${isFaq ? "line-clamp-2" : "truncate"}`}>{row.title}</span>
                      {row.subtitle && (
                        <span className={`block text-[11.5px] leading-snug text-muted-foreground ${isFaq ? "line-clamp-2" : "truncate"}`}>{row.subtitle}</span>
                      )}
                    </span>
                    {row.badge && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${BADGE_CLASS[row.badge.tone]}`}>
                        {row.badge.text}
                      </span>
                    )}
                    {row.external && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                    {active && !row.external && <CornerDownLeft className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden="true" />}
                  </button>
                </div>
              );
            })}
          </div>

          {/* ── footer (keyboard hints, desktop only) ── */}
          <div className="hidden items-center gap-4 border-t border-border/70 bg-secondary/30 px-4 py-2 text-[11px] text-muted-foreground sm:flex">
            <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> Navigate</span>
            <span className="flex items-center gap-1"><CornerDownLeft className="h-3 w-3" /> Open</span>
            <span>Esc Close</span>
            <span className="ml-auto font-medium">Ctrl K or / to search anywhere</span>
          </div>
        </m.div>
      </m.div>
    </AnimatePresence>
  );
}
