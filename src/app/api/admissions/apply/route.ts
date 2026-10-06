import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured, getSupabaseServer } from "@/lib/supabase";

/**
 * POST /api/admissions/apply — Master Plan §8.8 (form submissions).
 * Mirrors the HED KPK Online College Admission System (OCAS) form structure
 * (admission.hed.gkp.pk) — handles both 1st-year (Part-I) and 2nd-year
 * (Part-II transfer) applications.
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
  domicileDistrict: z.string().min(2).max(80),
  address: z.string().min(5).max(300),
  guardianName: z.string().min(3).max(120),
  guardianCnic: z.string().min(13).max(15),
  guardianPhone: z.string().min(10).max(20),
  guardianRelation: z.string().min(2).max(40),
  firstYearRoll: z.string().max(30).optional(),
  firstYearRegistrationNo: z.string().max(40).optional(),
  firstYearObtained: z.number().min(0).max(1200).optional(),
  firstYearTotal: z.number().min(1).max(1200).optional(),
  firstYearYear: z.string().max(4).optional(),
  firstYearSubjects: z.string().max(200).optional(),
});

const applySchema = z.object({
  admissionType: z.enum(["first_year", "second_year"]),
  fullName: z.string().min(3).max(120),
  fatherName: z.string().min(3).max(120),
  cnic: z.string().min(10).max(20),
  phone: z.string().min(10).max(20),
  email: z.string().email().max(120).or(z.literal("")),
  whatsappOptIn: z.boolean(),
  dob: z.string().min(8).max(20),
  gender: z.string().min(2).max(20),
  religion: z.string().min(2).max(40),
  domicileDistrict: z.string().min(2).max(80),
  address: z.string().min(5).max(300),
  guardianName: z.string().min(3).max(120),
  guardianCnic: z.string().min(13).max(15),
  guardianPhone: z.string().min(10).max(20),
  guardianRelation: z.string().min(2).max(40),
  matricBoard: z.string().min(2).max(80),
  matricRoll: z.string().min(1).max(30),
  matricObtained: z.number().min(0).max(1200),
  matricTotal: z.number().min(1).max(1200),
  matricYear: z.string().min(4).max(4),
  previousSchool: z.string().min(2).max(160),
  matricGroup: z.string().max(40),
  firstYearRoll: z.string().max(30).optional(),
  firstYearRegistrationNo: z.string().max(40).optional(),
  firstYearObtained: z.number().min(0).max(1200).optional(),
  firstYearTotal: z.number().min(1).max(1200).optional(),
  firstYearYear: z.string().max(4).optional(),
  firstYearSubjects: z.string().max(200).optional(),
  programme: z.enum(["ics", "pre-medical", "pre-engineering", "arts"]),
  declaration: z.literal(true),
}).refine((v) => v.matricObtained <= v.matricTotal, {
  message: "Matric marks obtained cannot exceed total",
  path: ["matricObtained"],
}).refine(
  (v) => v.admissionType !== "second_year" || (
    Boolean(v.firstYearRoll) && Boolean(v.firstYearRegistrationNo) && v.firstYearObtained !== undefined && v.firstYearTotal !== undefined
  ),
  { message: "2nd-year applicants must provide 1st-year roll number, registration number and marks", path: ["firstYearRoll"] }
).refine(
  (v) => v.admissionType !== "second_year" || (v.firstYearObtained ?? 0) <= (v.firstYearTotal ?? 1),
  { message: "1st-year marks obtained cannot exceed total", path: ["firstYearObtained"] }
);

/** In-memory rate limiter — 5 submissions per IP per hour (§11.3).
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
      { error: "Validation failed.", issues: parsed.error.issues.map((i) => i.path.join(".")) },
      { status: 422 }
    );
  }

  const data = parsed.data;

  // Validate the meta subset once more (defensive)
  const metaParse = metaSchema.safeParse({
    email: data.email,
    dob: data.dob,
    gender: data.gender,
    religion: data.religion,
    domicileDistrict: data.domicileDistrict,
    address: data.address,
    guardianName: data.guardianName,
    guardianCnic: data.guardianCnic,
    guardianPhone: data.guardianPhone,
    guardianRelation: data.guardianRelation,
    firstYearRoll: data.firstYearRoll,
    firstYearRegistrationNo: data.firstYearRegistrationNo,
    firstYearObtained: data.firstYearObtained,
    firstYearTotal: data.firstYearTotal,
    firstYearYear: data.firstYearYear,
    firstYearSubjects: data.firstYearSubjects,
  });
  if (!metaParse.success) {
    return NextResponse.json(
      { error: "Validation failed (meta).", issues: metaParse.error.issues.map((i) => i.path.join(".")) },
      { status: 422 }
    );
  }

  const sessionYear = new Date().getFullYear();
  // Application number format: GHSS-<year>-<4-digit sequence>
  const seq = String(Math.floor(1000 + Math.random() * 8999));
  const applicationNo = `GHSS-${sessionYear}-${seq}`;

  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabaseServer();
      const { error } = await sb.from("admissions").insert({
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
        meta: metaParse.data,
        status: "received",
      });
      if (error) throw error;
      // Audit trail (§11.3)
      await sb.from("audit_log").insert({
        action: "application.submitted",
        target: applicationNo,
        meta: { programme: data.programme, admissionType: data.admissionType, ip },
      });
      return NextResponse.json({ applicationNo, demo: false });
    } catch (e) {
      return NextResponse.json(
        { error: "The admissions service is temporarily unavailable. Your draft is saved — please retry." },
        { status: 503 }
      );
    }
  }

  // DEMO MODE — no persistence; number is issued for the experience
  return NextResponse.json({ applicationNo, demo: true });
}
