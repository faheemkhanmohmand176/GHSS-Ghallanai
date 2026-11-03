// api/safepay.js — Safepay online fee payment for the admission portal
// ═══════════════════════════════════════════════════════════════════════════
// ONE serverless function (Vercel Hobby allows 12; this repo uses 10 with it),
// dispatched by `?kind=`; vercel.json rewrites give it clean public URLs:
//
//   GET  /api/safepay?kind=config      → { enabled }          (is online pay available?)
//   POST /api/create-payment           → { url }              (kind=create)
//   POST /api/safepay-webhook          → 200 / 400            (kind=webhook, called by Safepay)
//
// SECURITY MODEL
//   • Secrets (SAFEPAY_API_KEY / SAFEPAY_V1_SECRET / SAFEPAY_WEBHOOK_SECRET /
//     SUPABASE_SERVICE_ROLE_KEY) exist only in Vercel env — never in the browser.
//   • The browser sends ONLY { application_id, token } (its applicant session).
//     The server verifies the session in the database and takes the amount and
//     the orderId (tracking_id) from the DATABASE — the client can never choose
//     the amount, the order or somebody else's application.
//   • The webhook is trusted only after the HMAC-SHA512 signature is verified
//     with the Safepay SDK. The tracker, the orderId and the paid amount are then
//     re-checked inside the database function before anything is marked paid.
//   • Idempotent: Safepay retries are de-duplicated (event ledger + function).
//   • Unknown order / mismatches are logged and answered with 200 so Safepay does
//     not retry forever; a bad signature is answered with 400.
// ═══════════════════════════════════════════════════════════════════════════

import sfpy from "@sfpy/node-sdk";
import { SITE_URL as DEFAULT_SITE_URL } from "../scripts/seo-page-content.mjs";

const { Safepay } = sfpy;

const SB_TIMEOUT_MS = 8000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 64 * 1024;

// ── Config ────────────────────────────────────────────────────────────────
function safepayEnv() {
  const environment = (process.env.SAFEPAY_ENV || "sandbox").trim().toLowerCase();
  return {
    environment: environment === "production" ? "production" : "sandbox",
    apiKey: process.env.SAFEPAY_API_KEY || "",
    v1Secret: process.env.SAFEPAY_V1_SECRET || "",
    webhookSecret: process.env.SAFEPAY_WEBHOOK_SECRET || "",
  };
}
const safepayReady = (c) => !!(c.apiKey && c.v1Secret && c.webhookSecret);

function sbCfg() {
  const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return { url, key, ok: !!(url && key) };
}

function siteUrl(req) {
  const fromEnv = (process.env.SITE_URL || "").trim().replace(/\/+$/, "");
  if (/^https:\/\/[a-z0-9.-]+$/i.test(fromEnv)) return fromEnv;
  return DEFAULT_SITE_URL.replace(/\/+$/, "");
}

// ── Supabase (service role, server only) ──────────────────────────────────
async function sbRpc(fn, args) {
  const { url, key } = sbCfg();
  const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(SB_TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`rpc ${fn} → ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

async function sbInsert(table, row, { ignoreDuplicates = false } = {}) {
  const { url, key } = sbCfg();
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json",
      Prefer: ignoreDuplicates ? "resolution=ignore-duplicates,return=representation" : "return=minimal",
    },
    body: JSON.stringify(row),
    signal: AbortSignal.timeout(SB_TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`insert ${table} → ${res.status} ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

async function sbSelectOne(path) {
  const { url, key } = sbCfg();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    signal: AbortSignal.timeout(SB_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`select ${path.split("?")[0]} → ${res.status}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] ?? null : rows;
}

// ── Helpers ───────────────────────────────────────────────────────────────
function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  const b = req.body;
  if (b && typeof b === "object" && !Buffer.isBuffer(b)) return b;
  const raw = Buffer.isBuffer(b) ? b.toString("utf8") : typeof b === "string" ? b : "";
  if (raw.length > MAX_BODY_BYTES) throw new Error("body too large");
  return raw ? JSON.parse(raw) : {};
}

// Tiny per-instance rate limiter (create endpoint only).
const hits = new Map();
function limited(req, max = 8, windowMs = 60_000) {
  const ip =
    (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
    req.headers["x-real-ip"] || "unknown";
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.reset) { hits.set(ip, { n: 1, reset: now + windowMs }); return false; }
  e.n += 1;
  if (hits.size > 2000) for (const [k, v] of hits) if (now > v.reset) hits.delete(k);
  return e.n > max;
}

// ── kind=config ───────────────────────────────────────────────────────────
async function handleConfig(req, res) {
  const cfg = safepayEnv();
  let enabled = safepayReady(cfg) && sbCfg().ok;
  if (enabled) {
    try {
      const row = await sbSelectOne("admission_settings?select=online_payment_enabled&id=eq.1&limit=1");
      if (row && row.online_payment_enabled === false) enabled = false;
    } catch { /* keep env-based answer */ }
  }
  res.setHeader("Cache-Control", "public, s-maxage=30, stale-while-revalidate=120");
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ enabled }));
}

// ── kind=create ───────────────────────────────────────────────────────────
async function handleCreate(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed." });
  const cfg = safepayEnv();
  if (!safepayReady(cfg) || !sbCfg().ok) {
    console.error("safepay: server is missing Safepay or Supabase environment variables");
    return json(res, 503, { ok: false, error: "Online payment is not available right now. Please use the manual method." });
  }
  if (limited(req)) return json(res, 429, { ok: false, error: "Too many attempts. Please wait a minute and try again." });

  let body;
  try { body = readBody(req); } catch { return json(res, 400, { ok: false, error: "Invalid request." }); }
  const token = String(body.token || "");
  const applicationId = String(body.application_id || "");
  if (!UUID_RE.test(token) || !UUID_RE.test(applicationId)) {
    return json(res, 400, { ok: false, error: "Invalid request." });
  }

  // 1 · Who is asking, and what do they owe? (database decides, not the browser)
  let ctx;
  try { ctx = await sbRpc("inter_payment_context", { p_token: token, p_application_id: applicationId }); }
  catch (e) {
    console.error("safepay create: context failed:", e.message);
    return json(res, 502, { ok: false, error: "Could not start the payment. Please try again." });
  }
  if (!ctx?.ok) return json(res, 403, { ok: false, error: ctx?.error || "Not allowed." });
  if (!ctx.online_enabled) return json(res, 403, { ok: false, error: "Online payment is currently turned off by the school." });
  if (ctx.payment_status === "paid") return json(res, 409, { ok: false, error: "This fee is already paid." });
  if (ctx.status === "cancelled") return json(res, 409, { ok: false, error: "This application was cancelled." });
  if (ctx.deadline_passed) return json(res, 409, { ok: false, error: "The payment deadline for this application has passed." });

  const amount = Number(ctx.processing_fee);
  const orderId = String(ctx.tracking_id || "");
  if (!Number.isFinite(amount) || amount <= 0 || !orderId) {
    return json(res, 500, { ok: false, error: "Payment details are incomplete. Please contact the school office." });
  }

  // 2 · Safepay: payment token → hosted checkout URL
  try {
    const safepay = new Safepay(cfg);
    const created = await safepay.payments.create({ amount, currency: "PKR" });
    const tracker = created?.token;
    if (!tracker) throw new Error("no token returned");

    // remember the tracker we issued (the webhook must present exactly this one)
    await sbInsert("inter_payment_events", {
      provider: "safepay", kind: "checkout_created", tracking_id: orderId,
      tracker, amount, currency: "PKR", outcome: "created",
    });

    const base = siteUrl(req);
    const back = `${base}/admission/application/${applicationId}`;
    const url = safepay.checkout.create({
      token: tracker,
      orderId,
      cancelUrl: `${back}?payment=cancelled`,
      redirectUrl: `${back}?payment=return`,
      webhooks: true,
    });
    return json(res, 200, { ok: true, url });
  } catch (e) {
    console.error("safepay create failed:", e?.message || e);
    return json(res, 502, { ok: false, error: "Could not reach the payment gateway. Please try again in a moment." });
  }
}

// ── kind=webhook ──────────────────────────────────────────────────────────
const PAID_STATES = new Set(["PAID", "SUCCESS", "SUCCEEDED", "COMPLETED", "CAPTURED"]);
const FAILED_STATES = new Set(["FAILED", "DECLINED", "CANCELLED", "CANCELED", "EXPIRED", "REJECTED"]);

function extract(body) {
  const data = body?.data || {};
  const n = data.notification || data;
  const meta = n.metadata || data.metadata || {};
  const tracker = String(n.tracker || data.token || body?.token || "");
  const orderId = String(meta.order_id || n.order_id || data.order_id || "");
  const state = String(n.state || data.state || "").toUpperCase();
  const txn = String(n.reference || n.transaction_id || n.intent_id || "");
  const amount = Number(n.amount ?? data.amount);
  const currency = String(n.currency || data.currency || "PKR").toUpperCase();
  const method = String(n.intent || n.payment_method || n.method || "").toLowerCase();
  return { tracker, orderId, state, txn, amount, currency, method };
}

async function handleWebhook(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false });
  const cfg = safepayEnv();
  if (!safepayReady(cfg) || !sbCfg().ok) {
    console.error("safepay webhook: server environment is not configured");
    return json(res, 503, { ok: false }); // Safepay will retry later
  }

  let body;
  try { body = readBody(req); } catch { return json(res, 400, { ok: false }); }

  // 1 · Signature (HMAC-SHA512 with the webhook secret) — reject anything else.
  let valid = false;
  try {
    valid = new Safepay(cfg).verify.webhook({ body, headers: req.headers });
  } catch { valid = false; }
  if (!valid) {
    console.warn("safepay webhook: INVALID signature rejected", {
      ip: (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim(),
    });
    return json(res, 400, { ok: false, error: "invalid signature" });
  }

  const ev = extract(body);
  const outcome = PAID_STATES.has(ev.state) ? "paid" : FAILED_STATES.has(ev.state) ? "failed" : "ignored";
  if (!ev.orderId || !ev.tracker) {
    console.error("safepay webhook: verified event without orderId/tracker", { state: ev.state });
    return json(res, 200, { ok: true, ignored: true });
  }
  if (outcome === "ignored") {
    return json(res, 200, { ok: true, ignored: true }); // e.g. "TRACKER_STARTED" — nothing to do
  }

  try {
    // 2 · Already handled? (Safepay retries) — the ledger row is written only AFTER a
    //     successful apply, so a transient DB failure is retried instead of lost.
    const eventKey = `${ev.tracker}:${ev.state}`;
    const seen = await sbSelectOne(
      `inter_payment_events?select=id&provider=eq.safepay&event_key=eq.${encodeURIComponent(eventKey)}&limit=1`,
    );
    if (seen) return json(res, 200, { ok: true, duplicate: true });

    // 3 · Apply inside the database (validates tracker + amount + currency, idempotent)
    const result = await sbRpc("inter_safepay_apply", {
      p_tracking_id: ev.orderId,
      p_tracker: ev.tracker,
      p_state: outcome,
      p_txn_id: ev.txn,
      p_amount: Number.isFinite(ev.amount) ? ev.amount : null,
      p_currency: ev.currency,
      p_method: ev.method.includes("wallet") || ev.method.includes("easypaisa") ? "easypaisa_wallet" : ev.method || "safepay",
    });
    if (!result?.ok) {
      // unknown order, tracker/amount mismatch … log loudly but answer 200 (no endless retries)
      console.error("safepay webhook: not applied", { code: result?.code, orderId: ev.orderId, tracker: ev.tracker });
    }

    // 4 · Audit ledger (unique key keeps concurrent duplicates harmless)
    await sbInsert("inter_payment_events", {
      provider: "safepay", kind: "webhook", tracking_id: ev.orderId, tracker: ev.tracker,
      state: ev.state, event_key: eventKey,
      amount: Number.isFinite(ev.amount) ? ev.amount : null, currency: ev.currency,
      outcome: result?.ok ? outcome : `rejected:${result?.code || "unknown"}`,
    }, { ignoreDuplicates: true }).catch((e) => console.warn("safepay webhook: ledger write failed:", e.message));
    return json(res, 200, { ok: true });
  } catch (e) {
    console.error("safepay webhook: processing error:", e?.message || e);
    return json(res, 500, { ok: false }); // transient (DB) — let Safepay retry
  }
}

// ── Entry ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  const kind = String(req.query?.kind || new URL(req.url, "http://x").searchParams.get("kind") || "");
  try {
    if (kind === "config") return await handleConfig(req, res);
    if (kind === "create") return await handleCreate(req, res);
    if (kind === "webhook") return await handleWebhook(req, res);
    return json(res, 404, { ok: false });
  } catch (e) {
    console.error("safepay: unhandled error:", e?.message || e);
    return json(res, 500, { ok: false, error: "Server error." });
  }
}
