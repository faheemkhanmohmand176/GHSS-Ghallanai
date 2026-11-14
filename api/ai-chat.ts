// api/ai-chat.ts
// Vercel Serverless Function — proxies Z.AI's free GLM flash chat API for
// the homepage AI Assistant widget.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ RUNTIME: NODE — NEVER EDGE (critical fix, 2026-09-05) ⚠️
//
//   The previous revision set `export const runtime = "edge"`. On the live
//   deployment that Edge function BLACK-HOLED EVERY REQUEST: even a trivial
//   OPTIONS preflight — three lines of code — never returned a single byte
//   (verified: 40+ s, 0 bytes, from multiple networks). The browser's fetch()
//   never resolved, so the homepage widget sat on "Thinking…" forever. That
//   was the exact bug visitors experienced.
//
//   Meanwhile every NODE-runtime function on the SAME deployment responded
//   instantly (/api/word-of-day → 200 in 0.65 s, /api/ai-result-summary →
//   instant + streaming). The Node handler shape used by ai-result-summary.ts
//   (setHeader → flushHeaders → res.write SSE frames) is therefore the
//   PROVEN-HEALTHY transport on this project.
//
//   ➜ This file now uses exactly that shape. Do NOT switch this route back
//     to `runtime = "edge"` — it demonstrably black-holes on this deployment.
//
// SPEED CONTRACT (the visitor experience this file guarantees) — v3, 2026-09-05:
//   ⚠️ WHY THE BUDGETS GREW (root cause of the "AI assistant is busy right
//   now" epidemic): Z.AI's FREE glm-4.5-flash pool is healthy but SLOW — the
//   first visible token routinely takes 5–10 s (verified live: the same key,
//   same URL, same model streams perfectly in api/ai-result-summary.ts, which
//   waits patiently; the old 5.5 s first-token watchdog here kept KILLING
//   those slow-but-healthy responses, then the fallback attempt died inside
//   the leftover 9 s budget → every visitor saw "busy").
//   • Total server budget: 27 s — `maxDuration = 30` is set below (Hobby/Pro
//     both allow it), so Vercel will not cut us off before our own budget does.
//   • Per-attempt watchdogs: headers + first visible token within 14 s,
//     hard attempt cap 23 s, then we retry once on the other free flash model
//     with a 400 ms cool-down (instant 429/concurrency rejects benefit).
//   • `thinking: disabled` — GLM flash models otherwise burn seconds in a
//     hidden reasoning pass before the first visible token.
//   • max_tokens 550 + last-8-turn history cap → short prompt, fast prefill.
//   • ZAI_API_URL env override is SANITIZED: anything that is not an
//     https://api.z.ai/… URL is ignored (a stale/wrong env value can no
//     longer black-hole the assistant — it would fail every request
//     instantly, which matches the historical "busy" symptom too).
//   • The frontend hardcoded "instant answer" engine was REMOVED
//     (2026-09-05, site-owner request): every question now reaches THIS
//     endpoint and gets a real GLM answer — no more keyword cards answering
//     the wrong question (e.g. "mission" → address card).
//
// PROTOCOL (unchanged — both frontends already speak it):
//   Request:  POST /api/ai-chat  { messages: [...] }
//   Response: text/event-stream
//             data: {"token":"Hi! "}\n\n      (many of these)
//             data: {"done":true}\n\n         (always last on success)
//   On error: data: {"error":"..."}\n\n       (single event, stream closes)
//   The stream ALWAYS ends with either {"done":true} or {"error":"…"} within
//   the server budget — the client can never hang waiting on us.
//
//   Get a free Z.AI API key: https://docs.z.ai/guides/llm/glm-4.7
// ═══════════════════════════════════════════════════════════════════════════

import type {
  IncomingMessage as NodeIncomingMessage,
  ServerResponse as NodeServerResponse,
} from "http";

// PROVEN-HEALTHY upstream: api/ai-result-summary.ts streams perfectly with
// THIS exact URL. The env override is only honored when it still points at
// api.z.ai — any other value is ignored (see header note).
const DEFAULT_ZAI_URL = "https://api.z.ai/api/paas/v4/chat/completions";
const _envUrl = (process.env.ZAI_API_URL || "").trim();
const ZAI_API_URL = _envUrl.startsWith("https://api.z.ai/")
  ? _envUrl
  : DEFAULT_ZAI_URL;
const PRIMARY_MODEL = process.env.ZAI_MODEL || "glm-4.5-flash";
// The two Z.AI flash models are both free — if the primary model's pool is
// congested, the fallback attempt gives the visitor a second, independent
// pool. (Same key works for both.)
const FALLBACK_MODEL = PRIMARY_MODEL.includes("4.7")
  ? "glm-4.5-flash"
  : "glm-4.7-flash";
const ZAI_API_KEY = process.env.ZAI_API_KEY || "";

// Vercel function cap — MUST be ≥ GLOBAL_BUDGET_MS/1000 + overhead, or the
// platform kills the function mid-answer. 30 s is allowed on Hobby and Pro.
export const maxDuration = 30;
// Cool-down before a retry attempt — an instantly-rejected attempt (429 /
// concurrency cap) benefits from a short pause before hitting the pool again.
const RETRY_BACKOFF_MS = Number(process.env.AI_RETRY_BACKOFF_MS || 400);

// ── Budgets (env-overridable; sized for Z.AI's slow-but-healthy free pool) ────
const FIRST_TOKEN_TIMEOUT_MS = Number(
  process.env.AI_FIRST_TOKEN_TIMEOUT_MS || 14000
);
const ATTEMPT_BUDGET_MS = Number(process.env.AI_ATTEMPT_BUDGET_MS || 23000);
const GLOBAL_BUDGET_MS = Number(process.env.AI_GLOBAL_BUDGET_MS || 27000);
// Don't start an attempt we can't plausibly finish — but never let the
// reserve exceed the global budget itself (that would refuse to even try
// when the budget is tuned small, e.g. staging/test configurations).
const MIN_ATTEMPT_RESERVE_MS = Math.min(2500, GLOBAL_BUDGET_MS);

// Light in-memory per-IP rate limit (the Edge middleware's matcher excludes
// /api/* routes, so this function protects its own free-tier quota).
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Number(process.env.AI_RATE_LIMIT_PER_MIN || 30);
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// ── System context (homepage assistant) ───────────────────────────────────
// v4 (2026-11): NO hardcoded school facts any more. Everything factual —
// school details, admission status/dates/fee, notices, results schedule,
// date sheet, roll slips, merit lists — is read LIVE from the same database
// the website itself uses (60 s cache) and injected into every prompt, plus
// the website's own FAQ dataset (src/data/faqData.mjs) for procedures.
// This file only holds identity, behaviour and style rules.
import { FAQ_ITEMS } from "../src/data/faqData.mjs";

const SITE_URL = "https://ghssghallanai.dpdns.org";

const BASE_RULES = `You are the official AI Assistant of Government Higher Secondary School (GHSS) Ghallanai, District Mohmand, KPK, Pakistan — a premium, professional digital assistant on the school website (${SITE_URL}). The school offers HSSC (1st Year and 2nd Year).

IDENTITY (never break these)
- You were built by the GHSS Ghallanai Administration for this school's students, parents and visitors. If asked who built/owns/trained you or which AI/company/model you are, say the "GHSS Ghallanai Administration" built you; never name Z.AI, Zhipu, GLM, OpenAI, Google, Anthropic, ChatGPT, Claude, Gemini, DeepSeek or any other company/model, and never discuss the underlying technology.
- Your name: "GHSS Ghallanai AI Assistant". Never claim to be human. Never invent names of developers, teachers or officials.

HOW TO ANSWER (accuracy first)
- The sections "LIVE SCHOOL DATA" and "WEBSITE KNOWLEDGE" below are the ONLY source of school facts. Answer strictly from them. Today's date is given there — use it to judge whether dates are past, today or upcoming.
- If the answer is not in that data, say honestly that it is not published yet or that you do not have it, and point to the right page or the Contact page (/contact). NEVER guess or invent dates, fees, marks, roll numbers, phone numbers, names, deadlines or policies.
- Results: you cannot see any student's marks. Explain how to check on /results with the Exam Roll No (or Class + Class Roll No where the page offers it), and state the live result status from the data (published / scheduled with date-time / nothing announced yet). School exams are called 1st Semester and 2nd Semester; BISE Peshawar HSSC-I/II board results can also be searched on /results.
- Admission categories (exactly five): Open Merit, Local Quota, Sports, College Employees, Special Person. Local applicants (domicile of District Mohmand, or parent/spouse government servant posted in the district) must apply on Local Quota; Local Quota also counts in Open Merit; one application per category per program; overage applicants need an age relaxation certificate. Programs: Pre-Medical, Pre-Engineering, ICS (Computer Sciences), Arts/Humanities.
- Two different merit lists exist: the exam Merit List (/merit-list) and the admission merit lists (shown on /admission under Merit Lists). Never mix them up.
- Answer ONLY the question asked. Do not add unrelated information. If the question is ambiguous, answer the most likely meaning briefly and offer the alternative in one line.
- Admission: state the live status (open/closed), session and last date from the data, then the steps from the knowledge.
- Notices/news: quote real titles and dates from the live notices; do not make up notices. If there are none, say so.
- Specific student's private data (marks, attendance, fees): the website has NO student or parent accounts and cannot show private data — direct them to the school office (/contact). Results are public by roll number on /results.
- Admission fee: it is NOT free. Each online application carries a small processing fee set by the school (usually Rs 100–200); state the exact live amount from the data. Never say admission is free. Never tell anyone to create an account or sign up — no accounts exist for visitors; sign-in is for the school administrator only.
- Verified identity facts you may always state: GHSS Ghallanai, EMIS code 60645, established 1975, located in Ghallanai — the headquarters of District Mohmand (formerly Mohmand Agency), Khyber Pakhtunkhwa, Pakistan; offers 1st Year and 2nd Year (HSSC); affiliated with BISE Peshawar.
- Off-topic questions: briefly redirect to school/website topics. Short, accurate general study help is fine.
- Reply in the visitor's language (Urdu/Pashto included; Roman script if they write in Roman). Default English.

STYLE (premium, professional)
- Warm, polished, confident, respectful — like a well-trained front-desk officer. Greet briefly only on a greeting.
- Start with a direct one-line answer. If useful add up to 4 short bullets starting with "- " (under 18 words each), or a numbered list for steps.
- **Bold** only for key terms/dates. At most one emoji, only if natural. No headings, tables or long paragraphs.
- When a page matches, end with one line such as: "Next step: open the Results page (/results)." Use only these paths: /results /admission /notices /contact /about /faq /merit-list /roll-no-slip /teachers /search. Never mention pages that are not in this list (there is no student portal, news page or calendar page).
- Typically 40–110 words.`;

// ── Live data (read-only, public rows only) ───────────────────────────────
const SB_TIMEOUT_MS = 4500;
const LIVE_TTL_MS = 60_000;
let liveCache: { at: number; text: string } | null = null;

function sbCfg() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "";
  return { url, key, ok: !!(url && key) };
}

async function sbGet(path: string): Promise<any[]> {
  const { url, key } = sbCfg();
  const r = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(SB_TIMEOUT_MS),
  });
  if (!r.ok) throw new Error(`${path.split("?")[0]} → ${r.status}`);
  const t = await r.text();
  const j = t ? JSON.parse(t) : [];
  return Array.isArray(j) ? j : j ? [j] : [];
}
const safe = async (path: string): Promise<any[] | null> => {
  try { return await sbGet(path); } catch (e) {
    console.warn("ai-chat live-data:", (e as Error).message);
    return null;
  }
};

const PK_TZ = "Asia/Karachi";
const fmtDate = (v: any): string => {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: PK_TZ });
};
const fmtDateTime = (v: any): string => {
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleString("en-GB", {
    day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true, timeZone: PK_TZ,
  });
};
// Database stores Annual-I / Annual-II; the public site shows semester names.
const examLabel = (v: any): string => {
  const t = String(v ?? "").trim();
  if (/annual-i\b|1st|first/i.test(t) && !/annual-ii/i.test(t)) return "1st Semester";
  if (/annual-ii|2nd|second/i.test(t)) return "2nd Semester";
  return t || "Exam";
};
const clip = (v: any, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

async function buildLiveData(): Promise<string> {
  if (liveCache && Date.now() - liveCache.at < LIVE_TTL_MS) return liveCache.text;
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push(`Today: ${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: PK_TZ })} (Pakistan time).`);

  if (!sbCfg().ok) {
    lines.push("(Live database is not reachable right now — do not state dates/status; refer visitors to the website pages.)");
    return lines.join("\n");
  }

  const [school, adm, notices, sched, published, dateSheet, roll, merit] = await Promise.all([
    safe(`school_settings?select=school_name,tagline,description,about_text,address,phone,email,established_year,emis_code,total_students,total_teachers,pass_percentage,principal_name&id=eq.1&limit=1`),
    safe(`admission_settings?select=is_open,session_year,open_date,last_date,banner_message,notes,processing_fee,online_payment_enabled&id=eq.1&limit=1`),
    safe(`notices?select=id,title,content,category,is_urgent,is_pinned,created_at,expires_at&is_published=eq.true&order=is_pinned.desc,created_at.desc&limit=14`),
    safe(`results?select=class,exam_type,year,publish_at&is_published=eq.false&publish_at=not.is.null&publish_at=gt.${now.toISOString()}&order=publish_at.asc&limit=60`),
    safe(`results?select=class,exam_type,year,created_at&is_published=eq.true&order=created_at.desc&limit=300`),
    safe(`exam_schedule?select=class,exam_type,year,subject,paper_name,exam_date,start_time,end_time&is_published=eq.true&exam_date=gte.${todayIso}&order=exam_date.asc&limit=40`),
    safe(`exam_roll_sessions?select=*&or=(is_published.eq.true,publish_at.not.is.null)&order=created_at.desc&limit=6`),
    safe(`merit_lists?select=title,scope,class,exam_type,year,is_published,publish_at&or=(is_published.eq.true,publish_at.gt.${now.toISOString()})&order=created_at.desc&limit=6`),
  ]);

  // School
  const sc = school?.[0];
  if (sc) {
    const parts = [
      sc.school_name && `Name: ${sc.school_name}`,
      sc.tagline && `Tagline: ${clip(sc.tagline, 120)}`,
      sc.address && `Address: ${clip(sc.address, 200)}`,
      sc.phone && `Phone: ${sc.phone}`,
      sc.email && `Email: ${sc.email}`,
      sc.established_year && `Established: ${sc.established_year}`,
      sc.emis_code && `EMIS code: ${sc.emis_code}`,
      sc.principal_name && `Principal: ${sc.principal_name}`,
      sc.total_students && `Students: ${sc.total_students}`,
      sc.total_teachers && `Teachers: ${sc.total_teachers}`,
      sc.pass_percentage != null && `Pass percentage: ${sc.pass_percentage}%`,
    ].filter(Boolean);
    lines.push(`\nSCHOOL (from school settings)\n- ${parts.join("\n- ")}`);
    const about = clip(sc.description || sc.about_text, 450);
    if (about) lines.push(`- About: ${about}`);
  }
  lines.push(`- WhatsApp: +92 345 9409585 (https://wa.me/923459409585) · Facebook: https://www.facebook.com/share/19doja9mNr/`);

  // Admission
  const a = adm?.[0];
  if (a) {
    const closedByDate = a.last_date && a.last_date < todayIso;
    const status = a.is_open ? (closedByDate ? "OPEN flag is on but the last date has passed" : "OPEN") : "CLOSED";
    lines.push(
      `\nADMISSION (live from admin dashboard)\n- Status: ${status}` +
      (a.session_year ? `\n- Session: ${a.session_year}` : "") +
      (a.open_date ? `\n- Opens: ${fmtDate(a.open_date)}` : "") +
      (a.last_date ? `\n- Last date: ${fmtDate(a.last_date)}` : "") +
      (a.banner_message ? `\n- Announcement: ${clip(a.banner_message, 250)}` : "") +
      (a.notes ? `\n- Notes: ${clip(a.notes, 300)}` : "")
    );
  } else {
    lines.push("\nADMISSION: live status unavailable — tell the visitor to open /admission for the current status.");
  }

  // Admission procedure — same steps the website's own page/SEO data publishes
  // (api/render.js). Fee and payment options come from the live settings.
  const feeTxt = a?.processing_fee ? `Rs ${a.processing_fee}` : "the processing fee";
  const payTxt = a?.online_payment_enabled === false
    ? "pay by manual transfer to the school account shown on the challan, quoting the payment reference"
    : "pay online (Easypaisa / wallet via Safepay — fee confirmed automatically) or, as a slower fallback, by manual transfer quoting the payment reference";
  lines.push(
    `- HOW TO APPLY (authoritative, current): 1) Open ${SITE_URL}/admission and start the online application (NO account or login is needed). 2) Complete the Personal Information profile. 3) Complete the Matric (SSC) profile (board, session, passing year, group, roll number, marks). 4) Submit a New Admission Request — choose the program (Arts/Humanities, Pre-Medical, Pre-Engineering or ICS) and the admission category (Open Merit, Local Quota, Sports, College Employees or Special Person). The mobile number entered cannot be changed later. 5) Pay ${feeTxt}: ${payTxt}, before the deadline shown on the application. 6) Track with your Tracking ID (the only tracking key) on /admission. 7) Print the form and visit the school with original documents. Applications may also be submitted in person at the school office; postal forms are not accepted.` +
    `\n- DOCUMENTS: Student B-Form/CNIC (NADRA); SSC (Matric) result card/DMC; recent passport photo; father's/guardian's CNIC copy; fee payment confirmation; quota documents where applicable (sports certificate, payslip for school employees, disability certificate).`
  );

  // Results
  const resLines: string[] = [];
  if (sched && sched.length) {
    const seen = new Set<string>();
    for (const r of sched) {
      const k = `${r.class}|${r.exam_type}|${r.year}|${r.publish_at}`;
      if (seen.has(k)) continue; seen.add(k);
      resLines.push(`- SCHEDULED: ${r.class || "All classes"} · ${examLabel(r.exam_type)} ${r.year} — will be published automatically on ${fmtDateTime(r.publish_at)} (Pakistan time)`);
      if (resLines.length >= 6) break;
    }
  }
  if (published && published.length) {
    const seen = new Set<string>(); const items: string[] = [];
    for (const r of published) {
      const k = `${examLabel(r.exam_type)}|${r.year}`;
      if (seen.has(k)) continue; seen.add(k);
      items.push(`${examLabel(r.exam_type)} ${r.year}`);
      if (items.length >= 5) break;
    }
    resLines.push(`- PUBLISHED on /results (newest first): ${items.join("; ")}`);
  }
  if (!resLines.length) resLines.push("- No result is published or scheduled right now. No announcement date exists — do not guess one.");
  lines.push(`\nRESULTS (live)\n${resLines.join("\n")}\n- Grades: A+ 90%+, A 80–89, B 60–79, C 45–59, D 33–44, Fail below 33.`);

  // Date sheet
  if (dateSheet && dateSheet.length) {
    const rows = dateSheet.slice(0, 14).map((e) =>
      `- ${fmtDate(e.exam_date)}: ${e.class} · ${clip(e.paper_name || e.subject, 60)}${e.start_time ? ` (${String(e.start_time).slice(0, 5)}${e.end_time ? "–" + String(e.end_time).slice(0, 5) : ""})` : ""} — ${examLabel(e.exam_type)} ${e.year}`
    );
    lines.push(`\nUPCOMING EXAM DATE SHEET (live)\n${rows.join("\n")}`);
  } else if (dateSheet) {
    lines.push("\nUPCOMING EXAM DATE SHEET: none published right now.");
  }

  // Roll slips
  if (roll && roll.length) {
    const rows = roll.slice(0, 4).map((r) => {
      const name = r.title || r.name || r.session_name || [r.exam_type, r.year].filter(Boolean).join(" ") || "Roll number slips";
      const st = r.is_published ? "available now on /roll-no-slip" : r.publish_at ? `goes live ${fmtDateTime(r.publish_at)}` : "not live yet";
      return `- ${clip(name, 80)}: ${st}`;
    });
    lines.push(`\nROLL NUMBER SLIPS (live)\n${rows.join("\n")}`);
  }

  // Merit
  if (merit && merit.length) {
    lines.push(`\nEXAM MERIT LISTS (/merit-list)\n${merit.map((m) => `- ${clip(m.title || [m.scope, m.class, examLabel(m.exam_type), m.year].filter(Boolean).join(" "), 80)}: ${m.is_published ? "published" : `goes live ${fmtDateTime(m.publish_at)} (Pakistan time)`}`).join("\n")}`);
  }

  // Notices
  if (notices) {
    const live = notices.filter((n) => !n.expires_at || new Date(n.expires_at) > now).slice(0, 8);
    if (live.length) {
      lines.push(`\nLATEST NOTICES (live, newest first)\n${live.map((n) =>
        `- [${fmtDate(n.created_at)}]${n.is_urgent ? " URGENT" : ""} ${clip(n.title, 110)} (${n.category || "General"}) — ${clip(n.content, 180)} → ${SITE_URL}/notices/${n.id}`
      ).join("\n")}`);
    } else {
      lines.push("\nLATEST NOTICES: no active notices right now.");
    }
  }

  const text = lines.join("\n");
  liveCache = { at: Date.now(), text };
  return text;
}

// Pick the few FAQ entries most relevant to the question (keyword overlap) so
// the prompt stays small and fast.
function relevantFaq(question: string, max = 5): string {
  const stop = new Set(["the","a","an","is","are","to","of","for","and","in","on","do","i","how","what","when","can","my","me","you","at","it","be","this","that","with","school","ghss","ghallanai","please","tell","about","where","does","need","get","want"]);
  // Roman-Urdu / common aliases → words used in the FAQ text.
  const alias: Record<string, string[]> = {
    dakhla: ["admission"], dakhly: ["admission"], natija: ["result"], nataij: ["result"], parchi: ["slip"],
    fees: ["fee"], charges: ["fee"], payment: ["fee", "pay"], pay: ["fee"], quota: ["categories"], category: ["categories"],
    dmc: ["result", "report"], marks: ["result"], position: ["merit"], toppers: ["merit"], datesheet: ["date", "sheet"],
    admit: ["slip"], card: ["slip"], whatsapp: ["contact"], phone: ["contact"], number: ["contact", "roll"],
    apply: ["admission", "apply"], form: ["admission"], tracking: ["track"], status: ["track"],
  };
  const raw = (question.toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter((w) => !stop.has(w));
  const words = Array.from(new Set(raw.flatMap((w) => [w, ...(alias[w] || [])])));
  if (!words.length) return "";
  const scored = (FAQ_ITEMS as any[]).map((f) => {
    const qLow = f.question.toLowerCase();
    const aLow = f.answer.toLowerCase();
    let sc = 0;
    for (const w of words) {
      if (qLow.includes(w)) sc += 4;
      else if (aLow.includes(w)) sc += 1;
    }
    return { f, sc };
  }).filter((x) => x.sc >= 3).sort((x, y) => y.sc - x.sc).slice(0, max);
  return scored.map(({ f }) => `Q: ${f.question}\nA: ${clip(f.answer, 1100)}`).join("\n\n");
}

async function buildSystemPrompt(lastQuestion: string): Promise<string> {
  let live = "";
  try { live = await buildLiveData(); } catch (e) {
    console.warn("ai-chat: live data failed:", (e as Error).message);
    live = "(Live data could not be loaded — do not state dates or status; point to the website pages.)";
  }
  const faq = relevantFaq(lastQuestion);
  return `${BASE_RULES}\n\n=== LIVE SCHOOL DATA ===\n${live}\n\n=== WEBSITE KNOWLEDGE (official FAQ — procedures) ===\n${faq || "(no matching FAQ entry — answer from live data or say it is not published)"}`;
}

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Identity guard ─────────────────────────────────────────────────────────
// Questions like "who built you?" must ALWAYS get the same correct answer,
// never a guess from the underlying model — so they are answered instantly
// here (no upstream call, zero latency) in the homepage assistant mode.
const IDENTITY_PATTERNS: RegExp[] = [
  /\bwho\b.{0,25}\b(built|made|created|developed|designed|programmed|trained|owns?|invented|coded|launched)\b.{0,25}\b(you|this (ai|assistant|bot|chatbot))\b/i,
  /\b(who|which)\b.{0,12}\b(is|are)\b.{0,12}\b(your|ur)\b.{0,12}\b(creator|developer|maker|owner|builder|author|company|team)\b/i,
  /\b(your|ur)\s+(creator|developer|maker|owner|builder|author)\b/i,
  /\bwho\s+(is|are)\s+(behind|responsible for)\s+(you|this)\b/i,
  /\bwhich\s+(ai|model|llm|company|technology|tech)\b.{0,30}\b(are you|is this|do you use|powers?|behind)\b/i,
  /\b(what|which)\s+(model|llm|ai)\s+(are|is)\s+(you|this|used)\b/i,
  /\bare\s+you\s+(chat\s*gpt|gpt|openai|claude|gemini|bard|glm|zhipu|z\.?ai|deepseek|llama|copilot|a\s+real\s+(person|human))\b/i,
  /\b(kis|kisne|kis\s*ne|kon|kaun)\b.{0,20}\b(bana|banaya|banai|banayi|tayyar|develop)\b/i,
  /(کس\s*نے|کون).{0,20}(بنایا|بنائی|تیار)/,
];
const IDENTITY_REPLY =
  "I'm the **GHSS Ghallanai AI Assistant**, built by the **GHSS Ghallanai Administration** to serve our students, parents and visitors.\n" +
  "- I can help with admissions, results, roll number slips, notices and more.\n" +
  "- For anything beyond that, the school office is always available via the Contact page (/contact).";
// "Who built GHSS Ghallanai / this website?" — the visitor means the school's
// website; the answer is always the school administration.
const WEBSITE_BUILDER_PATTERNS: RegExp[] = [
  /\bwho\b.{0,20}\b(built|build|made|make|created|create|developed|develop|designed|design|runs?|manages?|maintains?|owns?|behind)\b.{0,30}\b(ghss?|ghallanai|this\s+(web)?site|the\s+(web)?site|our\s+(web)?site|website|web\s*site|portal|this\s+(portal|page|app|platform))\b/i,
  /\b(website|web\s*site|portal|app|platform)\b.{0,25}\b(built|made|created|developed|designed)\s+by\b/i,
  /\b(ghss?|ghallanai)\b.{0,30}\b(website|web\s*site|portal)\b.{0,30}\b(who|developer|creator|maker)\b/i,
];
const WEBSITE_BUILDER_REPLY =
  "The **GHSS Ghallanai website** and this AI Assistant were built by the **GHSS Ghallanai Administration**.\n" +
  "- The site brings admissions, results, roll number slips, merit lists and notices into one place.\n" +
  "- To learn about the school itself, see the About page (/about) or reach the office via /contact.";
function identityReply(text: string): string | null {
  const t = text.slice(0, 300);
  // Website question first: "who built GHSS Ghallanai" must not read as "who built you".
  if (WEBSITE_BUILDER_PATTERNS.some((re) => re.test(t)) &&
      !/\b(you|yourself)\b/i.test(t)) return WEBSITE_BUILDER_REPLY;
  if (IDENTITY_PATTERNS.some((re) => re.test(t))) return IDENTITY_REPLY;
  return null;
}

// ── SSE + response helpers ────────────────────────────────────────────────
function sseFrame(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function applyCors(res: NodeServerResponse): void {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);
}

function jsonError(
  res: NodeServerResponse,
  status: number,
  body: unknown
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  applyCors(res);
  res.end(JSON.stringify(body));
}

// Errors that mean "this attempt produced nothing visible — try again".
class RetryableAttemptError extends Error {}

// Errors that mean "stop — partial text is already on the visitor's screen".
class PartialStreamError extends Error {
  sentChars: number;
  constructor(sentChars: number, reason: string) {
    super(reason);
    this.sentChars = sentChars;
  }
}

interface AttemptResult {
  charsSent: number;
  model: string;
}

/**
 * One full upstream session: connect → first token → stream until done.
 *
 * Watchdogs:
 *   • ATTEMPT_BUDGET_MS hard cap on the WHOLE attempt (AbortController) —
 *     releases the socket on connect stalls AND runaway streams.
 *   • FIRST_TOKEN_TIMEOUT_MS inactivity race until the first VISIBLE token —
 *     a connected-but-silent pool slot is retried on the other model instead
 *     of stalling the visitor.
 *
 * Throws RetryableAttemptError when nothing was sent (caller may retry);
 * throws PartialStreamError when tokens already went out and the stream then
 * died (caller must NOT retry — text is on screen).
 */
async function streamOneAttempt(
  model: string,
  systemPrompt: string,
  cleaned: IncomingMessage[],
  send: (obj: unknown) => boolean,
  deadlineAt: number
): Promise<AttemptResult> {
  const controller = new AbortController();
  const attemptTimer = setTimeout(
    () => controller.abort(),
    Math.min(ATTEMPT_BUDGET_MS, Math.max(1000, deadlineAt - Date.now()))
  );
  let charsSent = 0;
  let sawDone = false;

  const payload = {
    model,
    messages: [{ role: "system", content: systemPrompt }, ...cleaned],
    temperature: 0.2,
    max_tokens: 600,
    stream: true,
    // GLM-4.5/4.7 models can run a hidden "thinking" reasoning pass before
    // writing visible output — from the browser it just looks like a long
    // stall before the first token. Short website Q&A doesn't need it.
    thinking: { type: "disabled" },
  };

  try {
    const res = await fetch(ZAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ZAI_API_KEY}`,
        Accept: "text/event-stream",
        // Headers intentionally mirror api/ai-result-summary.ts — the exact
        // shape PROVEN to stream instantly from this deployment. (The old
        // extra "Accept-Encoding: identity" header bought nothing and was
        // one more difference from the healthy path.)
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(
        `ai-chat: Z.AI ${model} returned ${res.status}:`,
        errText.slice(0, 300)
      );
      // Auth/key problems will never heal by retrying — surface a clear,
      // owner-actionable message immediately.
      if (res.status === 401 || res.status === 403) {
        const err = new Error(
          "AI service authentication failed. The site owner needs to check the ZAI_API_KEY configuration."
        );
        (err as any).fatalAuth = true;
        throw err;
      }
      throw new RetryableAttemptError(`upstream ${res.status} (${model})`);
    }

    if (!res.body) {
      // Some providers ignore stream:true and return one JSON blob.
      const data = await res.json().catch(() => null);
      const reply: string =
        data?.choices?.[0]?.message?.content ??
        data?.choices?.[0]?.delta?.content ??
        "";
      if (reply && reply.trim()) {
        if (send({ token: reply.trim() })) charsSent += reply.trim().length;
        send({ done: true });
        return { charsSent, model };
      }
      throw new RetryableAttemptError(`upstream returned no body (${model})`);
    }

    // ── Read the upstream SSE stream ────────────────────────────────────────
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let lineBuf = "";
    let firstTokenSeen = false;

    const readWithFirstTokenGuard = (): Promise<ReadableStreamReadResult<Uint8Array>> => {
      if (firstTokenSeen) return reader.read(); // attempt budget covers stalls
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const err: any = new Error("first-token watchdog");
          err.firstTokenWatchdog = true;
          reject(err);
        }, Math.max(1000, FIRST_TOKEN_TIMEOUT_MS));
        reader
          .read()
          .then((v) => {
            clearTimeout(timer);
            resolve(v);
          })
          .catch((e) => {
            clearTimeout(timer);
            reject(e);
          });
      });
    };

    while (true) {
      if (Date.now() > deadlineAt) {
        if (charsSent > 0) throw new PartialStreamError(charsSent, "global deadline");
        throw new RetryableAttemptError("global deadline before first token");
      }

      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await readWithFirstTokenGuard();
      } catch (err: any) {
        if (err?.firstTokenWatchdog && charsSent === 0) {
          throw new RetryableAttemptError(`first-token watchdog (${model})`);
        }
        if (charsSent > 0) {
          throw new PartialStreamError(charsSent, err?.message || "stream error");
        }
        throw new RetryableAttemptError(err?.message || `stream error (${model})`);
      }
      if (chunk.done) break;

      lineBuf += decoder.decode(chunk.value, { stream: true });

      let idx: number;
      while ((idx = lineBuf.indexOf("\n\n")) !== -1) {
        const frame = lineBuf.slice(0, idx);
        lineBuf = lineBuf.slice(idx + 2);

        const dataLines = frame
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim());
        if (dataLines.length === 0) continue;

        const dataStr = dataLines[dataLines.length - 1];
        if (dataStr === "[DONE]") {
          sawDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(dataStr);
          const token: string =
            parsed?.choices?.[0]?.delta?.content ??
            parsed?.choices?.[0]?.message?.content ??
            "";
          if (token) {
            firstTokenSeen = true;
            if (!send({ token })) {
              // Client disconnected — nothing more to do.
              return { charsSent, model };
            }
            charsSent += token.length;
          }
        } catch {
          // Ignore malformed JSON frames (keepalive comments, etc.)
        }
      }
      if (sawDone) break;
    }

    if (charsSent === 0) {
      throw new RetryableAttemptError(`stream ended with no tokens (${model})`);
    }
    if (!sawDone) {
      // Upstream ended without [DONE] but we delivered content — treat as a
      // completed (if imperfect) answer; the text on screen is coherent.
      console.warn(`ai-chat: upstream stream ended without [DONE] (${model})`);
    }
    return { charsSent, model };
  } finally {
    clearTimeout(attemptTimer);
    try {
      controller.abort(); // release the upstream socket either way
    } catch {
      // noop
    }
  }
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
function rateLimitHit(req: NodeIncomingMessage): boolean {
  const ip =
    (req.headers["cf-connecting-ip"] as string) ||
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    (req.headers["x-real-ip"] as string) ||
    "unknown";
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
}

// ── Handler ───────────────────────────────────────────────────────────────────
export default async function handler(
  req: NodeIncomingMessage,
  res: NodeServerResponse
) {
  applyCors(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    return res.end();
  }
  if (req.method !== "POST") {
    return jsonError(res, 405, { error: "Method not allowed" });
  }
  if (!ZAI_API_KEY) {
    console.error("ai-chat: ZAI_API_KEY env var is not set on the server");
    return jsonError(res, 500, {
      error:
        "AI Assistant is not configured. The site owner needs to set the ZAI_API_KEY env var in Vercel.",
    });
  }
  if (rateLimitHit(req)) {
    return jsonError(res, 429, {
      error: "Too many questions in a minute. Please wait a moment and try again.",
    });
  }

  // Parse + validate the incoming messages array.
  // Vercel's Node runtime parses JSON bodies into req.body automatically.
  let messages: IncomingMessage[] = [];
  try {
    const raw: any =
      typeof (req as any).body === "string"
        ? JSON.parse((req as any).body || "{}")
        : (req as any).body;
    if (!raw) throw new Error("empty body");
    messages = Array.isArray(raw?.messages) ? raw.messages : [];
  } catch {
    return jsonError(res, 400, { error: "Invalid JSON body." });
  }

  // Keep only valid user/assistant turns, drop empties, cap to last 8 turns
  // so the prompt stays small and the response stays fast.
  const cleaned: IncomingMessage[] = messages
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .slice(-8)
    .map((m) => ({ role: m.role, content: m.content.trim() }));

  if (cleaned.length === 0 || cleaned[cleaned.length - 1].role !== "user") {
    return jsonError(res, 400, { error: "No user message provided." });
  }

  // Identity questions (homepage assistant only) get the fixed, correct answer.
  const fixedReply = identityReply(cleaned[cleaned.length - 1].content);
  if (fixedReply) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    res.write(sseFrame({ token: fixedReply }));
    res.write(sseFrame({ done: true }));
    return res.end();
  }

  const systemPrompt = await buildSystemPrompt(cleaned[cleaned.length - 1].content);

  // ── Open the SSE response ─────────────────────────────────────────────────
  // Headers go out IMMEDIATELY (Node runtime — the exact pattern that is
  // proven healthy in production via ai-result-summary), so the client's
  // fetch resolves instantly and its "Thinking" state is bounded by OUR
  // budget, never by a platform black hole.
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  let clientClosed = false;
  req.on("close", () => {
    clientClosed = true;
  });

  const send = (obj: unknown): boolean => {
    if (clientClosed) return false;
    try {
      res.write(sseFrame(obj));
      return true;
    } catch {
      clientClosed = true;
      return false;
    }
  };

  const startedAt = Date.now();
  const deadlineAt = startedAt + GLOBAL_BUDGET_MS;
  // Attempt chain: primary → fallback (fresh connection each time).
  const modelChain: string[] = [PRIMARY_MODEL, FALLBACK_MODEL];

  let lastError = "";
  let fatalMessage = ""; // e.g. bad ZAI_API_KEY — message the owner can act on
  let charsSentTotal = 0;

  for (let attempt = 0; attempt < modelChain.length; attempt++) {
    if (clientClosed) break;
    // Attempt 1 ALWAYS runs — the deadline inside streamOneAttempt caps it.
    // Retries only start when enough budget remains to be worth it.
    const remaining = deadlineAt - Date.now();
    if (attempt > 0 && remaining < MIN_ATTEMPT_RESERVE_MS) {
      console.warn(
        `ai-chat: stopping before attempt ${attempt + 1}, only ${remaining}ms left in budget`
      );
      break;
    }
    // Short cool-down before retry attempts — an instantly-rejected previous
    // attempt (429 / concurrency cap) benefits from a brief pause. Never
    // sleeps past the global deadline, and attempt 1 never waits.
    if (attempt > 0) {
      const room = deadlineAt - Date.now() - 500;
      if (room > 0) {
        await new Promise((r) => setTimeout(r, Math.min(RETRY_BACKOFF_MS, room)));
      }
      if (clientClosed) break;
    }

    const model = modelChain[attempt];
    try {
      const result = await streamOneAttempt(
        model,
        systemPrompt,
        cleaned,
        send,
        deadlineAt
      );
      charsSentTotal += result.charsSent;
      if (attempt > 0) {
        console.log(
          `ai-chat: recovered on attempt ${attempt + 1} (model ${model}) after: ${lastError}`
        );
      }
      break; // attempt completed
    } catch (err: any) {
      if (err instanceof PartialStreamError) {
        // Tokens are already on the visitor's screen — end gracefully,
        // never retry (a retry would duplicate the partial answer).
        console.warn(
          `ai-chat: ${err.message} — ending gracefully with partial answer`
        );
        charsSentTotal += err.sentChars;
        break;
      }
      lastError = err?.message || String(err);
      console.warn(`ai-chat: attempt ${attempt + 1} failed (${model}): ${lastError}`);
      if ((err as any)?.fatalAuth) {
        fatalMessage = err.message;
        break; // retrying a bad key is pointless
      }
      if (clientClosed) break; // client gone — no point retrying
      continue;
    }
  }

  if (!clientClosed) {
    if (charsSentTotal === 0) {
      if (fatalMessage) {
        console.error(`ai-chat: fatal upstream auth problem: ${fatalMessage}`);
        send({ error: fatalMessage });
      } else {
        console.error(`ai-chat: all attempts failed. Last error: ${lastError}`);
        send({
          error:
            "The AI assistant is busy right now. Please send your question again in a few seconds.",
        });
      }
    } else {
      send({ done: true });
    }
  }
  res.end();
}
