import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/**
 * POST /api/admissions/verify-board
 *
 * Mirrors the HED KPK OCAS "FETCH DATA" feature.
 *
 * Captured live from https://admission.hed.gkp.pk on 2026-10-06:
 * The HED portal's frontend calls `POST /fetch_board_exam_result.php`
 * with these 5 form params and returns a JSON student record fetched
 * from BISE Peshawar's data mirror.
 *
 * HED's endpoint requires a logged-in HED applicant session (PHPSESSID),
 * so this route is intended to be called from the browser when the
 * applicant is signed into the GHSS Ghallanai portal AND has separately
 * logged into the HED portal in the same browser session. The cookie
 * jar is shared automatically (same-origin = admission.hed.gkp.pk).
 *
 * In DEMO MODE (HED_PROXY_ENABLED != "true"), this endpoint returns a
 * realistic sample response so the form can be tested end-to-end.
 *
 * In LIVE MODE, the request is forwarded to HED's fetch_board_exam_result.php
 * with the applicant's HED session cookie. If the cookie isn't present
 * or has expired, we return a 401 and the form falls back to manual entry.
 *
 * See /docs/bise_api_findings.md for the full reverse-engineering report.
 */

const verifySchema = z.object({
  exam_boards_universities_id: z.string().min(1).max(10),
  board_class: z.enum(["SSC", "HSC"]),
  board_year: z.string().regex(/^\d{4}$/),
  board_session: z.enum(["Annual", "Supplementary", "Other"]),
  highest_exam_roll_number: z.string().min(1).max(30).regex(/^[0-9]+$/),
});

// HED board IDs captured from the live portal (subset relevant to KPK + Federal).
// See src/content/hed-data.ts BOARDS_BY_PROVINCE for the full mapping.
const HED_BOARD_IDS: Record<string, string> = {
  "BISE Abbottabad": "29",
  "BISE Bannu": "25",
  "BISE DI Khan": "26",
  "BISE Kohat": "27",
  "BISE Malakand": "30",
  "BISE Mardan": "8",
  "BISE Peshawar": "7",
  "BISE Swat": "28",
  "FBISE": "236",
  "IBCC Islamabad": "400",
  "IBCC KPK": "399",
  "KP Board Technical": "31",
  // Punjab
  "BISE Bahawalpur": "283",
  "BISE D.G. Khan": "284",
  "BISE Faisalabad": "285",
  "BISE Gujranwala": "286",
  "BISE Lahore": "287",
  "BISE Multan": "288",
  "BISE Rawalpindi": "289",
  "BISE Sargodha": "290",
  // Sindh
  "BISE Hyderabad": "293",
  "BISE Karachi": "294",  // Bie Karachi
  "BISE Larkana": "295",
  "BISE Mirpurkhas": "296",
  "BISE Sukkur": "297",
  "BSE Karachi": "292",
  // Balochistan
  "BISE Quetta": "298",
  // AJK
  "BISE AJK Mirpur": "299",
  // Other
  "Agha Khan Board": "291",
  "Karakoram International": "443",
  "Other": "19000",
};

/** In-memory rate limiter — 10 verifications per IP per hour. */
const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return false;
  }
  b.count += 1;
  return b.count > 10;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many verification attempts from this connection. Try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 422 }
    );
  }

  const data = parsed.data;

  // Map our friendly board name (e.g. "BISE Peshawar") to HED's internal board ID.
  const hedBoardId = HED_BOARD_IDS[data.exam_boards_universities_id] ?? data.exam_boards_universities_id;

  // ─── DEMO MODE ──────────────────────────────────────────────────────────
  // In demo mode (HED_PROXY_ENABLED != "true"), we can't proxy to HED
  // (we'd need the user's HED session cookie). Return a realistic-looking
  // sample so the form can be tested end-to-end.
  const isDemo = !process.env.HED_PROXY_ENABLED || process.env.HED_PROXY_ENABLED !== "true";

  if (isDemo) {
    const sampleData = {
      status: true,
      message: "Record Found or student is failed (DEMO — set HED_PROXY_ENABLED=true to verify against the live HED portal)",
      data: {
        student_name: "SAMPLE STUDENT NAME",
        father_name: "SAMPLE FATHER NAME",
        obtained_marks: "850",
        total_marks: data.board_class === "SSC" ? "1100" : "550",
        grade: "A",
        remarks: null,
        domicile: "Peshawar",
        date_of_birth: "2007-05-15",
        school_name: "SAMPLE PREVIOUS SCHOOL NAME",
        district: "Peshawar",
        tehsil: null,
        highest_exam_marks_obtained: "850",
        highest_exam_marks_total: data.board_class === "SSC" ? "1100" : "550",
        institute_name: "SAMPLE PREVIOUS SCHOOL NAME",
        highest_exam_grade: "A",
      },
      demo: true,
    };
    return NextResponse.json(sampleData);
  }

  // ─── LIVE MODE — proxy to HED's fetch_board_exam_result.php ─────────────
  // This requires:
  //   1. The applicant must have logged into admission.hed.gkp.pk in this
  //      browser session (so their PHPSESSID cookie is present).
  //   2. The HED_PROXY_ENABLED env var is set to "true".
  //   3. The Next.js server can reach admission.hed.gkp.pk (may require
  //      a proxy if hosted outside Pakistan).
  try {
    const hedCookies = req.headers.get("cookie") || "";
    const hasHedSession = /PHPSESSID=[a-z0-9]+/i.test(hedCookies);
    if (!hasHedSession) {
      return NextResponse.json(
        {
          status: false,
          message: "Not signed into HED portal. Please sign in at admission.hed.gkp.pk first, then return to this form.",
        },
        { status: 401 }
      );
    }

    const hedResponse = await fetch("https://admission.hed.gkp.pk/fetch_board_exam_result.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": "https://admission.hed.gkp.pk/student_academic_profile_entry.php?type=inter",
        "X-Requested-With": "XMLHttpRequest",
        "Cookie": hedCookies,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      },
      body: new URLSearchParams({
        exam_boards_universities_id: hedBoardId,
        board_class: data.board_class,
        board_year: data.board_year,
        board_session: data.board_session,
        highest_exam_roll_number: data.highest_exam_roll_number,
      }),
    });

    if (!hedResponse.ok) {
      return NextResponse.json(
        {
          status: false,
          message: `HED portal returned HTTP ${hedResponse.status}. Please try again or enter marks manually.`,
        },
        { status: 502 }
      );
    }

    const result = await hedResponse.json();
    return NextResponse.json({
      ...result,
      demo: false,
      source: "hed_live",
    });
  } catch (e) {
    console.error("[admissions/verify-board] HED proxy error:", e);
    return NextResponse.json(
      {
        status: false,
        message: "Could not reach the HED verification service. Please enter marks manually.",
      },
      { status: 503 }
    );
  }
}
