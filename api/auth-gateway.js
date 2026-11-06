// api/auth-gateway.js
// ─────────────────────────────────────────────────────────────────────────────
// ONE Vercel serverless function (Hobby plan allows 12; this repo uses 11
// with it — was 10).  Dispatched by ?action= so we do NOT need a new function
// per protected endpoint.
//
//   ?action=apply      admission application, ONE atomic write (Turnstile + inter_apply)
//   (track moved OUT of the gateway: the browser calls inter_track_by_id
//    directly - one indexed call, see migration 28.)
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
  return { status: code, headers, body: JSON.stringify(body) };
};

// Vercel runs this file with the Node (req, res) signature, like every other
// file in /api. Write a json()/empty descriptor onto the Node response.
function send(res, out) {
  res.statusCode = out.status;
  for (const [k, v] of Object.entries(out.headers || {})) res.setHeader(k, v);
  res.end(out.body ?? "");
}

// Node headers are a plain lower-cased object (not a Headers instance).
const hdr = (req, name) => {
  const v = req.headers?.[name];
  return Array.isArray(v) ? v[0] : v;
};
const originOf = (req) => {
  const proto = (hdr(req, "x-forwarded-proto") || "https").split(",")[0].trim();
  const host = (hdr(req, "x-forwarded-host") || hdr(req, "host") || "").split(",")[0].trim();
  return `${proto}://${host}`;
};

// ── CORS ────────────────────────────────────────────────────────────────────
// THE BUG (a silent request killer):
//   The preflight handler used to echo the request's Origin ONLY when it was
//   a character-for-character match with originOf(req) (scheme + host + port).
//   Every other origin got `Access-Control-Allow-Origin: ""` — and a
//   preflight answered with an EMPTY allow-origin makes the browser block
//   the request outright with exactly "TypeError: Failed to fetch", with no
//   server-side trace at all.
//
//   Real origins that did NOT match and were therefore killed:
//     • http://ghssghallanai.dpdns.org   (the http:// variant)
//     • https://ghssghallanai.dpdns.org:443 (explicit default port)
//     • null                              (privacy browsers / extensions)
//     • any www/alias of the site
//   A same-origin request never sends a preflight, which is why the bug was
//   invisible from the normal sign-in path — and fatal the moment anything
//   made the request cross-origin.
//
// THE FIX: never answer with an empty value. Compare by HOSTNAME only (so
// scheme/port variants of the same site are all allowed) against a FIXED
// allow-list — never a request-derived one, or a client could spoof
// X-Forwarded-Host and have its own origin echoed back.
const SITE_ORIGIN = "https://ghssghallanai.dpdns.org";
const SITE_HOSTNAME = "ghssghallanai.dpdns.org";

function allowOriginFor(req) {
  const origin = hdr(req, "origin");
  if (!origin) return SITE_ORIGIN;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (host === SITE_HOSTNAME) return origin; // echo the exact origin
  } catch {
    /* unparseable Origin → fall through to the canonical origin */
  }
  // Not our site → answer with our origin (never empty). The browser will
  // refuse to expose the response to the requester, which is correct.
  return SITE_ORIGIN;
}

function corsHeadersFor(req) {
  return {
    "Access-Control-Allow-Origin": allowOriginFor(req),
    // The answer now depends on the request's Origin → caches must key on it.
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRF-Token, apikey",
    "Access-Control-Max-Age": "86400",
  };
}

// ── IP extraction (Vercel puts the client IP in x-forwarded-for or x-real-ip)
function clientIp(req) {
  const xff = hdr(req, "x-forwarded-for");
  if (xff) return String(xff).split(",")[0].trim();
  return hdr(req, "x-real-ip") || hdr(req, "cf-connecting-ip") || "0.0.0.0";
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
//
// Split into COUNT and RECORD so a caller can run the count CONCURRENTLY
// with an independent network call (the Turnstile verification) instead of
// paying for the round-trips one after the other. See handleSignIn() — on a
// slow mobile connection that difference is the difference between an answer
// arriving in 0.8 s and in 1.6 s, and a connection that a carrier proxy
// drops at ~1 s never answers at all.
async function countAttempts(supabase, bucket, key, windowMinutes) {
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
    return null;
  }
  return count || 0;
}

async function recordAttempt(supabase, bucket, key) {
  try {
    await supabase.from("security_attempts").insert({ bucket, key, success: false });
  } catch {
    /* best effort — the in-memory flood brake still applies */
  }
}

// Combined helper for the actions that do not need the parallel split.
async function rateLimit(supabase, bucket, key, maxPerWindow, windowMinutes) {
  if (!maxPerWindow || maxPerWindow <= 0) return { allowed: true };
  const count = await countAttempts(supabase, bucket, key, windowMinutes);
  if (count === null) return { allowed: true };
  if (count >= maxPerWindow) return { allowed: false, retryAfter: windowMinutes };
  await recordAttempt(supabase, bucket, key);
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
  const origin = hdr(req, "origin") || originOf(req);
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
  const ipKey = await hashKey(ip);

  // ── SPEED: the sign-in answer must beat the client's connection ──────────
  // The old code made three INDEPENDENT round-trips strictly one after the
  // other: (1) Turnstile siteverify → Cloudflare, (2) the rate-limit COUNT
  // → Supabase, (3) signInWithPassword → Supabase. That is 1–2 s before the
  // browser sees a single byte — and on a mobile connection a carrier proxy
  // that drops an idle connection at ~1 s kills the request before the user
  // ever gets a response. That is exactly the reported symptom:
  // "Request failed after 1s (TypeError: Failed to fetch)".
  //
  // The Turnstile check and the attempt COUNT do not depend on each other,
  // so they now run CONCURRENTLY, and the attempt RECORD overlaps with the
  // sign-in itself. Identical security decisions, ~2 round-trips of latency
  // removed from the critical path.
  const [ts, attempts] = await Promise.all([
    verifyTurnstile(body.turnstile, ip),
    countAttempts(supabase, "login", ipKey, 15),
  ]);

  if (!ts.ok) return json(400, { ok: false, error: ts.error });

  // Per-IP rate limit on sign-in (Supabase Auth has its own per-account
  // lockout too; this is the network-level gate).
  const LOGIN_MAX = 20;
  if (attempts !== null && attempts >= LOGIN_MAX) {
    return json(429, { ok: false, error: "Too many sign-in attempts from this network. Please try again later." }, 15 * 60);
  }

  // The limit check has already passed, so the attempt MUST be recorded —
  // write it WHILE the sign-in is in flight instead of after it.
  const recorded = recordAttempt(supabase, "login", ipKey);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });
  await recorded;

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
// Entry point  (Node runtime: handler(req, res))
//
// ROOT-CAUSE FIX for "Network Error" on every Sign In:
//   This file used the Web-standard signature handler(Request) -> Response
//   (req.headers.get(), await req.json(), return new Response()).  Vercel runs
//   it with the Node signature (req, res) — the same as every other file in
//   /api — so req.headers.get threw, the returned Response was ignored, and
//   res was never ended.  The browser waited until its 20 s timeout and showed
//   "Network error".  The handler now reads req/res the Node way and always
//   ends the response.
// ─────────────────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  try {
    const out = await handle(req);
    // The CORS headers are applied HERE (where `req` is available) so every
    // answer — success, error and preflight — carries the same, never-empty
    // Access-Control-Allow-Origin.
    out.headers = { ...corsHeadersFor(req), ...(out.headers || {}) };
    send(res, out);
  } catch (e) {
    console.error("auth-gateway fatal:", e);
    const out = json(500, { ok: false, error: "Gateway error." });
    out.headers = { ...corsHeadersFor(req), ...(out.headers || {}) };
    send(res, out);
  }
}

async function readBody(req) {
  const b = req.body;
  if (b && typeof b === "object" && !Buffer.isBuffer(b)) return b;
  if (typeof b === "string" && b.length) return JSON.parse(b);
  if (Buffer.isBuffer(b) && b.length) return JSON.parse(b.toString("utf8"));
  // Body not pre-parsed: read the raw stream.
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function handle(req) {
  if (req.method === "OPTIONS") {
    // CORS headers are attached by the entry point (corsHeadersFor) so the
    // preflight can never be answered with an empty allow-origin.
    return { status: 204, headers: {}, body: "" };
  }
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed." });

  const action = new URL(req.url, originOf(req)).searchParams.get("action");

  const ip = clientIp(req);
  const supabase = serviceClient();
  if (!supabase) {
    return json(500, { ok: false, error: "Server not configured (SUPABASE_SERVICE_ROLE_KEY missing)." });
  }

  // Per-IP flood brake — first gate, before Turnstile or any DB query.
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
  try { body = await readBody(req); }
  catch { return json(400, { ok: false, error: "Invalid JSON body." }); }

  try {
    switch (action) {
      case "apply":    return await handleApply(body, ip, supabase);
      case "reset":    return await handleReset(body, ip, supabase, req);
      case "signin":   return await handleSignIn(body, ip, supabase);
      default:         return json(400, { ok: false, error: "Unknown action." });
    }
  } catch (e) {
    console.error("auth-gateway action error:", e);
    return json(500, { ok: false, error: "Gateway error." });
  }
}
