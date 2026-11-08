/**
 * Full-colour, emoji-style SVG icons for the admin dashboard.
 * Each icon is a self-contained 24×24 SVG (flat gradients, soft outline) so it
 * keeps its real colours in light AND dark mode — no CSS colour needed.
 * Usage: <AdminIcon name="admissions" className="h-5 w-5" />
 */
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg", "aria-hidden": true, focusable: false } as const;

// ── 🏠 Overview — dashboard tiles ───────────────────────────────────────────
const Overview = (p: P) => (
  <svg {...base} {...p}>
    <defs>
      <linearGradient id="ai-ov-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4ADE80"/><stop offset="1" stopColor="#16A34A"/></linearGradient>
      <linearGradient id="ai-ov-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FCD34D"/><stop offset="1" stopColor="#F59E0B"/></linearGradient>
      <linearGradient id="ai-ov-c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#60A5FA"/><stop offset="1" stopColor="#2563EB"/></linearGradient>
      <linearGradient id="ai-ov-d" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F9A8D4"/><stop offset="1" stopColor="#EC4899"/></linearGradient>
    </defs>
    <rect x="2.5" y="2.5" width="8.6" height="10.2" rx="2.2" fill="url(#ai-ov-a)"/>
    <rect x="12.9" y="2.5" width="8.6" height="6" rx="2.2" fill="url(#ai-ov-b)"/>
    <rect x="12.9" y="10.3" width="8.6" height="11.2" rx="2.2" fill="url(#ai-ov-c)"/>
    <rect x="2.5" y="14.5" width="8.6" height="7" rx="2.2" fill="url(#ai-ov-d)"/>
    <path d="M4.5 5h4.6M4.5 7.6h3" stroke="#fff" strokeOpacity=".75" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

// ── ⚙️ Settings — gear ──────────────────────────────────────────────────────
const Settings = (p: P) => (
  <svg {...base} {...p}>
    <defs>
      <linearGradient id="ai-st-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#CBD5E1"/><stop offset=".55" stopColor="#94A3B8"/><stop offset="1" stopColor="#64748B"/></linearGradient>
    </defs>
    <path d="M12 1.8l1.6.2.5 2.4 1.9.8 2.1-1.3 2.2 2.2-1.3 2.1.8 1.9 2.4.5.2 1.6v0l-.2 1.6-2.4.5-.8 1.9 1.3 2.1-2.2 2.2-2.1-1.3-1.9.8-.5 2.4-1.6.2-1.6-.2-.5-2.4-1.9-.8-2.1 1.3-2.2-2.2 1.3-2.1-.8-1.9-2.4-.5L1.8 12l.2-1.6 2.4-.5.8-1.9-1.3-2.1 2.2-2.2 2.1 1.3 1.9-.8.5-2.4z" fill="url(#ai-st-a)" stroke="#475569" strokeWidth=".7" strokeLinejoin="round"/>
    <circle cx="12" cy="12" r="4" fill="#F8FAFC" stroke="#475569" strokeWidth=".8"/>
    <circle cx="12" cy="12" r="1.9" fill="#F59E0B"/>
  </svg>
);

// ── 📝 Admissions — notepad + pencil ───────────────────────────────────────
const Admissions = (p: P) => (
  <svg {...base} {...p}>
    <defs>
      <linearGradient id="ai-ad-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF"/><stop offset="1" stopColor="#E0F2FE"/></linearGradient>
      <linearGradient id="ai-ad-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FCD34D"/><stop offset="1" stopColor="#F59E0B"/></linearGradient>
    </defs>
    <rect x="3.2" y="3.2" width="14.4" height="17.8" rx="2.2" fill="url(#ai-ad-a)" stroke="#0EA5E9" strokeWidth="1.1"/>
    <rect x="3.2" y="3.2" width="14.4" height="3.6" rx="2.2" fill="#38BDF8"/>
    <circle cx="6.6" cy="3.6" r="1" fill="#0369A1"/><circle cx="10.4" cy="3.6" r="1" fill="#0369A1"/><circle cx="14.2" cy="3.6" r="1" fill="#0369A1"/>
    <path d="M6.2 10.4h8M6.2 13.2h8M6.2 16h4.4" stroke="#7DD3FC" strokeWidth="1.2" strokeLinecap="round"/>
    <path d="M20.7 9.3l-8 8-.9 3.2 3.2-.9 8-8a1.8 1.8 0 000-2.5l-.2-.2a1.8 1.8 0 00-2.1.4z" fill="url(#ai-ad-b)" stroke="#B45309" strokeWidth=".8" strokeLinejoin="round"/>
    <path d="M18.6 11.4l1.7 1.7" stroke="#B45309" strokeWidth=".8"/>
    <path d="M11.8 17.3l-.9 3.2 3.2-.9z" fill="#FDE68A" stroke="#B45309" strokeWidth=".6" strokeLinejoin="round"/>
    <path d="M11.2 19.3l-.3 1.2 1.2-.3z" fill="#334155"/>
  </svg>
);

// ── 🏆 Results — trophy ─────────────────────────────────────────────────────
const Results = (p: P) => (
  <svg {...base} {...p}>
    <defs>
      <linearGradient id="ai-rs-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FEF08A"/><stop offset=".5" stopColor="#FACC15"/><stop offset="1" stopColor="#D97706"/></linearGradient>
    </defs>
    <path d="M7 4.2H3.6v2.2c0 2.4 1.6 4.2 4 4.5M17 4.2h3.4v2.2c0 2.4-1.6 4.2-4 4.5" stroke="#D97706" strokeWidth="1.6" strokeLinecap="round" fill="none"/>
    <path d="M6.6 2.6h10.8v6.6c0 3.4-2.4 5.8-5.4 5.8s-5.4-2.4-5.4-5.8z" fill="url(#ai-rs-a)" stroke="#B45309" strokeWidth=".9" strokeLinejoin="round"/>
    <path d="M9 4.4v4.8c0 1.4.6 2.4 1.4 3" stroke="#fff" strokeOpacity=".65" strokeWidth="1.2" strokeLinecap="round"/>
    <rect x="10.6" y="15" width="2.8" height="3" fill="#D97706"/>
    <path d="M7.4 21.4v-1.2c0-.7.6-1.2 1.2-1.2h6.8c.7 0 1.2.5 1.2 1.2v1.2z" fill="#92400E"/>
    <path d="M12 5.2l.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3z" fill="#FFF7D6" stroke="#B45309" strokeWidth=".4"/>
  </svg>
);

// ── 📅 Exam Date Sheet — calendar ───────────────────────────────────────────
const DateSheet = (p: P) => (
  <svg {...base} {...p}>
    <defs>
      <linearGradient id="ai-dt-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF"/><stop offset="1" stopColor="#F1F5F9"/></linearGradient>
      <linearGradient id="ai-dt-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F87171"/><stop offset="1" stopColor="#DC2626"/></linearGradient>
    </defs>
    <rect x="2.8" y="4" width="18.4" height="17.2" rx="2.6" fill="url(#ai-dt-a)" stroke="#CBD5E1" strokeWidth="1"/>
    <path d="M2.8 6.6A2.6 2.6 0 015.4 4h13.2a2.6 2.6 0 012.6 2.6V9H2.8z" fill="url(#ai-dt-b)"/>
    <rect x="7" y="2" width="2.2" height="4.4" rx="1.1" fill="#475569"/><rect x="14.8" y="2" width="2.2" height="4.4" rx="1.1" fill="#475569"/>
    <g fill="#94A3B8"><rect x="5.6" y="11" width="2.6" height="2.2" rx=".6"/><rect x="10.7" y="11" width="2.6" height="2.2" rx=".6"/><rect x="15.8" y="11" width="2.6" height="2.2" rx=".6"/><rect x="5.6" y="15.4" width="2.6" height="2.2" rx=".6"/><rect x="15.8" y="15.4" width="2.6" height="2.2" rx=".6"/></g>
    <rect x="10.4" y="14.9" width="3.2" height="3.2" rx="1" fill="#16A34A"/>
  </svg>
);

// ── 🎫 Exam Roll Numbers — ticket ───────────────────────────────────────────
const Rolls = (p: P) => (
  <svg {...base} {...p}>
    <defs>
      <linearGradient id="ai-rl-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#C4B5FD"/><stop offset="1" stopColor="#7C3AED"/></linearGradient>
    </defs>
    <path d="M2.4 7.4A1.8 1.8 0 014.2 5.6h15.6a1.8 1.8 0 011.8 1.8v2.2a2.4 2.4 0 000 4.8v2.2a1.8 1.8 0 01-1.8 1.8H4.2a1.8 1.8 0 01-1.8-1.8v-2.2a2.4 2.4 0 000-4.8z" fill="url(#ai-rl-a)" stroke="#5B21B6" strokeWidth=".9" strokeLinejoin="round"/>
    <path d="M15 6.4v11.2" stroke="#EDE9FE" strokeWidth="1.2" strokeDasharray="1.6 1.6"/>
    <path d="M5.8 9.6h6.4M5.8 12h6.4M5.8 14.4h4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round"/>
    <path d="M17.6 9.8l.7 1.4 1.5.2-1.1 1.1.3 1.5-1.4-.7-1.4.7.3-1.5-1.1-1.1 1.5-.2z" fill="#FDE047"/>
  </svg>
);

// ── 🪑 Exam Seating — chair ─────────────────────────────────────────────────
const Seating = (p: P) => (
  <svg {...base} {...p}>
    <defs>
      <linearGradient id="ai-sc-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FDBA74"/><stop offset="1" stopColor="#EA580C"/></linearGradient>
      <linearGradient id="ai-sc-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FB923C"/><stop offset="1" stopColor="#C2410C"/></linearGradient>
    </defs>
    <rect x="6" y="2.6" width="12" height="9" rx="2.6" fill="url(#ai-sc-a)" stroke="#9A3412" strokeWidth=".9"/>
    <path d="M9 5.4v3.4M12 5.4v3.4M15 5.4v3.4" stroke="#fff" strokeOpacity=".6" strokeWidth="1.1" strokeLinecap="round"/>
    <rect x="4.4" y="11.6" width="15.2" height="4" rx="1.8" fill="url(#ai-sc-b)" stroke="#9A3412" strokeWidth=".9"/>
    <path d="M7 15.6l-1.4 5.6M17 15.6l1.4 5.6M9.6 15.6v5.6M14.4 15.6v5.6" stroke="#7C2D12" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

// ── 🏅 Merit List — medal ───────────────────────────────────────────────────
const Merit = (p: P) => (
  <svg {...base} {...p}>
    <defs>
      <linearGradient id="ai-mr-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FEF08A"/><stop offset=".55" stopColor="#FACC15"/><stop offset="1" stopColor="#CA8A04"/></linearGradient>
    </defs>
    <path d="M6.2 1.8h4.2l2.1 6.2H8.4z" fill="#EF4444"/>
    <path d="M17.8 1.8h-4.2L11.5 8h4.2z" fill="#2563EB"/>
    <path d="M10.4 1.8h3.2l-1.6 4.8z" fill="#F8FAFC" fillOpacity=".7"/>
    <circle cx="12" cy="15" r="7" fill="url(#ai-mr-a)" stroke="#A16207" strokeWidth="1"/>
    <circle cx="12" cy="15" r="4.9" fill="#FDE047" stroke="#CA8A04" strokeWidth=".8"/>
    <path d="M12 11.5l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.7 2.5-.3z" fill="#F59E0B" stroke="#B45309" strokeWidth=".5" strokeLinejoin="round"/>
  </svg>
);

// ── 🎓 Teachers — graduation cap ────────────────────────────────────────────
const Teachers = (p: P) => (
  <svg {...base} {...p}>
    <defs>
      <linearGradient id="ai-tc-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#475569"/><stop offset="1" stopColor="#0F172A"/></linearGradient>
    </defs>
    <path d="M6.2 11.2v4.4c0 1.6 2.6 3 5.8 3s5.8-1.4 5.8-3v-4.4L12 14z" fill="#1E293B" stroke="#0F172A" strokeWidth=".8" strokeLinejoin="round"/>
    <path d="M12 3.4L1.6 8.6 12 13.8l10.4-5.2z" fill="url(#ai-tc-a)" stroke="#0F172A" strokeWidth=".9" strokeLinejoin="round"/>
    <path d="M12 5.4l6.4 3.2L12 11.8 5.6 8.6z" fill="#fff" fillOpacity=".12"/>
    <path d="M20.2 9.6v6" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="20.2" cy="17" r="1.5" fill="#F59E0B" stroke="#B45309" strokeWidth=".6"/>
  </svg>
);

// ── ⏰ Timetables — alarm clock ─────────────────────────────────────────────
const Timetables = (p: P) => (
  <svg {...base} {...p}>
    <defs>
      <linearGradient id="ai-tt-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F87171"/><stop offset="1" stopColor="#B91C1C"/></linearGradient>
    </defs>
    <path d="M4.2 7.2a4 4 0 015.6-2.8L6.6 8zM19.8 7.2a4 4 0 00-5.6-2.8L17.4 8z" fill="#FBBF24" stroke="#B45309" strokeWidth=".8" strokeLinejoin="round"/>
    <circle cx="12" cy="13.2" r="8" fill="url(#ai-tt-a)" stroke="#7F1D1D" strokeWidth=".9"/>
    <circle cx="12" cy="13.2" r="6.1" fill="#FFFBEB" stroke="#FCA5A5" strokeWidth=".8"/>
    <path d="M12 8.8v4.6l3 1.9" stroke="#334155" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="12" cy="13.4" r="1" fill="#DC2626"/>
    <path d="M6.2 20.4l-1.4 1.4M17.8 20.4l1.4 1.4" stroke="#7F1D1D" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

// ── 📢 Notices — megaphone ──────────────────────────────────────────────────
const Notices = (p: P) => (
  <svg {...base} {...p}>
    <defs>
      <linearGradient id="ai-nt-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FCA5A5"/><stop offset="1" stopColor="#DC2626"/></linearGradient>
      <linearGradient id="ai-nt-b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FDE68A"/><stop offset="1" stopColor="#F59E0B"/></linearGradient>
    </defs>
    <path d="M3 9.4a1.8 1.8 0 011.8-1.8h3.4l8.6-4.4v15.6l-8.6-4.4H4.8A1.8 1.8 0 013 12.6z" fill="url(#ai-nt-a)" stroke="#991B1B" strokeWidth=".9" strokeLinejoin="round"/>
    <path d="M8.2 7.6v8.8" stroke="#991B1B" strokeWidth=".8"/>
    <path d="M5.8 16.6l1 4.2a1 1 0 001 .8h1.6a1 1 0 001-1.2l-.8-3.4z" fill="url(#ai-nt-b)" stroke="#B45309" strokeWidth=".8" strokeLinejoin="round"/>
    <path d="M18.6 8.4a5 5 0 010 6.4M20.8 6.4a8 8 0 010 10.4" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

// ── 📚 Library — stacked books ──────────────────────────────────────────────
const Library = (p: P) => (
  <svg {...base} {...p}>
    <defs>
      <linearGradient id="ai-lb-a" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#34D399"/><stop offset="1" stopColor="#059669"/></linearGradient>
      <linearGradient id="ai-lb-b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#60A5FA"/><stop offset="1" stopColor="#1D4ED8"/></linearGradient>
      <linearGradient id="ai-lb-c" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#FBBF24"/><stop offset="1" stopColor="#D97706"/></linearGradient>
    </defs>
    <rect x="2.6" y="16" width="18.8" height="5" rx="1.3" fill="url(#ai-lb-c)" stroke="#92400E" strokeWidth=".8"/>
    <rect x="4.2" y="10.6" width="16" height="5" rx="1.3" fill="url(#ai-lb-b)" stroke="#1E3A8A" strokeWidth=".8"/>
    <rect x="3.2" y="5.2" width="17.4" height="5" rx="1.3" fill="url(#ai-lb-a)" stroke="#065F46" strokeWidth=".8"/>
    <path d="M6 7.7h6.4M6.6 13.1h5.6M5.4 18.5h7" stroke="#fff" strokeOpacity=".75" strokeWidth="1.1" strokeLinecap="round"/>
    <rect x="15.4" y="17.2" width="3.6" height="2.6" rx=".7" fill="#FEF3C7" stroke="#B45309" strokeWidth=".5"/>
    <rect x="15.6" y="11.8" width="3.2" height="2.2" rx=".7" fill="#DBEAFE" stroke="#1E3A8A" strokeWidth=".5"/>
    <rect x="15.2" y="6.4" width="3.6" height="2.2" rx=".7" fill="#D1FAE5" stroke="#065F46" strokeWidth=".5"/>
    <path d="M17.4 2.6v3" stroke="#DC2626" strokeWidth="1.6" strokeLinecap="round"/>
  </svg>
);

// ── 🛡️ Users — shield with person ───────────────────────────────────────────
const Users = (p: P) => (
  <svg {...base} {...p}>
    <defs>
      <linearGradient id="ai-us-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5EEAD4"/><stop offset="1" stopColor="#0F766E"/></linearGradient>
    </defs>
    <path d="M12 1.8l8.2 3v6.2c0 5.2-3.4 9.2-8.2 11.2-4.8-2-8.2-6-8.2-11.2V4.8z" fill="url(#ai-us-a)" stroke="#115E59" strokeWidth=".9" strokeLinejoin="round"/>
    <path d="M12 3.6l6.4 2.3v5c0 4.2-2.6 7.4-6.4 9.2z" fill="#fff" fillOpacity=".14"/>
    <circle cx="12" cy="9.6" r="2.7" fill="#FFF" stroke="#115E59" strokeWidth=".6"/>
    <path d="M6.9 16.3c.7-2.5 2.7-3.8 5.1-3.8s4.4 1.3 5.1 3.8c-1.4 1.8-3.1 3.1-5.1 4.1-2-1-3.7-2.3-5.1-4.1z" fill="#FFF" stroke="#115E59" strokeWidth=".6" strokeLinejoin="round"/>
  </svg>
);

// ── Extra icons for the Overview dashboard ─────────────────────────────────
const Bell = (p: P) => (
  <svg {...base} {...p}>
    <defs><linearGradient id="ai-bl-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FDE68A"/><stop offset="1" stopColor="#F59E0B"/></linearGradient></defs>
    <path d="M12 2.6a1.4 1.4 0 011.4 1.4v.6a6 6 0 014.4 5.8v3.6l1.8 2.4a1 1 0 01-.8 1.6H5.2a1 1 0 01-.8-1.6l1.8-2.4V10.4a6 6 0 014.4-5.8V4A1.4 1.4 0 0112 2.6z" fill="url(#ai-bl-a)" stroke="#B45309" strokeWidth=".9" strokeLinejoin="round"/>
    <path d="M9.4 19.4a2.6 2.6 0 005.2 0z" fill="#B45309"/>
    <path d="M8.4 10.2a3.6 3.6 0 012-3" stroke="#fff" strokeOpacity=".8" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);
const Clipboard = (p: P) => (
  <svg {...base} {...p}>
    <defs><linearGradient id="ai-cb-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF"/><stop offset="1" stopColor="#EDE9FE"/></linearGradient></defs>
    <rect x="4.2" y="4" width="15.6" height="17.6" rx="2.4" fill="url(#ai-cb-a)" stroke="#7C3AED" strokeWidth="1.1"/>
    <rect x="8.2" y="2" width="7.6" height="4.4" rx="1.4" fill="#A78BFA" stroke="#5B21B6" strokeWidth=".8"/>
    <path d="M7.6 10.6l1.2 1.2 2-2.2M7.6 15.2l1.2 1.2 2-2.2" stroke="#16A34A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12.8 10.8h4M12.8 15.4h4" stroke="#C4B5FD" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const Document = (p: P) => (
  <svg {...base} {...p}>
    <defs><linearGradient id="ai-dc-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF"/><stop offset="1" stopColor="#FEF3C7"/></linearGradient></defs>
    <path d="M6 2.6h8l5 5v12.2a1.8 1.8 0 01-1.8 1.8H6a1.8 1.8 0 01-1.8-1.8V4.4A1.8 1.8 0 016 2.6z" fill="url(#ai-dc-a)" stroke="#D97706" strokeWidth="1.1" strokeLinejoin="round"/>
    <path d="M14 2.6v3.6a1.4 1.4 0 001.4 1.4H19" fill="#FCD34D" stroke="#D97706" strokeWidth=".9" strokeLinejoin="round"/>
    <path d="M7.6 12h8.8M7.6 15h8.8M7.6 18h5" stroke="#FBBF24" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);
const Books = Library;
const Sparkle = (p: P) => (
  <svg {...base} {...p}>
    <defs><linearGradient id="ai-sp-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FDE68A"/><stop offset="1" stopColor="#F59E0B"/></linearGradient></defs>
    <path d="M10 2.6l1.9 5.5 5.5 1.9-5.5 1.9L10 17.4l-1.9-5.5L2.6 10l5.5-1.9z" fill="url(#ai-sp-a)" stroke="#B45309" strokeWidth=".8" strokeLinejoin="round"/>
    <path d="M18 14l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" fill="#F472B6" stroke="#BE185D" strokeWidth=".5" strokeLinejoin="round"/>
  </svg>
);
const Pulse = (p: P) => (
  <svg {...base} {...p}>
    <defs><linearGradient id="ai-pl-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FB7185"/><stop offset="1" stopColor="#E11D48"/></linearGradient></defs>
    <rect x="2.4" y="3.4" width="19.2" height="17.2" rx="3.2" fill="#FFF1F2" stroke="#FDA4AF" strokeWidth="1"/>
    <path d="M4.2 12.6h3.6l2-5.2 3.4 9.4 2.2-6.2 1.2 2h3.2" stroke="url(#ai-pl-a)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const Alert = (p: P) => (
  <svg {...base} {...p}>
    <defs><linearGradient id="ai-al-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FDE047"/><stop offset="1" stopColor="#F59E0B"/></linearGradient></defs>
    <path d="M10.7 3.8a1.5 1.5 0 012.6 0l8.2 14.6a1.5 1.5 0 01-1.3 2.2H3.8a1.5 1.5 0 01-1.3-2.2z" fill="url(#ai-al-a)" stroke="#B45309" strokeWidth="1" strokeLinejoin="round"/>
    <path d="M12 9v5" stroke="#7C2D12" strokeWidth="1.9" strokeLinecap="round"/><circle cx="12" cy="17" r="1.1" fill="#7C2D12"/>
  </svg>
);
const Location = (p: P) => (
  <svg {...base} {...p}>
    <defs><linearGradient id="ai-lc-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FCA5A5"/><stop offset="1" stopColor="#DC2626"/></linearGradient></defs>
    <path d="M12 21.4c-4.4-4.4-6.8-7.6-6.8-10.9a6.8 6.8 0 0113.6 0c0 3.3-2.4 6.5-6.8 10.9z" fill="url(#ai-lc-a)" stroke="#991B1B" strokeWidth=".9" strokeLinejoin="round"/>
    <circle cx="12" cy="10.4" r="2.6" fill="#fff"/>
  </svg>
);
const Phone = (p: P) => (
  <svg {...base} {...p}>
    <defs><linearGradient id="ai-ph-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4ADE80"/><stop offset="1" stopColor="#15803D"/></linearGradient></defs>
    <path d="M5.2 2.8l3.2-.8a1.6 1.6 0 011.9 1l1 2.8a1.6 1.6 0 01-.5 1.8l-1.5 1.1a12 12 0 005.4 5.4l1.1-1.5a1.6 1.6 0 011.8-.5l2.8 1a1.6 1.6 0 011 1.9l-.8 3.2a2 2 0 01-2 1.5C9.8 20 4 14.2 3.7 4.8a2 2 0 011.5-2z" fill="url(#ai-ph-a)" stroke="#14532D" strokeWidth=".9" strokeLinejoin="round"/>
  </svg>
);
const Mail = (p: P) => (
  <svg {...base} {...p}>
    <defs><linearGradient id="ai-ml-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF"/><stop offset="1" stopColor="#DBEAFE"/></linearGradient></defs>
    <rect x="2.4" y="5" width="19.2" height="14" rx="2.4" fill="url(#ai-ml-a)" stroke="#2563EB" strokeWidth="1.1"/>
    <path d="M3.2 6.6l8.8 6.4 8.8-6.4" stroke="#2563EB" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const School = (p: P) => (
  <svg {...base} {...p}>
    <defs><linearGradient id="ai-sh-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FDE68A"/><stop offset="1" stopColor="#F59E0B"/></linearGradient></defs>
    <path d="M12 2.4L2.6 8h18.8z" fill="#EF4444" stroke="#991B1B" strokeWidth=".9" strokeLinejoin="round"/>
    <rect x="3.6" y="8" width="16.8" height="2" fill="#FFF" stroke="#CBD5E1" strokeWidth=".6"/>
    <g fill="url(#ai-sh-a)" stroke="#B45309" strokeWidth=".6"><rect x="5" y="10.4" width="2.6" height="7.6" rx=".6"/><rect x="10.7" y="10.4" width="2.6" height="7.6" rx=".6"/><rect x="16.4" y="10.4" width="2.6" height="7.6" rx=".6"/></g>
    <rect x="2.6" y="18" width="18.8" height="3.2" rx=".9" fill="#94A3B8" stroke="#475569" strokeWidth=".7"/>
  </svg>
);

export const ADMIN_ICONS = {
  overview: Overview, settings: Settings, admissions: Admissions, results: Results,
  "exam-date-sheet": DateSheet, "exam-rolls": Rolls, "exam-seating": Seating,
  "merit-list": Merit, teachers: Teachers, timetables: Timetables,
  announcements: Notices, library: Library, users: Users,
  // overview extras
  bell: Bell, clipboard: Clipboard, document: Document, books: Books, sparkle: Sparkle,
  pulse: Pulse, alert: Alert, location: Location, phone: Phone, mail: Mail, school: School,
} as const;

export type AdminIconName = keyof typeof ADMIN_ICONS;

export function AdminIcon({ name, className, ...rest }: { name: AdminIconName } & P) {
  const Cmp = ADMIN_ICONS[name];
  return Cmp ? <Cmp className={className} {...rest} /> : null;
}

export default AdminIcon;
