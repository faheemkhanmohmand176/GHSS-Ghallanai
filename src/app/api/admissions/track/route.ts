import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured, getSupabaseServer } from "@/lib/supabase";

const buckets = new Map<string, { count: number; resetAt: number }>();
function limited(ip: string) { const now = Date.now(); const current = buckets.get(ip); if (!current || current.resetAt < now) { buckets.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 }); return false; } current.count += 1; return current.count > 30; }

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) return NextResponse.json({ error: "Too many lookups. Please try again later." }, { status: 429 });
  const id = req.nextUrl.searchParams.get("application_id")?.trim().toUpperCase() ?? "";
  if (!/^GHSS-\d{4}-\d{4,8}$/.test(id)) return NextResponse.json({ error: "Enter a valid application tracking ID, such as GHSS-2026-0001." }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "No live application record was found." }, { status: 404 });
  try {
    const { data, error } = await getSupabaseServer().from("admissions").select("application_no, admission_type, programme, full_name, status, merit_rank, decision_note, created_at, updated_at").eq("application_no", id).maybeSingle();
    if (error || !data) return NextResponse.json({ error: "No application was found for that tracking ID." }, { status: 404 });
    return NextResponse.json({ application: data });
  } catch { return NextResponse.json({ error: "The tracking service is temporarily unavailable." }, { status: 503 }); }
}
