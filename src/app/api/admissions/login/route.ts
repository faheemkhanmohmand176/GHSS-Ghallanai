import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual, scryptSync } from "node:crypto";
import { isSupabaseConfigured, getSupabaseServer } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  let body: any; try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }); }
  const cnic = typeof body.cnic === "string" ? body.cnic : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^\d{13}$/.test(cnic) || password.length < 8) return NextResponse.json({ error: "Enter the 13-digit CNIC/Form-B and your password." }, { status: 422 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, demo: true });
  try {
    const { data, error } = await getSupabaseServer().from("admission_accounts").select("password_digest, status").eq("cnic", cnic).maybeSingle();
    if (error || !data || data.status !== "active") return NextResponse.json({ error: "Invalid CNIC/Form-B or password." }, { status: 401 });
    const [salt, stored] = String(data.password_digest).split(":");
    const candidate = scryptSync(password, salt, 64);
    const expected = Buffer.from(stored, "hex");
    if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) return NextResponse.json({ error: "Invalid CNIC/Form-B or password." }, { status: 401 });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "The account service is temporarily unavailable." }, { status: 503 }); }
}
