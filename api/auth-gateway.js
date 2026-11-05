// api/auth-gateway.js
// ─────────────────────────────────────────────────────────────────────────────
// ONE Vercel serverless function (Hobby plan allows 12; this repo uses 11
// with it — was 10).  Dispatched by ?action= so we do NOT need a new function
// per protected endpoint.
//
//   ?action=apply      admission application, ONE atomic write (Turnstile + inter_apply)
//   ?action=track      public application tracking        (Turnstile + RPC + 2nd factor)
//                      and, on success, a private session to edit / pay it
//   (register / login were REMOVED: admission has no accounts any more.)
//   ?action=reset      main-site password reset           (Turnstile + Supabase Auth admin)
//   ?action=signin     main-site admin/user login         (Turnstile + Supabase Auth)
//
// WHY THIS EXISTS
//   Before this deploy the browser called inter_register / inter_login /
//   inter_track directly with the anon key.  Migration 24 REVOKEs anon
//   EXECUTE on those three RPCs, so the browser can no longer reach them.
//   The only caller that can is this gateway (service role).  This gateway
//   verifies a Cloudflare Turnstile token FIRST, then calls the RPC.  So a
//   browser that bypasses the Turnstile widget (or a bot) still cannot reach
//   the RPC — the gateway refuses it.
//
// FREE-PLAN PROTECTION (admission hardening, migration 25)
//   • LIMITS SNAPSHOT — admission_settings was read once per request. It is
//     now cached in memory for 30 s per warm instance, so a burst (or a bot
//     hammering the gateway) no longer multiplies that select.
//   • PER-IP FLOOD BRAKE — a free in-memory counter (hashed IP → requests in
//     the last minute) stops a flood BEFORE it costs any Supabase query.
//     Tunable: admission_settings.rate_gateway_per_ip_minute (default 90;
//     0 disables). Best-effort per warm instance — the DB-backed limits
//     below stay authoritative.
//   • Retry-After on every 429 so well-behaved clients back off politely.
//
// FAIL-SAFE
//   If TURNSTILE_SECRET_KEY is not set in Vercel env, the gateway does NOT
//   block the request (the site stays usable) but returns
//   { turnstile_unconfigured: true } so the frontend can surface an admin
//   warning banner.
//
// ENV (all server-only — never expose to the browser):
//   TURNSTILE_SECRET_KEY   Cloudflare Turnstile secret key
//   VITE_SUPABASE_URL      (already used elsewhere; read here for the server client)
//   SUPABASE_SERVICE_ROLE_KEY  service-role key — NEVER shipped to the browser
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY;

// Every outbound fetch (Supabase REST, Turnstile) gets a hard 8 s timeout.
// Vercel Hobby kills a Node function at ~10 s, and a slow/hung database call
// used to turn into a platform-level FUNCTION_INVOCATION_FAILED (a body-less
// 500) instead of a JSON error the browser can show as "please try again".
// 8 s always leaves the function time to answer first. supabase-js accepts a
// custom fetch via createClient({ global: { fetch } }) — this wrapper keeps
// the exact same fetch signature and only adds the abort timer.
const OUTBOUND_TIMEOUT_MS = 8000;
const timeoutFetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS) });

// Tiny JSON helper — optional third argument adds a Retry-After header
// (seconds) so polite clients back off instead of retrying immediately.
const json = (code, body, retryAfterSec) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (retryAfterSec) headers["Retry-After"] = String(retryAfterSec);
  return new Response(JSON.stringify(body), { status: code, headers });
};

// ── IP extraction (Vercel puts the client IP in x-forwarded-for or x-real-ip)
function clientIp(req) {
  const h = req.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") || h.get("cf-connecting-ip") || "0.0.0.0";
}

// Lightweight hash so we don't store raw IPs / login ids in security_attempts
async function hashKey(s) {
  const enc = new TextEncoder().encode(String(s || ""));
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Turnstile verification (server-side, never trusts the browser)
async function verifyTurnstile(token, ip) {
  if (!TURNSTILE_SECRET) {
    // Fail-safe: not configured → allow but flag it
    return { ok: true, unconfigured: true };
  }
  if (!token) return { ok: false, error: "Captcha token missing." };
  try {
    const form = new URLSearchParams();
    form.append("secret", TURNSTILE_SECRET);
    form.append("response", token);
    if (ip) form.append("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
    });
    const data = await r.json();
    if (data.success) return { ok: true };
    return { ok: false, error: "Captcha check failed. Please try again." };
  } catch (e) {
    return { ok: false, error: "Captcha service unavailable. Please try again." };
  }
}

// ── Rate-limit helper: count + insert attempt row
async function rateLimit(supabase, bucket, key, maxPerWindow, windowMinutes) {
  if (!maxPerWindow || maxPerWindow <= 0) return { allowed: true };
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count, error } = await supabase
    .from("security_attempts")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .eq("key", key)
    .gt("created_at", since);
  if (error) {
    // If the table is unreachable, fail OPEN (don't break the site) — the RPC
    // still has its own per-id limit inside inter_track.
    return { allowed: true };
  }
  if ((count || 0) >= maxPerWindow) {
    return { allowed: false, retryAfter: windowMinutes };
  }
  await supabase.from("security_attempts").insert({ bucket, key, success: false });
  return { allowed: true };
}

// Read the editable limits from admission_settings (single row, id=1).
// CACHED IN MEMORY for 30 s per warm instance: during a burst the same row
// was re-read for every request, which is exactly when the free-plan compute
// budget is precious. Limit values do not need second-level freshness —
// admin edits apply on the next snapshot. On error we cache an empty object
// (callers keep their defaults) instead of hammering a broken table.
const LIMITS_TTL_MS = 30_000;
let limitsSnapshot = { at: 0, data: {} };
async function readLimits(supabase) {
  if (Date.now() - limitsSnapshot.at < LIMITS_TTL_MS) return limitsSnapshot.data;
  const { data } = await supabase
    .from("admission_settings")
    .select("rate_register_per_ip_day, rate_login_max_attempts, rate_login_cooldown_minutes, rate_track_per_ip_hour, rate_reset_per_ip_day, turnstile_required, rate_gateway_per_ip_minute")
    .eq("id", 1)
    .maybeSingle();
  limitsSnapshot = { at: Date.now(), data: data || {} };
  return limitsSnapshot.data;
}

// ── Per-IP flood brake (in-memory, free, per warm instance) ───────────────
// FIRST gate every request passes — before Turnstile, before ANY Supabase
// query. A real applicant needs a handful of gateway calls per minute; a
// shared school NAT stays far below the default 90. A flood gets 429 at
// zero database cost. Tunable via admission_settings.rate_gateway_per_ip_minute
// (migration 25; 0 disables). Serverless instances are recycled often, so
// this is best-effort — the DB-backed limits below remain authoritative.
const FLOOD_WINDOW_MS = 60_000;
const floodMap = new Map(); // hashed IP → timestamps of allowed requests
let floodSweptAt = 0;

async function floodBrake(ip, supabase) {
  const limits = await readLimits(supabase);   // cached — no extra query
  const max = Number(limits.rate_gateway_per_ip_minute ?? 90);
  if (!max || max <= 0) return { allowed: true };

  const key = await hashKey(ip);
  const now = Date.now();

  // Periodic sweep so the Map can never grow without bound.
  if (now - floodSweptAt > FLOOD_WINDOW_MS * 5) {
    for (const [k, arr] of floodMap) {
      const alive = arr.filter((t) => now - t < FLOOD_WINDOW_MS);
      if (alive.length === 0) floodMap.delete(k);
      else floodMap.set(k, alive);
    }
    floodSweptAt = now;
  }

  const arr = (floodMap.get(key) || []).filter((t) => now - t < FLOOD_WINDOW_MS);
  if (arr.length >= max) return { allowed: false, retryAfter: 60 };
  arr.push(now);
  floodMap.set(key, arr);
  return { allowed: true };
}

// ── Service-role Supabase client (only the gateway ever holds this key)
function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: timeoutFetch },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Action handlers
// ─────────────────────────────────────────────────────────────────────────────

// ?action=apply  body: { nationality, cnic, personal, ssc, programId, quota,
//                        criteria, subjectGroup, turnstile }
// The ONLY place an applicant is ever written.  Everything the applicant typed
// lives on their device until now; the Turnstile captcha is verified here and
// inter_apply stores applicant + profiles + application in ONE transaction.
async function handleApply(body, ip, supabase) {
  const ts = await verifyTurnstile(body.turnstile, ip);
  if (!ts.ok) return json(400, { ok: false, error: ts.error });

  if (!body.personal || typeof body.personal !== "object" ||
      !body.ssc || typeof body.ssc !== "object") {
    return json(200, { ok: false, error: "Please complete your Personal Information and Matric Profile before applying." });
  }

  const limits = await readLimits(supabase);
  const ipKey = await hashKey(ip);
  const rl = await rateLimit(supabase, "register", ipKey, limits.rate_register_per_ip_day ?? 100, 24 * 60);
  if (!rl.allowed) return json(429, { ok: false, error: "Too many applications from this network today. Please try again tomorrow." }, (rl.retryAfter || 24 * 60) * 60);

  const { data, error } = await supabase.rpc("inter_apply", {
    p_nationality: body.nationality,
    p_cnic_formb: body.cnic,
    p_personal: body.personal,
    p_ssc: body.ssc,
    p_program_id: Number(body.programId),
    p_quota: body.quota,
    p_criteria: body.criteria ?? {},
    p_subject_group: body.subjectGroup ?? null,
  });
  if (error) return json(500, { ok: false, error: "Could not submit your application. Please try again." });
  return json(200, { ...data, turnstile_unconfigured: ts.unconfigured });
}

// ?action=track  body: { trackingId, secondFactor, turnstile }
async function handleTrack(body, ip, supabase) {
  const ts = await verifyTurnstile(body.turnstile, ip);
  if (!ts.ok) return json(400, { ok: false, error: ts.error });

  const limits = await readLimits(supabase);
  const ipKey = await hashKey(ip);
  const rl = await rateLimit(supabase, "track", ipKey, limits.rate_track_per_ip_hour ?? 20, 60);
  if (!rl.allowed) return json(429, { ok: false, error: "Too many tracking lookups from this network. Please try again later." }, (rl.retryAfter || 60) * 60);

  const { data, error } = await supabase.rpc("inter_track", {
    p_tracking_id: body.trackingId,
    p_second_factor: body.secondFactor,
    p_ip: ip,
  });
  // inter_track returns {ok:false} for ALL failure modes (wrong id, wrong
  // factor, rate-limited per id) so the response is identical and cannot be
  // used to probe for valid tracking IDs.
  if (error) return json(200, { ok: false });

  // Verified (Tracking ID + 2nd factor + captcha) → also open a private,
  // 7-day session so the applicant can edit / pay this application without
  // any account or password.  Never blocks the status result itself.
  let access = null;
  if (data && data.ok) {
    try {
      const g = await supabase.rpc("inter_access_grant", { p_tracking_id: body.trackingId });
      if (g.data && g.data.ok) access = { token: g.data.token, application_id: g.data.application_id };
    } catch (_e) { access = null; }
  }
  return json(200, { ...data, access, turnstile_unconfigured: ts.unconfigured });
}

// ?action=reset  body: { email, turnstile }   (main-site Supabase Auth)
async function handleReset(body, ip, supabase, req) {
  const ts = await verifyTurnstile(body.turnstile, ip);
  if (!ts.ok) return json(400, { ok: false, error: ts.error });

  const limits = await readLimits(supabase);
  const ipKey = await hashKey(ip);
  const rl = await rateLimit(supabase, "reset", ipKey, limits.rate_reset_per_ip_day ?? 5, 24 * 60);
  if (!rl.allowed) return json(429, { ok: false, error: "Too many reset requests from this network today." }, (rl.retryAfter || 24 * 60) * 60);

  // Use the service-role admin API so the reset email is sent server-side.
  // redirectTo must be an allowed URL in Supabase Auth settings.
  const origin = req.headers.get("origin") || new URL(req.url).origin;
  const redirectTo = `${origin}/auth/reset-password`;
  const { error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: body.email,
    options: { redirectTo },
  });
  // NOTE: generateLink sends the email AND returns the link. We do NOT return
  // the link to the browser. We always reply "check your email" whether or
  // not the email exists (no account enumeration).
  return json(200, { ok: true, sent: true, turnstile_unconfigured: ts.unconfigured });
}

// ?action=signin  body: { email, password, turnstile }   (main-site Supabase Auth)
//   Verifies Turnstile, then performs signInWithPassword server-side and
//   returns the session so the browser can call supabase.auth.setSession().
async function handleSignIn(body, ip, supabase) {
  const ts = await verifyTurnstile(body.turnstile, ip);
  if (!ts.ok) return json(400, { ok: false, error: ts.error });

  // Per-IP rate limit on sign-in (Supabase Auth has its own per-account
  // lockout too; this is the network-level gate).
  const ipKey = await hashKey(ip);
  const rl = await rateLimit(supabase, "login", ipKey, 20, 15);
  if (!rl.allowed) return json(429, { ok: false, error: "Too many sign-in attempts from this network. Please try again later." }, (rl.retryAfter || 15) * 60);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });
  if (error || !data.session) {
    return json(200, { ok: false, error: "No account found with this email/password, or you haven't signed up yet." });
  }
  return json(200, {
    ok: true,
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    user: { id: data.user.id, email: data.user.email },
    turnstile_unconfigured: ts.unconfigured,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req) {
  // ── CRASH-PROOF WRAPPER ───────────────────────────────────────────────
  // A previously-deployed build of this function crashed at invocation time
  // (Vercel FUNCTION_INVOCATION_FAILED — a body-less 500) which made
  // register / login / track permanently unusable from the browser: the
  // applicant only ever saw "Network error. Please try again." Every step
  // of the request — including CORS, IP extraction and the flood brake — now
  // lives inside this one try/catch, so whatever happens the browser gets a
  // JSON answer it can render.
  try {
    return await handle(req);
  } catch (e) {
    return json(500, { ok: false, error: "Gateway error." });
  }
}

async function handle(req) {
  // CORS: only the same origin may call this gateway
  const origin = req.headers.get("origin");
  const allow = origin && (origin === new URL(req.url).origin);
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": allow ? origin : "",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed." });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  const ip = clientIp(req);
  const supabase = serviceClient();
  if (!supabase) {
    return json(500, { ok: false, error: "Server not configured (SUPABASE_SERVICE_ROLE_KEY missing)." });
  }

  // Per-IP flood brake — the FIRST gate, before body parsing, Turnstile or
  // any DB query, so even garbage-JSON floods are stopped for free.
  // (Never let the brake itself kill the request: a database hiccup inside
  // readLimits is swallowed and treated as "no limits known".)
  let flood;
  try {
    flood = await floodBrake(ip, supabase);
  } catch (_e) {
    flood = { allowed: true };
  }
  if (!flood.allowed) {
    return json(429, { ok: false, error: "Too many requests. Please slow down and try again shortly." }, flood.retryAfter || 60);
  }

  let body;
  try { body = await req.json(); }
  catch { return json(400, { ok: false, error: "Invalid JSON body." }); }

  try {
    switch (action) {
      case "apply":    return await handleApply(body, ip, supabase);
      case "track":    return await handleTrack(body, ip, supabase);
      case "reset":    return await handleReset(body, ip, supabase, req);
      case "signin":   return await handleSignIn(body, ip, supabase);
      default:         return json(400, { ok: false, error: "Unknown action." });
    }
  } catch (e) {
    return json(500, { ok: false, error: "Gateway error." });
  }
}
