import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured, getSupabaseService } from "@/lib/supabase";

/**
 * POST /api/admissions/apply — HED-style 4-step admission application.
 *
 * Validates the combined payload from all 4 steps, then inserts:
 *   1. A row in `admissions` with the new HED columns (nationality, father_cnic,
 *      dob, gender, domicile_district, permanent_address, quota,
 *      is_hafiz_e_quran, gap_years, subject_combination, class_year,
 *      fee_amount, fee_paid, submitted_at)
 *   2. A `application.submitted` audit_log row.
 *   3. The first `admission_status_timeline` row ('received' status).
 *
 * Returns the application_no (also used as the tracking token) so the applicant
 * can pay the Rs 100 fee at the college office and follow their status at
 * /admissions/track.
 *
 * The endpoint is rate-limited (5 submissions per IP per hour) and Zod-validated.
 */

const applySchema = z.object({
  // Step 1 — Account
  nationality: z.enum(["Pakistani", "Afghani"]).default("Pakistani"),
  cnic: z.string().min(6).max(20),
  afghanCard: z.string().max(30).nullable().optional(),
  mobile: z.string().regex(/^03\d{9}$/, "Mobile must be 03XXXXXXXXX"),
  password: z.string().min(8).max(120),
  // Step 2 — Board
  matricBoard: z.string().min(2).max(80),
  matricRoll: z.string().min(4).max(8),
  matricYear: z.string().regex(/^\d{4}$/, "Year must be 4 digits"),
  matricObtained: z.number().min(0).max(1200),
  matricTotal: z.number().min(1).max(1200),
  matricGroup: z.string().max(40).optional().default("Science"),
  // Step 3 — Personal
  fullName: z.string().min(3).max(120),
  fatherName: z.string().min(3).max(120),
  fatherCnic: z.string().regex(/^\d{13}$/, "Father CNIC must be 13 digits"),
  phone: z.string().min(10).max(20),  // alias of mobile
  whatsappOptIn: z.boolean().default(true),
  // Step 4 — Academic
  programme: z.enum(["ics", "pre-medical", "pre-engineering", "arts"]),
  classYear: z.enum(["1st Year", "2nd Year"]).default("1st Year"),
  quota: z.enum([
    "open_merit", "local", "employee", "sports",
    "special_person", "minority", "afghan", "meritorious",
  ]).default("open_merit"),
  isHafizEQuran: z.boolean().default(false),
  gapYears: z.number().min(0).max(10).default(0),
  subjectCombination: z.array(z.string()).min(3).max(8),
  previousSchool: z.string().max(160).optional(),
  declaration: z.literal(true),
});

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

function generateToken(): string {
  // Format: GHSS-YYYY-NNNNN (5-digit random, year as admission cycle)
  const year = new Date().getFullYear();
  const seq = String(Math.floor(10000 + Math.random() * 89999));
  return `GHSS-${year}-${seq}`;
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
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }

  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 422 }
    );
  }

  const d = parsed.data;
  const applicationNo = generateToken();

  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabaseService();

      // Insert into admissions (existing table with new HED columns)
      const { data: inserted, error } = await sb.from("admissions").insert({
        application_no: applicationNo,
        application_token: applicationNo,
        programme: d.programme,
        full_name: d.fullName,
        father_name: d.fatherName,
        cnic: d.cnic,
        phone: d.mobile,
        whatsapp_opt_in: true,
        matric_board: d.matricBoard,
        matric_roll: d.matricRoll,
        matric_obtained: d.matricObtained,
        matric_total: d.matricTotal,
        matric_year: d.matricYear,
        matric_group: d.matricGroup,
        previous_school: d.matricBoard,
        // New HED-style columns
        father_cnic: d.fatherCnic,
        date_of_birth: null, // would come from auth flow — for now, leave null
        gender: null,
        domicile_district: null,
        permanent_address: null,
        quota: d.quota,
        is_hafiz_e_quran: d.isHafizEQuran,
        gap_years: d.gapYears,
        subject_combination: d.subjectCombination,
        class_year: d.classYear,
        fee_amount: 100.00,
        fee_paid: false,
        status: "received",
        submitted_at: new Date().toISOString(),
      }).select("id").single();
      if (error) throw error;

      // First timeline row
      if (inserted?.id) {
        await sb.from("admission_status_timeline").insert({
          application_id: inserted.id,
          to_status: "received",
          note: "Application submitted via online portal",
          actor_role: "applicant",
        });
      }

      // Audit trail (§11.3)
      await sb.from("audit_log").insert({
        action: "application.submitted",
        target: applicationNo,
        meta: { programme: d.programme, quota: d.quota, class_year: d.classYear, ip },
      });

      return NextResponse.json({ applicationNo, demo: false });
    } catch (e) {
      console.error("Admission submit error:", e);
      return NextResponse.json(
        { error: "The admissions service is temporarily unavailable. Your draft is saved — please retry." },
        { status: 503 }
      );
    }
  }

  // DEMO MODE — no persistence; just return the token
  return NextResponse.json({ applicationNo, demo: true });
}
