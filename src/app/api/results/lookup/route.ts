import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { lookupResult } from "@/lib/data";

/**
 * POST /api/results/lookup — Master Plan §8.8.
 * Rate-limited public result lookup. Captcha escalation after
 * 3 failed attempts per IP is stubbed for the demo build.
 */

const schema = z.object({
  rollNo: z.string().min(3).max(30),
  year: z.coerce.number().int().min(2020).max(2100),
  programme: z.enum(["ics", "pre-medical", "pre-engineering", "arts"]),
});

/** Per-IP: 20 lookups / 10 min, and failure escalation counter */
const buckets = new Map<string, { count: number; fails: number; resetAt: number }>();
function bucket(ip: string) {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || b.resetAt < now) {
    b = { count: 0, fails: 0, resetAt: now + 10 * 60 * 1000 };
    buckets.set(ip, b);
  }
  return b;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const b = bucket(ip);
  b.count += 1;
  if (b.count > 20) {
    return NextResponse.json(
      { error: "Too many lookups. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid roll number, year and programme." }, { status: 422 });
  }

  const result = await lookupResult(parsed.data.rollNo, parsed.data.year, parsed.data.programme);
  if (!result) {
    b.fails += 1;
    return NextResponse.json(
      {
        error:
          b.fails >= 3
            ? "No result found for that roll number. After repeated misses, verification is required — WhatsApp the exam branch."
            : "No result found for that roll number. Check the number and try again.",
        captcha: b.fails >= 3,
      },
      { status: 404 }
    );
  }

  // Never leak contact details publicly — strip names' father field in demo
  const safe = { ...result, fatherName: undefined };
  return NextResponse.json({ result: safe, year: parsed.data.year, programme: parsed.data.programme });
}
