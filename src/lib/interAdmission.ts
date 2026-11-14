/**
 * interAdmission — Intermediate (1st / 2nd Year) online admission system for
 * Government Higher Secondary School Ghallanai, District Mohmand.
 *
 * Faculties: Pre-Medical · Pre-Engineering · ICS (Computer Sciences) · Arts/Humanities.
 *
 * Auth model: NO accounts and NO login.  The applicant's data stays in a
 * draft on their own device (lib/admissionDraft.ts) until the final
 * captcha-verified submit, when ONE atomic server call (inter_apply) stores
 * everything and returns a private session token (uuid, inter_applicant_sessions)
 * used for payment / edit / view.  Applicants are NOT Supabase-Auth users.
 * All data access flows through SECURITY DEFINER RPCs that resolve the token.
 *
 * ── SECURITY CHANGE (migration 24) ──────────────────────────────────────────
 * inter_apply / inter_track are NOT callable directly from the browser with
 * the anon key.  The browser must go through the Vercel auth-gateway, which
 * verifies a Cloudflare Turnstile token first.  So interApi.apply / track POST to
 * /api/auth-gateway instead of supabase.rpc(...).  Everything else still uses
 * supabase.rpc because those RPCs take a token and are self-gating.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from "@/lib/supabase";
import { authGateway } from "@/lib/authGateway";
import { cachedOrDirect } from "@/lib/publicData";
import { ADMISSION_CLIENT_CACHE } from "@/config/admissionCache";

export const INTER_TOKEN_KEY = "inter_admission_token";
/** Fired whenever the private session token is set or cleared (same tab). */
export const TOKEN_EVENT = "inter-token-change";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

export const COLLEGE_NAME = "Government Higher Secondary School Ghallanai";
export const COLLEGE_SHORT = "GHSS Ghallanai, District Mohmand";
export const STUDY_LEVEL = "Intermediate";
/** Fallback cycle label; the live label comes from Admission Settings (cycleLabel). */
export const ADMISSION_CYCLE = "F.A/F.Sc Admissions 2026";
export const PROCESSING_FEE = 100;

/** The four faculties of GHSS Ghallanai */
export const FACULTIES = [
  "Pre-Medical",
  "Pre-Engineering",
  "ICS (Computer Sciences)",
  "Arts/Humanities",
] as const;

/**
 * Subject groups per program (fallback only; the live list comes from the
 * inter_programs_list RPC).
 */
export const SUBJECT_GROUPS: Record<string, string[]> = {
  "Pre-Medical": ["Botany,Chemistry,English,Islamic Edu,Mutalia-e-Quran,Physics,Urdu"],
  "Pre-Engineering": ["Chemistry,English,Islamic Edu,Maths,Mutalia-e-Quran,Physics,Urdu"],
  "ICS (Computer Sciences)": ["Computer Sc,English,Islamic Edu,Maths,Mutalia-e-Quran,Physics,Urdu"],
  "Arts/Humanities": [
    "Civics,English,HPE,Islamic Edu,Library Science,Mutalia-e-Quran,Urdu",
    "Civics,Economics,English,Geography,Islamic Edu,Mutalia-e-Quran,Urdu",
  ],
};

export const PROVINCES = [
  "Khyber Pakhtunkhwa",
  "Punjab",
  "Sindh",
  "Balochistan",
  "Islamabad (capital Area)",
  "Gilgit & Biltestan",
  "Azad Jammu And Kashmir",
] as const;

export const RELIGIONS = ["Islam", "Hinduism", "Christianity", "Sikhism", "Other"] as const;

export const NATIONALITIES = ["Pakistani", "Afghani"] as const;

export const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
] as const;

/** Mohmand tehsils */
export const MOHMAND_TEHSILS = [
  "Baizai", "Khwezai", "Safi", "Prang Ghar", "Halimzai", "Tarakzai",
  "Utman Khel", "Lakaro", "Ekka Ghund", "Ambar", "Pandyalai", "Ghallanai",
] as const;

/** Pakistan-wide domicile district list */
export const DISTRICTS: string[] = [
  "Abbottabad", "Astore", "Attock", "Awaran", "Bagh", "Bahawalnagar", "Bahawalpur",
  "Bajaur", "Bannu", "Bar Swat", "Barkhan", "Battagram", "Bhakkar", "Buner",
  "Chagai", "Chakwal", "Chaman", "Charsadda", "Chiniot", "Dadu", "Darel",
  "Dera Bugti", "Dera Ghazi Khan", "Dera Ismail Khan", "Diamer", "Dir Lower",
  "Dir Upper", "Duki", "Faisalabad", "Ghanche", "Ghizer", "Ghotki", "Gilgit",
  "Gujranwala", "Gujrat", "Gwadar", "Hafizabad", "Hangu", "Haripur", "Harnai",
  "Haveli", "Hub", "Hunza", "Hyderabad", "Islamabad", "Jacobabad", "Jafarabad",
  "Jamshoro", "Jehlum Valley", "Jhal Magsi", "Jhang", "Jhelum", "Kachhi",
  "Kalat", "Kambar Shahdadkot", "Karachi", "Karak", "Kashmore", "Kasur", "Kech",
  "Khairpur", "Khanewal", "Kharan", "Kharmang", "Khushab", "Khuzdar", "Khyber",
  "Killa Abdullah", "Kohat", "Kohistan Lower", "Kohistan Upper", "Kohlu",
  "Kolai Palas", "Kurram", "Lahore", "Lakki Marwat", "Larkana", "Lasbela",
  "Layyah", "Lodhran", "Loralai", "Lower Chitral", "Malakand",
  "Mandi Bahauddin", "Mansehra", "Mardan", "Matiari", "Mianwali", "Mirpurkhas",
  "Mohmand", "Multan", "Musakhel", "Mustang", "Muzaffargarh", "Muzzafar Abad",
  "Nagar", "Nankana Sahib", "Narowal", "Nasirabad", "Naushahro Firoze",
  "Neelam", "North Waziristan", "Nowshera", "Nushki", "Okara", "Orakzai",
  "Pakpattan", "Panjgur", "Peshawar", "Pishin", "Poonch", "Qila Saifullah",
  "Quetta", "Rahim Yar Khan", "Rajanpur", "Rawalpindi", "Rondu", "Sahiwal",
  "Sanghar", "Sargodha", "Shaheed Benazirabad", "Shangla", "Sheikhupura",
  "Sherani", "Shigar", "Shikarpur", "Sialkot", "Sibi", "Skardu", "Sohbatpur",
  "South Waziristan", "Sujawal", "Sukkur", "Surab", "Swabi", "Swat",
  "Tando Allahyar", "Tando Muhammad Khan", "Tank", "Tharparkar", "Thatta",
  "Toba Tek Singh", "Tor Ghar", "Umerkot", "Upper Chitral", "Usta Muhammad",
  "Vehari", "Washuk", "Zhob", "Ziarat",
];

/** Exam boards */
export const EXAM_BOARDS = [
  "BISE Peshawar", "BISE Abbottabad", "BISE Bannu", "BISE DI Khan", "BISE Kohat",
  "BISE Malakand", "BISE Mardan", "BISE Swat", "BISE Swabi", "Agha Khan Board",
  "BIE Karachi", "BISE Ajk Mirpur", "BISE Bahawalpur", "BISE D.G.Khan",
  "BISE Faisalabad", "BISE Gujranwala", "BISE Hyderabad", "BISE Lahore",
  "BISE Larkana", "BISE Multan", "BISE Rawalpindi", "BISE Sahiwal",
  "BISE Sargodha", "BISE Sukkur", "Federal Board", "BISE Quetta",
  "Other Board",
];

export const STUDY_GROUPS = [
  "Science (Biology, Chemistry, Physics, Maths)",
  "Science (Computer Sc, Chemistry, Physics, Maths)",
  "Arts",
  "General",
] as const;

export const EXAM_SESSIONS = ["Annual", "Supplementary"] as const;

export const SPORT_CERTIFICATES = [
  "School Level Certificate",
  "College Level Certificate",
  "District Level Certificate",
  "Inter District Certificate",
  "Inter Colleges Level Certificate",
  "BISE Inter School Certificate",
  "DHE Regional Level Certificate",
  "Regional Level Certificate",
  "Provincial Certificate",
  "Inter-board Level Certificate",
  "BISE Level Certificate",
  "Other National Level Certificate",
] as const;

export const DISABILITY_TYPES = [
  "Hearing", "Learning", "Mental Health", "Movement", "Vision", "Thinking", "Other",
] as const;

export const LOCAL_CRITERIA = [
  { value: "domicile_of_area", label: "Having Domicile of the Local Area" },
  { value: "father_serve_area", label: "Parent / Spouse Posting as Govt. Servant in District" },
] as const;

/** Quotas offered for Intermediate admission */
export const QUOTAS = [
  { value: "open_merit", label: "Open Merit" },
  { value: "local_quota", label: "Local Quota" },
  { value: "sports", label: "Sports" },
  { value: "college_employees", label: "College Employees" },
  { value: "special_person", label: "Special Person" },
] as const;

export type QuotaValue = (typeof QUOTAS)[number]["value"];

export const QUOTA_LABEL: Record<string, string> = Object.fromEntries(
  QUOTAS.map((q) => [q.value, q.label]),
);

/** Standard applicant-facing messages */
export const ADMISSION_MESSAGES = {
  localMustUseLocal:
    "Your domicile is local; therefore, apply on Local Quota.",
  duplicate:
    "Error! You have already applied for this program in this college, please select a different program.",
  oneActivePerCycle:
    "You already have an active application for this admission cycle. Use \"Edit Application\" to change your program, group or quota, or contact the college if you need to submit a new one.",
  overage:
    "You are overage. An age relaxation certificate is required for Inter admission.",
  overageSports: "You are overage and not eligible for the sports quota",
  meritNote:
    "Every applicant competes for the seats of the program on merit, whichever category the application was submitted on.",
  declaration:
    "I declare that the information given in support of the application is accurate and complete. I understand that any misrepresentation will result in disqualification of my application for admission.",
  locked:
    "This application is now locked because the fee has been paid. Contact the college office if you need to change it.",
  feeTokenNotice: (reference: string, deadline: string) =>
    `Pay the processing fee online, or by manual transfer to the school account shown on your challan quoting reference ${reference}, on or before ${deadline}.`,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Session helpers
// ─────────────────────────────────────────────────────────────────────────────

export function getToken(): string | null {
  try {
    return localStorage.getItem(INTER_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(INTER_TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
  try { window.dispatchEvent(new Event(TOKEN_EVENT)); } catch { /* ignore */ }
}

export function clearToken() {
  try {
    localStorage.removeItem(INTER_TOKEN_KEY);
  } catch {
    /* ignore */
  }
  try { window.dispatchEvent(new Event(TOKEN_EVENT)); } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// RPC wrappers
//
// apply / track → go through the Vercel auth-gateway (Turnstile + service
// role) because anon EXECUTE is revoked on them.
// Everything else still calls supabase.rpc directly (those RPCs take a token
// and are self-gating).
//
// SLOW-INTERNET HARDENING (two properties every wrapper now guarantees):
//   1. NEVER HANGS — supabase-js has no default timeout, so a stalled request
//      on 2G kept queries "loading" forever. Every RPC is raced against a
//      hard cap (ADMISSION_CLIENT_CACHE.rpcTimeoutMs).
//   2. NETWORK ≠ REJECTED — a fetch failure must never be confused with the
//      server's own {ok:false} answers. Results carry `network: true` so the
//      session hook can retry instead of logging the applicant out (the old
//      behaviour: one dropped packet mid-application → bounced to login).
// ─────────────────────────────────────────────────────────────────────────────

type RpcResult = Record<string, unknown> & { ok?: boolean; error?: string; network?: boolean };

/** Messages supabase-js produces when the REQUEST never reached the server
 *  (as opposed to the server answering "no / invalid"). Checked case-blind. */
const NETWORK_ERROR_RE =
  /failed to fetch|fetch failed|networkerror|network request failed|load failed|timeout|timed out|aborted|aborterror|econn|enotfound|dns|socket|connection (refused|reset|closed)|service unavailable|temporarily unavailable|offline/i;

/** True when an interApi result failed because of the CONNECTION, not the
 *  server's verdict. Callers must retry these, never treat them as a final
 *  "session expired" / "not found" answer. */
export function isAdmissionNetworkError(r: unknown): boolean {
  if (!r || typeof r !== "object") return false;
  if ((r as RpcResult).network === true) return true;
  const err = (r as RpcResult).error;
  return typeof err === "string" && NETWORK_ERROR_RE.test(err);
}

const NETWORK_FAIL: RpcResult = {
  ok: false,
  error: "Network error. Please check your connection and try again.",
  network: true,
};

async function rpc(fn: string, params: Record<string, unknown>): Promise<RpcResult> {
  let outcome: { data: unknown; error?: { message?: string } | null };
  try {
    // Race the real call against the hard cap. The abandoned request (if any)
    // finishes harmlessly in the background — its result is discarded.
    outcome = await Promise.race([
      supabase.rpc(fn, params),
      new Promise<{ data: null; error: { message: string } }>((resolve) =>
        setTimeout(
          () => resolve({ data: null, error: { message: `Request timed out after ${Math.round(ADMISSION_CLIENT_CACHE.rpcTimeoutMs / 1000)} seconds.` } }),
          ADMISSION_CLIENT_CACHE.rpcTimeoutMs,
        ),
      ),
    ]);
  } catch {
    // supabase-js can also reject outright (aborted request, storage errors)
    return { ...NETWORK_FAIL };
  }
  if (outcome.error) {
    const message = String(outcome.error.message ?? "");
    // Surface network/RPC errors as normal error payloads
    return { ok: false, error: message, network: NETWORK_ERROR_RE.test(message) };
  }
  return (outcome.data ?? { ok: false, error: "Unexpected empty response." }) as RpcResult;
}

// ── Fast public tracking ────────────────────────────────────────────────────
// A plain fetch straight to the database REST endpoint: no server function,
// and no supabase-js session / auth-lock handling that could stall a public
// lookup.  • An obviously wrong ID is answered instantly (no network).
// • Repeat searches come from memory (30 s found / 15 s not found).
// • Each attempt is capped at 6 s and retried ONCE.
// • A server-side problem is reported as such (with a short technical detail)
//   instead of being mislabelled as "slow internet".
const TRACK_ATTEMPT_MS = 6000;
const trackCache = new Map<string, { at: number; ttl: number; res: RpcResult }>();

async function trackByTrackingId(trackingId: string): Promise<RpcResult> {
  const key = String(trackingId ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (key.length < 8 || key.length > 24) return { ok: false };

  const hit = trackCache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.res;

  const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!base || !anon) return { ok: false, error: "Could not check right now.", detail: "Site configuration is missing." };

  let netFailed = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TRACK_ATTEMPT_MS);
    try {
      const r = await fetch(`${base}/rest/v1/rpc/inter_track_by_id`, {
        method: "POST",
        headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
        body: JSON.stringify({ p_tracking_id: key }),
        signal: ctrl.signal,
      });
      if (r.ok) {
        const data = (await r.json().catch(() => ({ ok: false }))) as RpcResult;
        const res: RpcResult = data && typeof data === "object" ? data : { ok: false };
        trackCache.set(key, { at: Date.now(), ttl: res.ok ? 30_000 : 15_000, res });
        return res;
      }
      // The server ANSWERED with an error — retrying will not help.
      let msg = "";
      try { const j = await r.json(); msg = String(j?.message ?? j?.hint ?? ""); } catch { /* ignore */ }
      const missing = r.status === 404 || /could not find the function|PGRST202/i.test(msg);
      return {
        ok: false,
        error: "Could not check right now.",
        detail: missing
          ? "Tracking is not enabled on the server yet (database update 28 has not been run)."
          : `Server answered ${r.status}${msg ? `: ${msg.slice(0, 120)}` : ""}`,
      };
    } catch {
      netFailed = true;           // timeout / offline — worth one retry
    } finally {
      clearTimeout(timer);
    }
  }
  return netFailed ? { ...NETWORK_FAIL } : { ok: false, error: "Could not check right now." };
}

export const interApi = {
  /** Final submit — ONE atomic write (applicant + profiles + application),
   *  routed via the auth-gateway (Turnstile verified). Returns a session token. */
  apply: (p: {
    nationality: string; cnic: string;
    personal: Record<string, unknown>; ssc: Record<string, unknown>;
    programId: number; quota: string; criteria: Record<string, unknown>;
    subjectGroup: string | null; turnstile: string;
  }) => authGateway.apply(p) as Promise<RpcResult>,

  logout: (token: string) => rpc("inter_logout", { p_token: token }),
  sessionState: (token: string) => rpc("inter_session_state", { p_token: token }),
  savePersonal: (token: string, data: Record<string, unknown>) =>
    rpc("inter_save_personal", { p_token: token, p_data: data }),
  saveSsc: (token: string, data: Record<string, unknown>) =>
    rpc("inter_save_ssc", { p_token: token, p_data: data }),
  // ── Public reads — CDN-cached (api/public-data.js, migration 25 plan) with
  //    the original RPC as the fallback. Bots and repeated visitors hit the
  //    Vercel edge, not the Supabase Nano compute.
  programsList: () =>
    cachedOrDirect<RpcResult>("admission-programs", {}, () => rpc("inter_programs_list", {})),
  ucsList: () =>
    cachedOrDirect<RpcResult>("admission-ucs", {}, () => rpc("inter_ucs_list", {})),
  checkQuota: (token: string, quota: string, criteria: Record<string, unknown> | null) =>
    rpc("inter_check_quota", { p_token: token, p_quota: quota, p_criteria: criteria }),
  /** Same eligibility rules, driven by the on-device draft (writes nothing). */
  checkQuotaDraft: (personal: Record<string, unknown>, quota: string, criteria: Record<string, unknown> | null) =>
    rpc("inter_draft_check_quota", { p_personal: personal, p_quota: quota, p_criteria: criteria }),

  submitApplication: (
    token: string, programId: number, quota: string,
    criteria: Record<string, unknown>, subjectGroup?: string | null,
  ) =>
    rpc("inter_submit_application", {
      p_token: token, p_program_id: programId, p_quota: quota, p_criteria: criteria,
      p_subject_group: subjectGroup ?? null,
    }),

  /** NEW — edit an existing UNPAID application (program / group / quota). */
  editApplication: (
    token: string, applicationId: string, programId: number, quota: string,
    criteria: Record<string, unknown>, subjectGroup?: string | null,
  ) =>
    rpc("inter_edit_application", {
      p_token: token, p_application_id: applicationId, p_program_id: programId,
      p_quota: quota, p_criteria: criteria, p_subject_group: subjectGroup ?? null,
    }),

  proceedPayment: (token: string, applicationId: string) =>
    rpc("inter_proceed_payment", { p_token: token, p_application_id: applicationId }),
  applicationDetail: (token: string, applicationId: string) =>
    rpc("inter_application_detail", { p_token: token, p_application_id: applicationId }),

  /** Public tracking by Tracking ID only (read-only). ONE direct, indexed
   *  database call — no server function in between (migration 28). */
  track: (trackingId: string) => trackByTrackingId(trackingId),

  meritListsPublic: () =>
    cachedOrDirect<RpcResult>("admission-merit-lists", {}, () => rpc("inter_merit_lists_public", {})),
  meritListView: (meritListId: string) =>
    cachedOrDirect<RpcResult>("admission-merit-list", { id: meritListId }, () =>
      rpc("inter_merit_list_view", { p_merit_list_id: meritListId })),

  // ── Admin-only (caller is an authenticated Supabase admin) ──────────────
  adminUnlockApplication: (applicationId: string, reason?: string) =>
    rpc("inter_admin_unlock_application", { p_application_id: applicationId, p_reason: reason ?? null }),
  adminAllowNewApplication: (applicantId: string, reason?: string) =>
    rpc("inter_admin_allow_new_application", { p_applicant_id: applicantId, p_reason: reason ?? null }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared view models
// ─────────────────────────────────────────────────────────────────────────────

export interface InterProgram {
  id: number; name: string; study_level: string; seats: number; allowed_gender: string;
  subject_groups?: Array<{ id: number; name: string }>;
}
export interface InterUc { id: number; name: string }

export interface PersonalProfileData {
  full_name: string; father_name: string; date_of_birth: string; gender: string;
  email_address: string; mobile_number: string; landline_number: string;
  religion: string; nationality: string; domicile_province: string;
  domicile_district: string; tehsil: string; union_council: string;
  mailing_address: string; blood_group: string; father_cnic: string;
  father_mobile: string; mother_name: string; mother_cnic: string;
  photo_url: string; hafiz_e_quran: boolean;
}

export interface SscProfileData {
  exam_session: string; exam_board: string; passing_year: string;
  study_group: string; roll_number: string; marks_obtained: string;
  marks_total: string; hafiz_e_quran: boolean; sport_certificate: string;
  institute_province: string; institute_district: string; institute_name: string;
}

export interface ApplicationRow {
  id: string; tracking_id: string; program_name: string; subject_group?: string | null;
  quota: string;
  quota_criteria: string | null;
  fee_deadline: string; fee_deadline_iso: string; payment_status: string;
  status: string; jazzcash_token: string | null; /* payment reference (legacy column name) */ hafiz_e_quran: boolean;
  payment_method?: string | null; safepay_transaction_id?: string | null;
  submitted_at: string; processing_fee: number;
}

export interface SessionState {
  ok: boolean;
  error?: string;
  /** True when the call failed for a network reason (never a server verdict).
   *  Callers RETRY instead of treating the session as expired. */
  network?: boolean;
  applicant?: { id: string; cnic_formb: string; mobile: string; nationality: string };
  personal?: PersonalProfileData | null;
  ssc?: (SscProfileData & { marks_percentage: number; grade: string }) | null;
  applications?: ApplicationRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

export function formatCnic(cnic: string): string {
  const d = (cnic || "").replace(/\D/g, "");
  if (d.length !== 13) return cnic;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

export function formatDateLong(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function formatDeadline(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return String(d);
  const day = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${day} ${time}`;
}

/** Client-side math captcha — KEPT for backward compatibility; admission auth
 *  now uses Turnstile instead. */
export function makeMathCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { a, b, answer: String(a + b) };
}

// Re-export the masking helpers so callers can import them from one place.
export { maskCnic, maskMobile, maskCnicFormatted } from "@/lib/masking";
