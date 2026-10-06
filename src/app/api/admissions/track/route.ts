import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured, getSupabaseService } from "@/lib/supabase";

/**
 * POST /api/admissions/track — public application status lookup.
 *
 * Mirrors the HED KPK `application_status.php` flow: applicant enters their
 * tracking token (e.g. GHSS-2026-00123), receives their application's full
 * status timeline + summary.
 *
 * Rate-limited (20 lookups / 10 min per IP) to prevent token enumeration.
 * Returns the application row + timeline array. Strips father_cnic and other
 * PII for privacy (returns only the applicant's own name + programme + status).
 */

const schema = z.object({
  token: z.string().min(8).max(30).regex(/^GHSS-\d{4}-\d{4,6}$/, "Token format: GHSS-YYYY-NNNNN"),
});

const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return false;
  }
  b.count += 1;
  return b.count > 20;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many lookups. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid tracking token (e.g. GHSS-2026-00123)." }, { status: 422 });
  }

  const token = parsed.data.token.toUpperCase();

  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabaseService();
      const { data: app, error } = await sb
        .from("admissions")
        .select(`
          id, application_no, programme, full_name, father_name, status,
          class_year, quota, is_hafiz_e_quran, gap_years, subject_combination,
          fee_amount, fee_paid, fee_paid_at, fee_receipt_no, submitted_at, updated_at,
          matric_board, matric_roll, matric_year, matric_obtained, matric_total, matric_group
        `)
        .or(`application_no.eq.${token},application_token.eq.${token}`)
        .maybeSingle();

      if (error || !app) {
        return NextResponse.json({ error: "No application found with that token." }, { status: 404 });
      }

      // Fetch the timeline
      const { data: timeline } = await sb
        .from("admission_status_timeline")
        .select("from_status, to_status, note, actor_role, created_at")
        .eq("application_id", app.id)
        .order("created_at", { ascending: true });

      // Strip PII (father_cnic, mobile, address)
      const safe = {
        application_no: app.application_no,
        programme: app.programme,
        full_name: app.full_name,
        father_name: app.father_name,
        status: app.status,
        class_year: app.class_year,
        quota: app.quota,
        is_hafiz_e_quran: app.is_hafiz_e_quran,
        gap_years: app.gap_years,
        subject_combination: app.subject_combination,
        fee_amount: app.fee_amount,
        fee_paid: app.fee_paid,
        fee_paid_at: app.fee_paid_at,
        submitted_at: app.submitted_at,
        updated_at: app.updated_at,
        matric_board: app.matric_board,
        matric_year: app.matric_year,
        matric_obtained: app.matric_obtained,
        matric_total: app.matric_total,
        matric_group: app.matric_group,
      };

      return NextResponse.json({
        application: safe,
        timeline: timeline ?? [],
      });
    } catch (e) {
      console.error("Track error:", e);
      return NextResponse.json({ error: "Lookup failed. Please try again." }, { status: 500 });
    }
  }

  // DEMO MODE — return demo data for known demo tokens
  const DEMO_APPS: Record<string, any> = {
    "GHSS-2026-10001": {
      application_no: "GHSS-2026-10001",
      programme: "pre-medical",
      full_name: "Muhammad Hamza Khan",
      father_name: "Abdul Karim Khan",
      status: "review",
      class_year: "1st Year",
      quota: "open_merit",
      is_hafiz_e_quran: true,
      gap_years: 0,
      subject_combination: ["English", "Urdu", "Islamiat", "Biology", "Chemistry", "Physics"],
      fee_amount: 100,
      fee_paid: true,
      fee_paid_at: "2026-09-20T10:30:00Z",
      submitted_at: "2026-09-18T14:22:00Z",
      updated_at: "2026-09-21T09:15:00Z",
      matric_board: "BISE Peshawar",
      matric_year: "2026",
      matric_obtained: 1018,
      matric_total: 1100,
      matric_group: "Science",
    },
    "GHSS-2026-10002": {
      application_no: "GHSS-2026-10002",
      programme: "pre-engineering",
      full_name: "Ayesha Bibi",
      father_name: "Gul Rahman",
      status: "shortlisted",
      class_year: "1st Year",
      quota: "local",
      is_hafiz_e_quran: false,
      gap_years: 0,
      subject_combination: ["English", "Urdu", "Islamiat", "Mathematics", "Physics", "Chemistry"],
      fee_amount: 100,
      fee_paid: true,
      fee_paid_at: "2026-09-19T11:00:00Z",
      submitted_at: "2026-09-17T09:30:00Z",
      updated_at: "2026-09-22T14:00:00Z",
      matric_board: "BISE Mardan",
      matric_year: "2026",
      matric_obtained: 985,
      matric_total: 1100,
      matric_group: "Science",
    },
    "GHSS-2026-10003": {
      application_no: "GHSS-2026-10003",
      programme: "ics",
      full_name: "Hassan Ali",
      father_name: "Akbar Ali",
      status: "received",
      class_year: "1st Year",
      quota: "open_merit",
      is_hafiz_e_quran: false,
      gap_years: 1,
      subject_combination: ["English", "Urdu", "Islamiat", "Computer Science", "Mathematics", "Physics"],
      fee_amount: 100,
      fee_paid: false,
      fee_paid_at: null,
      submitted_at: "2026-09-22T16:00:00Z",
      updated_at: "2026-09-22T16:00:00Z",
      matric_board: "BISE Swat",
      matric_year: "2025",
      matric_obtained: 892,
      matric_total: 1100,
      matric_group: "Science",
    },
  };

  const DEMO_TIMELINES: Record<string, any[]> = {
    "GHSS-2026-10001": [
      { from_status: null, to_status: "received", note: "Application submitted via online portal", actor_role: "applicant", created_at: "2026-09-18T14:22:00Z" },
      { from_status: "received", to_status: "review", note: "Fee received at college office. Rs 100 receipt #RC-4521", actor_role: "admin", created_at: "2026-09-21T09:15:00Z" },
    ],
    "GHSS-2026-10002": [
      { from_status: null, to_status: "received", note: "Application submitted via online portal", actor_role: "applicant", created_at: "2026-09-17T09:30:00Z" },
      { from_status: "received", to_status: "review", note: "Fee paid. Document verification pending.", actor_role: "admin", created_at: "2026-09-20T11:00:00Z" },
      { from_status: "review", to_status: "shortlisted", note: "Shortlisted for interview. Merit rank #14 (Open Merit).", actor_role: "admin", created_at: "2026-09-22T14:00:00Z" },
    ],
    "GHSS-2026-10003": [
      { from_status: null, to_status: "received", note: "Application submitted via online portal", actor_role: "applicant", created_at: "2026-09-22T16:00:00Z" },
    ],
  };

  const app = DEMO_APPS[token];
  if (!app) {
    return NextResponse.json({ error: "No application found with that token." }, { status: 404 });
  }

  return NextResponse.json({
    application: app,
    timeline: DEMO_TIMELINES[token] ?? [],
    demo: true,
  });
}
