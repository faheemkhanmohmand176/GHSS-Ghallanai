// api/auth-gateway.js
// ─────────────────────────────────────────────────────────────────────────────
// ONE Vercel serverless function (Hobby plan allows 12; this repo uses 11
// with it — was 10).  Dispatched by ?action= so we do NOT need a new function
// per protected endpoint.
//
//   ?action=register   admission applicant registration (Turnstile + RPC)
//   ?action=login      admission applicant login          (Turnstile + RPC)
//   ?action=track      public application tracking        (Turnstile + RPC + 2nd factor)
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

// Tiny JSON helper
const json = (code, body) =>
  new Response(JSON.stringify(body), {
    status: code,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });

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

// Read the editable limits from admission_settings (single row, id=1)
async function readLimits(supabase) {
  const { data } = await supabase
    .from("admission_settings")
    .select("rate_register_per_ip_day, rate_login_max_attempts, rate_login_cooldown_minutes, rate_track_per_ip_hour, rate_reset_per_ip_day, turnstile_required")
    .eq("id", 1)
    .maybeSingle();
  return data || {};
}

// ── Service-role Supabase client (only the gateway ever holds this key)
function serviceClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Action handlers
// ─────────────────────────────────────────────────────────────────────────────

// ?action=register  body: { nationality, cnic, mobile, password, turnstile }
async function handleRegister(body, ip, supabase) {
  const ts = await verifyTurnstile(body.turnstile, ip);
  if (!ts.ok) return json(400, { ok: false, error: ts.error });

  const limits = await readLimits(supabase);
  const ipKey = await hashKey(ip);
  const rl = await rateLimit(supabase, "register", ipKey, limits.rate_register_per_ip_day ?? 5, 24 * 60);
  if (!rl.allowed) return json(429, { ok: false, error: "Too many registration attempts from this network today. Please try again tomorrow." });

  const { data, error } = await supabase.rpc("inter_register", {
    p_nationality: body.nationality,
    p_cnic_formb: body.cnic,
    p_mobile: body.mobile,
    p_password: body.password,
  });
  if (error) return json(500, { ok: false, error: error.message });
  return json(200, { ...data, turnstile_unconfigured: ts.unconfigured });
}

// ?action=login  body: { loginId, password, turnstile }
async function handleLogin(body, ip, supabase) {
  const ts = await verifyTurnstile(body.turnstile, ip);
  if (!ts.ok) return json(400, { ok: false, error: ts.error });

  const limits = await readLimits(supabase);
  const idKey = await hashKey(body.loginId);
  const cooldown = limits.rate_login_cooldown_minutes ?? 15;
  const maxAttempts = limits.rate_login_max_attempts ?? 5;

  // Lockout: too many failed logins for this login id in the cooldown window
  const since = new Date(Date.now() - cooldown * 60_000).toISOString();
  const { count } = await supabase
    .from("security_attempts")
    .select("id", { count: "exact", head: true })
    .eq("bucket", "login")
    .eq("key", idKey)
    .eq("success", false)
    .gt("created_at", since);
  if ((count || 0) >= maxAttempts) {
    return json(429, { ok: false, error: `Too many failed attempts. Try again in ${cooldown} minutes.` });
  }

  const { data, error } = await supabase.rpc("inter_login", {
    p_login_id: body.loginId,
    p_password: body.password,
  });
  // Always record the attempt (success/fail) for the lockout window
  await supabase.from("security_attempts").insert({
    bucket: "login", key: idKey, success: Boolean(data && data.ok),
  });
  if (error) return json(500, { ok: false, error: error.message });
  return json(200, { ...data, turnstile_unconfigured: ts.unconfigured });
}

// ?action=track  body: { trackingId, secondFactor, turnstile }
async function handleTrack(body, ip, supabase) {
  const ts = await verifyTurnstile(body.turnstile, ip);
  if (!ts.ok) return json(400, { ok: false, error: ts.error });

  const limits = await readLimits(supabase);
  const ipKey = await hashKey(ip);
  const rl = await rateLimit(supabase, "track", ipKey, limits.rate_track_per_ip_hour ?? 20, 60);
  if (!rl.allowed) return json(429, { ok: false, error: "Too many tracking lookups from this network. Please try again later." });

  const { data, error } = await supabase.rpc("inter_track", {
    p_tracking_id: body.trackingId,
    p_second_factor: body.secondFactor,
    p_ip: ip,
  });
  // inter_track returns {ok:false} for ALL failure modes (wrong id, wrong
  // factor, rate-limited per id) so the response is identical and cannot be
  // used to probe for valid tracking IDs.
  if (error) return json(200, { ok: false });
  return json(200, { ...data, turnstile_unconfigured: ts.unconfigured });
}

// ?action=reset  body: { email, turnstile }   (main-site Supabase Auth)
async function handleReset(body, ip, supabase, req) {
  const ts = await verifyTurnstile(body.turnstile, ip);
  if (!ts.ok) return json(400, { ok: false, error: ts.error });

  const limits = await readLimits(supabase);
  const ipKey = await hashKey(ip);
  const rl = await rateLimit(supabase, "reset", ipKey, limits.rate_reset_per_ip_day ?? 5, 24 * 60);
  if (!rl.allowed) return json(429, { ok: false, error: "Too many reset requests from this network today." });

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
  if (!rl.allowed) return json(429, { ok: false, error: "Too many sign-in attempts from this network. Please try again later." });

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
  let body;
  try { body = await req.json(); }
  catch { return json(400, { ok: false, error: "Invalid JSON body." }); }

  const ip = clientIp(req);
  const supabase = serviceClient();
  if (!supabase) {
    return json(500, { ok: false, error: "Server not configured (SUPABASE_SERVICE_ROLE_KEY missing)." });
  }

  try {
    switch (action) {
      case "register": return await handleRegister(body, ip, supabase);
      case "login":    return await handleLogin(body, ip, supabase);
      case "track":    return await handleTrack(body, ip, supabase);
      case "reset":    return await handleReset(body, ip, supabase, req);
      case "signin":   return await handleSignIn(body, ip, supabase);
      default:         return json(400, { ok: false, error: "Unknown action." });
    }
  } catch (e) {
    return json(500, { ok: false, error: "Gateway error." });
  }
}
