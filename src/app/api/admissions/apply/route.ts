import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured, getSupabaseServer } from "@/lib/supabase";

/**
 * POST /api/admissions/apply — mirrors the HED KPK OCAS form structure
 * captured live from https://admission.hed.gkp.pk on 2026-10-06.
 *
 * Handles both 1st-year (Part-I) and 2nd-year (Part-II transfer) applications.
 * The HED-aligned extra fields (blood group, mother info, tehsil, UC, photo,
 * hafiz_quran, etc.) are stored in the `meta` JSONB column on the admissions
 * table; some are also persisted as top-level columns added by migration 0005.
 *
 * Validation via Zod + per-IP rate limit + Supabase insert (RLS via anon key;
 * service role is used only for the audit-log write so the anon insert policy
 * on audit_log is honoured when present).
 *
 * Demo mode returns a formatted tracking number.
 */

const metaSchema = z.object({
  email: z.string().email().max(120).or(z.literal("")),
  dob: z.string().min(8).max(20),
  gender: z.string().min(2).max(20),
  religion: z.string().min(2).max(40),
  nationality: z.enum(["Pakistani", "Afghani"]),
  afghani_province: z.string().max(80).optional(),
  landline: z.string().max(20).optional(),
  domicile_province: z.string().min(1).max(80),
  domicile_district: z.string().min(1).max(80),
  domicile_tehsil: z.string().min(1).max(80),
  domicile_union_council: z.string().min(1).max(120),
  blood_group: z.string().min(1).max(8),
  father_cnic: z.string().regex(/^[0-9]{13}$/, "Father CNIC must be 13 digits"),
  father_mobile: z.string().regex(/^03[0-9]{9}$/, "Father mobile must be 03XXXXXXXXX"),
  mother_name: z.string().min(3).max(120),
  mother_cnic: z.string().regex(/^[0-9]{13}$/, "Mother CNIC must be 13 digits"),
  guardian_address: z.string().min(5).max(300),
  hafiz_quran: z.boolean(),
  shift: z.enum(["morning", "evening"]),
  matric_session: z.enum(["annual", "supplementary", "other"]),
  matric_study_group: z.string().min(1).max(40),
  matric_grade: z.string().max(4),
  matric_percent: z.number().min(0).max(100),
  first_year_roll: z.string().max(30).optional().default(""),
  first_year_registration_no: z.string().max(40).optional().default(""),
  first_year_obtained: z.number().min(0).max(1500).optional().default(0),
  first_year_total: z.number().min(1).max(1500).optional().default(0),
  first_year_year: z.string().max(4).optional().default(""),
  first_year_subjects: z.string().max(200).optional().default(""),
  first_year_percent: z.number().min(0).max(100).optional().default(0),
  first_year_grade: z.string().max(4).optional().default(""),
});

const applySchema = z.object({
  admissionType: z.enum(["first_year", "second_year"]),
  fullName: z.string().min(3).max(120),
  fatherName: z.string().min(3).max(120),
  cnic: z.string().regex(/^[0-9]{13}$/, "CNIC must be 13 digits without dashes"),
  phone: z.string().regex(/^03[0-9]{9}$/, "Mobile must be 03XXXXXXXXX format"),
  whatsappOptIn: z.boolean(),
  matricBoard: z.string().min(2).max(80),
  matricRoll: z.string().min(1).max(30),
  matricObtained: z.number().min(0).max(1500),
  matricTotal: z.number().min(1).max(1500),
  matricYear: z.string().min(4).max(4),
  previousSchool: z.string().min(2).max(160),
  matricGroup: z.string().max(40),
  programme: z.enum(["ics", "pre-medical", "pre-engineering", "arts"]),
  declaration: z.literal(true),
  meta: metaSchema,
}).refine((v) => v.matricObtained <= v.matricTotal, {
  message: "Matric marks obtained cannot exceed total",
  path: ["matricObtained"],
}).refine(
  (v) => v.admissionType !== "second_year" || (
    Boolean(v.meta.first_year_roll) && Boolean(v.meta.first_year_registration_no) &&
    v.meta.first_year_total > 0
  ),
  { message: "2nd-year applicants must provide 1st-year roll number, registration number and marks", path: ["meta.first_year_roll"] }
).refine(
  (v) => v.admissionType !== "second_year" || v.meta.first_year_obtained <= v.meta.first_year_total,
  { message: "1st-year marks obtained cannot exceed total", path: ["meta.first_year_obtained"] }
);

/** In-memory rate limiter — 5 submissions per IP per hour.
 *  For multi-instance production, swap for Upstash Redis or a Supabase table. */
const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return false;
  }
  b.count += 1;
  return b.count > 5;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many submissions from this connection. Try again later or contact the office." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 422 }
    );
  }

  const data = parsed.data;
  const meta = data.meta;

  // Application number format: GHSS-<year>-<4-digit sequence>
  // Production: use a Supabase sequence + format() for guaranteed uniqueness.
  // Demo: random 4 digits (collisions very unlikely for a school's volume).
  const sessionYear = new Date().getFullYear();
  const seq = String(Math.floor(1000 + Math.random() * 8999));
  const applicationNo = `GHSS-${sessionYear}-${seq}`;

  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabaseServer();
      const admissionPayload = {
        application_no: applicationNo,
        admission_type: data.admissionType,
        programme: data.programme,
        full_name: data.fullName,
        father_name: data.fatherName,
        cnic: data.cnic,
        phone: data.phone,
        whatsapp_opt_in: data.whatsappOptIn,
        matric_board: data.matricBoard,
        matric_roll: data.matricRoll,
        matric_obtained: data.matricObtained,
        matric_total: data.matricTotal,
        matric_year: data.matricYear,
        matric_group: data.matricGroup,
        previous_school: data.previousSchool,
        // HED-aligned top-level columns (added by migration 0005)
        applicant_dob: meta.dob,
        applicant_gender: meta.gender,
        applicant_religion: meta.religion,
        applicant_blood_group: meta.blood_group,
        applicant_nationality: meta.nationality,
        applicant_email: meta.email,
        applicant_mobile: data.phone,
        applicant_landline: meta.landline ?? null,
        applicant_address: meta.guardian_address,
        father_cnic: meta.father_cnic,
        father_mobile: meta.father_mobile,
        mother_name: meta.mother_name,
        mother_cnic: meta.mother_cnic,
        guardian_address: meta.guardian_address,
        domicile_province: meta.domicile_province,
        domicile_district: meta.domicile_district,
        domicile_tehsil: meta.domicile_tehsil,
        domicile_union_council: meta.domicile_union_council,
        hafiz_quran: meta.hafiz_quran,
        shift: meta.shift,
        // Full meta JSONB for completeness
        meta,
        status: "received",
        submitted_at: new Date().toISOString(),
      };

      let applicationId: string | null = null;
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { data: inserted, error } = await sb.from("admissions").insert(admissionPayload).select("id").single();
        if (error) throw error;
        applicationId = inserted?.id ?? null;
      } else {
        const { error } = await sb.from("admissions").insert(admissionPayload);
        if (error) throw error;
      }
      // Audit trail (written via service role when available)
      try {
        await sb.from("audit_log").insert({
          action: "application.submitted",
          target: applicationNo,
          meta: { programme: data.programme, admissionType: data.admissionType, ip },
        });
      } catch {
        /* audit write is best-effort — main insert already succeeded */
      }
      return NextResponse.json({ applicationNo, applicationId, demo: false });
    } catch (e) {
      console.error("[admissions/apply] Supabase error:", e);
      return NextResponse.json(
        { error: "The admissions service is temporarily unavailable. Your draft is saved — please retry." },
        { status: 503 }
      );
    }
  }

  // DEMO MODE — no persistence; number is issued for the experience
  return NextResponse.json({ applicationNo, demo: true });
}
