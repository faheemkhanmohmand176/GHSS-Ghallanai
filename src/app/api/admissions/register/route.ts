import { NextRequest, NextResponse } from "next/server";
import { randomBytes, scryptSync } from "node:crypto";
import { z } from "zod";
import { isSupabaseConfigured, getSupabaseServer } from "@/lib/supabase";

const schema = z.object({ nationality: z.enum(["Pakistani", "Afghani"]), cnic: z.string().regex(/^\d{13}$/), email: z.string().email().max(120).or(z.literal("")), phone: z.string().regex(/^03\d{9}$/), password: z.string().min(8).max(128), confirmPassword: z.string(), captcha: z.number() }).refine((v) => v.password === v.confirmPassword, { message: "Passwords do not match" });

export async function POST(req: NextRequest) {
  let input: unknown; try { input = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const parsed = schema.safeParse(input); if (!parsed.success || parsed.data.captcha !== 21) return NextResponse.json({ error: "Check the nationality, 13-digit CNIC/Form-B, password and maths answer." }, { status: 422 });
  const { nationality, cnic, email, phone, password } = parsed.data;
  if (isSupabaseConfigured()) {
    try {
      const salt = randomBytes(16).toString("hex");
      const digest = `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
      const { error } = await getSupabaseServer().from("admission_accounts").insert({ nationality, cnic, email: email || null, phone, password_digest: digest, status: "active" });
      if (error) { if (error.code === "23505") return NextResponse.json({ error: "An account already exists for this CNIC/Form-B." }, { status: 409 }); throw error; }
    } catch { return NextResponse.json({ error: "The account service is temporarily unavailable. The local draft remains safe on this device." }, { status: 503 }); }
  }
  return NextResponse.json({ ok: true, demo: !isSupabaseConfigured() });
}
