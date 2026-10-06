import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured, getSupabaseService } from "@/lib/supabase";

const schema = z.object({
  name: z.string().min(2).max(120),
  phone: z.string().max(20).optional().or(z.literal("")),
  type: z.enum(["feedback", "complaint", "admission", "result"]),
  message: z.string().min(5).max(4000),
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
  return b.count > 8;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return NextResponse.json({ error: "Too many messages from this connection. Try again later." }, { status: 429 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please complete the required fields." }, { status: 422 });
  }

  const reference = `FB-${Date.now().toString(36).toUpperCase()}`;

  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabaseService();
      const { error } = await sb.from("feedback").insert({
        reference,
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        type: parsed.data.type,
        message: parsed.data.message,
        status: "new",
      });
      if (error) throw error;
      await sb.from("audit_log").insert({ action: "feedback.received", target: reference, meta: { ip } });
      return NextResponse.json({ reference });
    } catch {
      return NextResponse.json({ error: "The feedback service is temporarily unavailable. Please WhatsApp the school." }, { status: 503 });
    }
  }
  return NextResponse.json({ reference, demo: true });
}
