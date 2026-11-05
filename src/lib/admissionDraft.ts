/**
 * admissionDraft — the applicant's in-progress admission form, kept ON THEIR
 * OWN DEVICE (localStorage) until the final captcha-verified Submit.
 *
 * Admission has no accounts and no login.  Nothing the applicant types is sent
 * to the database while they fill Personal Information, the Matric (SSC)
 * profile and the application.  At the very end ONE atomic server call
 * (inter_apply, behind Turnstile) stores everything together.  An abandoned
 * draft therefore costs the database nothing.
 *
 * The draft expires after 14 days and is wiped the moment it is submitted.
 */

import type { PersonalProfileData, SscProfileData, SessionState } from "@/lib/interAdmission";

const DRAFT_KEY = "inter_admission_draft_v1";
const DRAFT_TTL_MS = 14 * 24 * 60 * 60 * 1000;
export const DRAFT_EVENT = "inter-draft-change";

export type DraftSsc = SscProfileData & { marks_percentage: number; grade: string };

export interface AdmissionDraft {
  v: 1;
  savedAt: number;
  nationality: string;
  cnic: string;               // applicant's own CNIC / Form-B (13 digits)
  personal: PersonalProfileData | null;
  ssc: DraftSsc | null;
}

const EMPTY: AdmissionDraft = { v: 1, savedAt: 0, nationality: "Pakistani", cnic: "", personal: null, ssc: null };

function notify() {
  try { window.dispatchEvent(new Event(DRAFT_EVENT)); } catch { /* ignore */ }
}

export function getDraft(): AdmissionDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return { ...EMPTY };
    const d = JSON.parse(raw) as AdmissionDraft;
    if (!d || d.v !== 1 || Date.now() - (d.savedAt || 0) > DRAFT_TTL_MS) {
      localStorage.removeItem(DRAFT_KEY);
      return { ...EMPTY };
    }
    return { ...EMPTY, ...d };
  } catch {
    return { ...EMPTY };
  }
}

function writeDraft(d: AdmissionDraft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...d, savedAt: Date.now() }));
  } catch { /* storage full / blocked — the form still works for this visit */ }
  notify();
}

export function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
  notify();
}

export function hasDraftData(d: AdmissionDraft = getDraft()): boolean {
  return Boolean(d.personal || d.ssc);
}

/** Percentage + grade — identical to the server's inter_save_ssc / inter_grade_for. */
export function gradeFor(pct: number): string {
  if (pct >= 80) return "A+";
  if (pct >= 70) return "A";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  if (pct >= 40) return "D";
  return "F";
}

type SaveResult = { ok: boolean; error?: string; percentage?: number; grade?: string };

const PERSONAL_REQUIRED: Array<[keyof PersonalProfileData, string]> = [
  ["full_name", "Full Name"], ["father_name", "Father Name"], ["date_of_birth", "Date of Birth"],
  ["gender", "Gender"], ["mobile_number", "Mobile Number"], ["religion", "Religion"],
  ["domicile_district", "Domicile District"], ["tehsil", "Tehsil"], ["union_council", "Union Council"],
  ["mailing_address", "Mailing Address"], ["father_cnic", "Father CNIC"], ["father_mobile", "Father Mobile"],
  ["mother_name", "Mother Name"], ["mother_cnic", "Mother CNIC"],
];

/** Save Personal Information into the draft (same rules as the server). */
export function saveDraftPersonal(
  data: PersonalProfileData,
  identity: { nationality: string; cnic: string },
): SaveResult {
  const cnic = (identity.cnic || "").replace(/\D/g, "");
  if (cnic.length !== 13) {
    return { ok: false, error: "CNIC/Form-B Number Must Be 13 Digits And WithOut dashes(-) E.g 0000000000000" };
  }
  if (!["Pakistani", "Afghani"].includes(identity.nationality)) {
    return { ok: false, error: "Please select a valid nationality." };
  }
  for (const [k, label] of PERSONAL_REQUIRED) {
    if (!String(data[k] ?? "").trim()) return { ok: false, error: `${label} is mandatory.` };
  }
  if (!["male", "female", "other"].includes(data.gender)) return { ok: false, error: "Please select a valid gender." };
  if (!/^[0-9]{13}$/.test(data.father_cnic)) return { ok: false, error: "Father CNIC must be 13 digits without dashes." };
  if (!/^[0-9]{13}$/.test(data.mother_cnic)) return { ok: false, error: "Mother CNIC must be 13 digits without dashes." };
  if (!/^03[0-9]{9}$/.test(data.mobile_number) || !/^03[0-9]{9}$/.test(data.father_mobile)) {
    return { ok: false, error: "Mobile numbers must be in 03451234567 format." };
  }
  const d = getDraft();
  writeDraft({ ...d, nationality: identity.nationality, cnic, personal: { ...data, nationality: identity.nationality } });
  return { ok: true };
}

/** Save the Matric (SSC) profile into the draft (same rules as the server). */
export function saveDraftSsc(data: SscProfileData): SaveResult {
  const d = getDraft();
  if (!d.personal) return { ok: false, error: "Please complete your Personal Information first." };
  const required: Array<[keyof SscProfileData, string]> = [
    ["exam_board", "Exam Board"], ["passing_year", "Passing Year"], ["study_group", "Study Group"],
    ["roll_number", "Roll Number"], ["marks_obtained", "Marks Obtained"], ["marks_total", "Total Marks"],
    ["institute_district", "Institute District"], ["institute_name", "Institute Name"],
  ];
  for (const [k, label] of required) {
    if (!String(data[k] ?? "").trim()) return { ok: false, error: `${label} is mandatory.` };
  }
  const obt = parseFloat(data.marks_obtained);
  const tot = parseFloat(data.marks_total);
  if (isNaN(obt) || isNaN(tot) || tot <= 0 || obt < 0 || obt > tot) {
    return { ok: false, error: "Marks obtained cannot exceed total marks." };
  }
  const pct = Math.round(((obt + (data.hafiz_e_quran ? 20 : 0)) / tot) * 10000) / 100;
  const grade = gradeFor(pct);
  writeDraft({ ...d, ssc: { ...data, marks_percentage: pct, grade } });
  return { ok: true, percentage: pct, grade };
}

/** The draft shaped exactly like a server session, so every page can render it. */
export function draftToSession(d: AdmissionDraft = getDraft()): SessionState {
  return {
    ok: true,
    applicant: {
      id: "draft",
      cnic_formb: d.cnic,
      mobile: d.personal?.mobile_number ?? "",
      nationality: d.nationality,
    },
    personal: d.personal,
    ssc: d.ssc,
    applications: [],
  };
}
