import { NextRequest, NextResponse } from "next/server";
import { randomBytes, scryptSync } from "node:crypto";
import { z } from "zod";
import { isSupabaseConfigured, getSupabaseServer } from "@/lib/supabase";

/**
 * POST /api/admissions/register — mirrors HED KPK apply_step1.php
 * Captured from https://admission.hed.gkp.pk/apply_step1.php
 *
 * Fields:
 *  - nationality: Pakistani | Afghani
 *  - cnic: 13 digits without dashes (Pakistani) — locked for life
 *  - afghaniCard: Afghan card/passport number (Afghani)
 *  - email: optional
 *  - phone: 11 digits starting with 03 — locked for life, used for SMS + payment
 *  - password + confirmPassword (min 8 chars)
 *  - captcha: math answer
 *
 * The CNIC/Form-B is the unique key — one account per CNIC. The password is
 * stored as scrypt(salt:digest) — never plain text.
 */

const schema = z.object({
  nationality: z.enum(["Pakistani", "Afghani"]),
  cnic: z.string().regex(/^[0-9]{13}$/, "CNIC/Form-B must be exactly 13 digits without dashes."),
  afghaniCard: z.string().min(5).max(40).optional(),
  email: z.string().email().max(120).or(z.literal("")),
  phone: z.string().regex(/^03\d{9}$/, "Phone must be 11 digits starting with 03."),
  password: z.string().min(8).max(128),
  confirmPassword: z.string(),
  captcha: z.number(),
}).refine((v) => v.password === v.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
}).refine((v) => v.nationality === "Pakistani" || Boolean(v.afghaniCard), {
  message: "Afghani applicants must enter a card/passport number",
  path: ["afghaniCard"],
});

export async function POST(req: NextRequest) {
  let input: unknown;
  try { input = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return NextResponse.json({
      error: "Check the nationality, 13-digit CNIC/Form-B, password and maths answer.",
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    }, { status: 422 });
  }

  // Captcha check: client sends a + b captcha; we don't know the operands
  // server-side (they're randomised client-side), so we accept any non-zero
  // number as a basic spam check. Real HED sends server-side captcha operands
  // too — for production GHSS Ghallanai, move captcha generation server-side.
  if (parsed.data.captcha < 1) {
    return NextResponse.json({ error: "Solve the maths captcha." }, { status: 422 });
  }

  const { nationality, cnic, email, phone, password } = parsed.data;

  if (isSupabaseConfigured()) {
    try {
      const salt = randomBytes(16).toString("hex");
      const digest = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
      const { error } = await getSupabaseServer().from("admission_accounts").insert({
        nationality,
        cnic,
        email: email || null,
        phone,
        password_digest: digest,
        status: "active",
      });
      if (error) {
        if (error.code === "23505") {
          return NextResponse.json({ error: "An account already exists for this CNIC/Form-B." }, { status: 409 });
        }
        throw error;
      }
      return NextResponse.json({ ok: true, demo: false });
    } catch (e) {
      console.error("[admissions/register] Supabase error:", e);
      return NextResponse.json(
        { error: "The account service is temporarily unavailable. The local draft remains safe on this device." },
        { status: 503 }
      );
    }
  }

  return NextResponse.json({ ok: true, demo: !isSupabaseConfigured() });
}
