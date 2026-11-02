/**
 * interAdmission — Inter (1st/2nd Year) admission system, a 1:1 mirror of the
 * HED KPK Online Admission System flow as captured live on 01-Nov-2026
 * (admission.hed.gkp.pk — walked end-to-end twice: commerce college + a
 * general college with the same four faculties as GHSS Ghallanai).
 *
 * Scoped to GOVERNMENT HIGHER SECONDARY SCHOOL GHALLANAI, District Mohmand —
 * Intermediate (1st/2nd Year) ONLY, four faculties:
 *   Pre-Medical · Pre-Engineering · ICS (Computer Sciences) · Arts/Humanities
 * No BS / ADP / D.Com / DIT.
 *
 * See docs/HED-INTER-ADMISSION-CAPTURE.md for the complete field-level capture.
 *
 * Auth model: applicants are NOT Supabase-Auth users. They register with
 * CNIC/Form-B + mobile + password (hashed server-side) and receive a session
 * token (uuid) managed by the inter_applicant_sessions table. All data access
 * flows through SECURITY DEFINER RPCs that resolve the token first.
 */

import { supabase } from "@/lib/supabase";

export const INTER_TOKEN_KEY = "inter_admission_token";

// ─────────────────────────────────────────────────────────────────────────────
// Constants (captured verbatim from the HED site)
// ─────────────────────────────────────────────────────────────────────────────

export const COLLEGE_NAME = "Government Higher Secondary School Ghallanai";
export const COLLEGE_SHORT = "GHSS Ghallanai, District Mohmand";
export const STUDY_LEVEL = "Intermediate";
/** HED general-college cycle label (captured: "F.A/F.Sc Admissions 2026 3rd Cycle") */
export const ADMISSION_CYCLE = "F.A/F.Sc Admissions 2026";
export const PROCESSING_FEE = 100;

/** The four faculties of GHSS Ghallanai (order mirrors the HED program list) */
export const FACULTIES = [
  "Pre-Medical",
  "Pre-Engineering",
  "ICS (Computer Sciences)",
  "Arts/Humanities",
] as const;

/**
 * Subject groups per program — captured verbatim from HED
 * get_subjectgroups_by_program_id.php at a general college with the same
 * faculties (each Inter group carries 7 subjects incl. English, Islamic
 * Edu, Mutalia-e-Quran and Urdu). Fallback only; live list comes from the
 * inter_programs_list RPC.
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

/** Mohmand tehsils (HED district = Mohmand flow) */
export const MOHMAND_TEHSILS = [
  "Baizai", "Khwezai", "Safi", "Prang Ghar", "Halimzai", "Tarakzai",
  "Utman Khel", "Lakaro", "Ekka Ghund", "Ambar", "Pandyalai", "Ghallanai",
] as const;

/** Full domicile district list as offered by HED (Pakistan-wide) */
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

/** Exam boards (32, as captured from HED matric profile) */
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

/** Quotas offered for Inter admission (HED general college, type 0:
 *  Open Merit=2, Sports=4, Special Person=5, College Employees=6,
 *  Local Quota=7 — same labels for every general college) */
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

/** Verbatim HED messages */
export const HED_MESSAGES = {
  localMustUseLocal:
    "Your domicile is local; therefore, apply on Local Quota.",
  duplicate:
    "Error! You have already applied for this program in this college, please select a different program.",
  overage:
    "You are overage. An age relaxation certificate is required for Inter admission.",
  overageSports: "You are overage and not eligible for the sports quota",
  meritNote:
    "Applications submitted on all quotas except AFGHAN shall be considered in Open Merit.",
  declaration:
    "I declare that the information given in support of the application is accurate and complete. I understand that any misrepresentation will result in disqualification of my application for admission.",
  feeTokenNotice: (token: string, deadline: string) =>
    `This token must be paid at any JAZZ CASH or through JAZZ CASH APP on or before ${deadline}.`,
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
}

export function clearToken() {
  try {
    localStorage.removeItem(INTER_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RPC wrappers (all return { ok, ...payload } or { ok:false, error })
// ─────────────────────────────────────────────────────────────────────────────

type RpcResult = Record<string, unknown> & { ok?: boolean; error?: string };

async function rpc(fn: string, params: Record<string, unknown>): Promise<RpcResult> {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) {
    // Surface network/RPC errors as a normal error payload
    return { ok: false, error: error.message };
  }
  return (data ?? { ok: false, error: "Unexpected empty response." }) as RpcResult;
}

export const interApi = {
  register: (nationality: string, cnic: string, mobile: string, password: string) =>
    rpc("inter_register", {
      p_nationality: nationality, p_cnic_formb: cnic,
      p_mobile: mobile, p_password: password,
    }),
  login: (loginId: string, password: string) =>
    rpc("inter_login", { p_login_id: loginId, p_password: password }),
  logout: (token: string) => rpc("inter_logout", { p_token: token }),
  sessionState: (token: string) => rpc("inter_session_state", { p_token: token }),
  savePersonal: (token: string, data: Record<string, unknown>) =>
    rpc("inter_save_personal", { p_token: token, p_data: data }),
  saveSsc: (token: string, data: Record<string, unknown>) =>
    rpc("inter_save_ssc", { p_token: token, p_data: data }),
  programsList: () => rpc("inter_programs_list", {}),
  ucsList: () => rpc("inter_ucs_list", {}),
  checkQuota: (token: string, quota: string, criteria: Record<string, unknown> | null) =>
    rpc("inter_check_quota", { p_token: token, p_quota: quota, p_criteria: criteria }),
  submitApplication: (
    token: string, programId: number, quota: string,
    criteria: Record<string, unknown>, subjectGroup?: string | null,
  ) =>
    rpc("inter_submit_application", {
      p_token: token, p_program_id: programId, p_quota: quota, p_criteria: criteria,
      p_subject_group: subjectGroup ?? null,
    }),
  proceedPayment: (token: string, applicationId: string) =>
    rpc("inter_proceed_payment", { p_token: token, p_application_id: applicationId }),
  applicationDetail: (token: string, applicationId: string) =>
    rpc("inter_application_detail", { p_token: token, p_application_id: applicationId }),
  track: (trackingId: string) => rpc("inter_track", { p_tracking_id: trackingId }),
  meritListsPublic: () => rpc("inter_merit_lists_public", {}),
  meritListView: (meritListId: string) =>
    rpc("inter_merit_list_view", { p_merit_list_id: meritListId }),
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
  status: string; jazzcash_token: string | null; hafiz_e_quran: boolean;
  submitted_at: string; processing_fee: number;
}

export interface SessionState {
  ok: boolean;
  error?: string;
  applicant?: { id: string; cnic_formb: string; mobile: string; nationality: string };
  personal?: PersonalProfileData | null;
  ssc?: (SscProfileData & { marks_percentage: number; grade: string }) | null;
  applications?: ApplicationRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers (HED display formats)
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

/** Client-side math captcha, exactly like HED (two operands + result input) */
export function makeMathCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { a, b, answer: String(a + b) };
}
