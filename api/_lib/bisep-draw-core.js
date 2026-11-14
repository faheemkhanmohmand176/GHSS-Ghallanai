// api/_lib/bisep-draw-core.js — BISE Peshawar Supervisory Draw lookup
// ═══════════════════════════════════════════════════════════════════════════
// NOT a Vercel function (underscore folder = helper only). It is served by
// api/public-data.js via `?kind=draw` and exposed as /api/bisep-draw through a
// vercel.json rewrite, so the project STAYS AT 11 FUNCTIONS (Hobby max = 12).
//
//   /api/bisep-draw?mode=sources                      → draw sessions list
//   /api/bisep-draw?mode=preview&source=theory        → first drawn staff (masked)
//   /api/bisep-draw?source=theory&by=cnic&value=…     → personal lookup
//
// Board: POST https://bisep.edu.pk/DrawSSC2026A2/SearchDraw.php  Search=…&by=3|2
// The board sits behind Cloudflare (TLS-fingerprint scoring), so every call
// uses a transport ladder (fetch → http2 → https), paced retries with jitter,
// and failures are never cached.
// ═══════════════════════════════════════════════════════════════════════════
import http2 from "node:http2";
import https from "node:https";

const HOST = "https://bisep.edu.pk";

const DEFAULT_SOURCES = {
  theory:    { label: "Theory Duties",    session: "SSC Annual-II 2026", dir: "DrawSSC2026A2" },
  practical: { label: "Practical Duties", session: "SSC Annual-II 2026", dir: "DrawSSC2026A2Pract" },
};

function getSources() {
  try {
    const raw = process.env.BISEP_DRAW_SOURCES_JSON;
    if (raw) {
      const j = JSON.parse(raw);
      const out = {};
      for (const [k, v] of Object.entries(j)) {
        if (/^[a-z0-9_-]{1,24}$/i.test(k) && v && /^[A-Za-z0-9_]{3,40}$/.test(v.dir || "")) {
          out[k] = { label: String(v.label || k).slice(0, 40), session: String(v.session || "").slice(0, 60), dir: v.dir };
        }
      }
      if (Object.keys(out).length) return out;
    }
  } catch { /* fall through */ }
  return DEFAULT_SOURCES;
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = (a, b) => a + Math.floor(Math.random() * (b - a));

// ── Input normalisation ─────────────────────────────────────────────────────
export function normaliseQuery(by, value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (by === "cnic") {
    if (digits.length !== 13) return { error: "Enter a valid 13-digit CNIC (e.g. 17301-9088542-1)." };
    return { by: "3", search: digits };
  }
  if (by === "mobile") {
    let d = digits;
    if (d.startsWith("92") && d.length === 12) d = d.slice(2);
    if (d.startsWith("0")) d = d.slice(1);
    if (d.length !== 10 || d[0] !== "3") return { error: "Enter a valid mobile number (e.g. 0301 2345678)." };
    return { by: "2", search: d };
  }
  return { error: "Choose CNIC or Mobile." };
}

/** Board returns 3459162160 (no leading 0) → 0345 9162160 */
export function fmtMobile(m) {
  let d = String(m || "").replace(/\D/g, "");
  if (d.startsWith("92") && d.length === 12) d = d.slice(2);
  if (d.length === 10 && d[0] === "3") d = "0" + d;
  return d.length === 11 ? `${d.slice(0, 4)} ${d.slice(4)}` : String(m || "").trim();
}

export function maskMobile(m) {
  const d = fmtMobile(m).replace(/\D/g, "");
  if (d.length < 8) return "••••";
  return d.slice(0, 4) + " •••• " + d.slice(-3);
}

// ── HTML helpers ────────────────────────────────────────────────────────────
const decode = (s) => s
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const text = (h) => decode(h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const FIELD_MAP = [
  [/center\s*no/i, "centerNo"],
  [/^name/i, "name"],
  [/designation/i, "designation"],
  [/address|institute/i, "institute"],
  [/mobile/i, "mobile"],
  [/appointed/i, "appointedAs"],
];
const mapField = (label) => { for (const [re, k] of FIELD_MAP) if (re.test(label)) return k; return null; };

function findLetters(html) {
  const out = [];
  const re = /href=["']([^"']*PrintLetter(?:Sup|DSup|Invg)\.php\?ID=\d+&(?:amp;)?key=[0-9a-f]{40})["']/gi;
  let m;
  while ((m = re.exec(html))) out.push(decode(m[1]));
  return out;
}
const absLetter = (dir, href) => {
  if (/^https?:/i.test(href)) return href;
  return `${HOST}/${dir}/${href.replace(/^\.?\//, "")}`;
};

// Orientation / instruction notes shown on the board's form page.
function findNotes(html) {
  const out = [];
  const re = /<(?:li|p)[^>]*>([\s\S]*?)<\/(?:li|p)>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < 6) {
    const t = text(m[1]);
    if (t.length > 25 && t.length < 400 && /orientation|workshop|training|report|venue/i.test(t)) out.push(t);
  }
  return out;
}

/** Personal lookup response → { selected, details, letter?, notes } */
export function parseDrawHtml(html, dir) {
  const plain = text(html);
  if (/not selected by the computer/i.test(plain)) return { selected: false, details: {}, notes: findNotes(html) };
  const details = {};
  const rowRe = /<tr[^>]*>\s*<t[dh][^>]*>([\s\S]*?)<\/t[dh]>\s*<t[dh][^>]*>([\s\S]*?)<\/t[dh]>\s*<\/tr>/gi;
  let m;
  while ((m = rowRe.exec(html))) {
    const k = mapField(text(m[1]).replace(/:$/, ""));
    const v = text(m[2]);
    if (k && v && !details[k]) details[k] = k === "mobile" ? fmtMobile(v) : v;
  }
  const letters = findLetters(html);
  const selected = Object.keys(details).length >= 3;
  return {
    selected,
    details,
    letter: selected && letters[0] ? absLetter(dir, letters[0]) : null,
    notes: findNotes(html),
  };
}

/** Bare GET preview → up to 5 staff with masked mobiles */
export function parseDrawListHtml(html, dir) {
  const letters = findLetters(html);
  const blocks = html.split(/(?=Center\s*No)/i).slice(1);
  const out = [];
  blocks.forEach((b, i) => {
    const rec = {};
    const rowRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>\s*<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let m;
    while ((m = rowRe.exec(b))) {
      const k = mapField(text(m[1]).replace(/:$/, ""));
      if (k && !rec[k]) rec[k] = text(m[2]);
    }
    if (!rec.centerNo && !rec.name) return;
    if (rec.mobile) rec.mobile = maskMobile(rec.mobile);
    if (letters[i]) rec.letter = absLetter(dir, letters[i]);
    out.push(rec);
  });
  return out.slice(0, 5);
}

// ── Transport ladder ────────────────────────────────────────────────────────
const isChallenge = (status, body) =>
  status === 403 || status === 429 || status === 503 || /enable javascript and cookies|just a moment|cf-chl/i.test(body.slice(0, 4000));

async function viaFetch(url, method, body, headers, signal) {
  const r = await fetch(url, { method, headers, body, signal, redirect: "follow" });
  return { status: r.status, body: await r.text() };
}
function viaHttp2(url, method, body, headers, signal) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const c = http2.connect(u.origin);
    const done = (fn, v) => { try { c.close(); } catch {} fn(v); };
    c.on("error", (e) => done(reject, e));
    const req = c.request({ ":method": method, ":path": u.pathname + u.search, ":authority": u.host, ...headers });
    let status = 0; const chunks = [];
    req.on("response", (h) => { status = h[":status"]; });
    req.on("data", (d) => chunks.push(d));
    req.on("end", () => done(resolve, { status, body: Buffer.concat(chunks).toString("utf8") }));
    req.on("error", (e) => done(reject, e));
    signal?.addEventListener("abort", () => { try { req.close(); } catch {} done(reject, new Error("timeout")); });
    if (body) req.write(body);
    req.end();
  });
}
function viaHttps(url, method, body, headers, signal) {
  return new Promise((resolve, reject) => {
    const r = https.request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    });
    r.on("error", reject);
    signal?.addEventListener("abort", () => { r.destroy(); reject(new Error("timeout")); });
    if (body) r.write(body);
    r.end();
  });
}
const LADDER = [viaFetch, viaHttp2, viaHttps];

async function boardRequest(dir, method, form) {
  const url = `${HOST}/${dir}/SearchDraw.php`;
  const body = form ? new URLSearchParams(form).toString() : undefined;
  let lastDetail = "unreachable";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(jitter(400, 750) * attempt);
    const headers = {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      referer: `${HOST}/${dir}/`,
      ...(body ? { "content-type": "application/x-www-form-urlencoded", origin: HOST } : {}),
    };
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 3200);
    try {
      const { status, body: html } = await LADDER[attempt % LADDER.length](url, method, body, headers, ac.signal);
      if (isChallenge(status, html)) { lastDetail = "cloudflare-challenge"; continue; }
      if (status >= 200 && status < 300 && html.length > 200) return { html };
      lastDetail = `http-${status}`;
    } catch (e) {
      lastDetail = String(e?.message || "network").slice(0, 60);
    } finally { clearTimeout(t); }
  }
  return { fail: lastDetail };
}

// ── Caches (per warm lambda) + in-flight de-dupe ────────────────────────────
const MEM = new Map();
const INFLIGHT = new Map();
const memGet = (k) => { const e = MEM.get(k); if (e && e.exp > Date.now()) return e.v; MEM.delete(k); return null; };
const memSet = (k, v, ttl) => { if (MEM.size > 300) MEM.clear(); MEM.set(k, { v, exp: Date.now() + ttl }); };
async function once(key, fn) {
  if (INFLIGHT.has(key)) return INFLIGHT.get(key);
  const p = fn().finally(() => INFLIGHT.delete(key));
  INFLIGHT.set(key, p);
  return p;
}

const officialPage = (dir) => `${HOST}/${dir}/`;

/** Returns { status, cache, body } — the caller (public-data.js) writes headers. */
export async function handleDraw(q) {
  const SRC = getSources();
  const mode = q.get("mode") || "";
  const NO = "no-store";
  const OK = "public, max-age=0, s-maxage=600, stale-while-revalidate=120";

  if (mode === "sources") {
    return { status: 200, cache: "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
      body: { ok: true, sources: Object.entries(SRC).map(([id, s]) => ({ id, label: s.label, session: s.session, official_page: officialPage(s.dir) })) } };
  }

  const sid = q.get("source") || "theory";
  const src = SRC[sid];
  if (!src) return { status: 400, cache: NO, body: { ok: false, error: "Unknown draw session." } };

  if (mode === "preview") {
    const key = `pv:${sid}`;
    const hit = memGet(key);
    if (hit) return { status: 200, cache: "public, max-age=0, s-maxage=900, stale-while-revalidate=300", body: { ...hit, cached: true } };
    const r = await once(key, () => boardRequest(src.dir, "GET"));
    if (r.fail) return { status: 200, cache: NO, body: { ok: false, error: "The board is busy right now.", detail: r.fail, official_page: officialPage(src.dir) } };
    const body = { ok: true, source: sid, entries: parseDrawListHtml(r.html, src.dir), fetched_at: new Date().toISOString(), official_page: officialPage(src.dir) };
    memSet(key, body, 30 * 60 * 1000);
    return { status: 200, cache: "public, max-age=0, s-maxage=900, stale-while-revalidate=300", body };
  }

  const n = normaliseQuery(q.get("by"), q.get("value"));
  if (n.error) return { status: 400, cache: NO, body: { ok: false, error: n.error } };

  const key = `lk:${sid}:${n.by}:${n.search}`;
  const hit = memGet(key);
  if (hit) return { status: 200, cache: OK, body: { ...hit, cached: true } };
  const r = await once(key, () => boardRequest(src.dir, "POST", { Search: n.search, by: n.by }));
  if (r.fail) {
    return { status: 200, cache: NO, body: { ok: false, error: "BISE Peshawar's server did not respond. Please try again in a moment, or check on the official page.", detail: r.fail, official_page: officialPage(src.dir) } };
  }
  const parsed = parseDrawHtml(r.html, src.dir);
  const body = { ok: true, source: sid, session: src.session, ...parsed, fetched_at: new Date().toISOString(), official_page: officialPage(src.dir) };
  memSet(key, body, 10 * 60 * 1000);
  return { status: 200, cache: OK, body };
}

export const __internals = { fmtMobile, normaliseQuery, parseDrawHtml, parseDrawListHtml, maskMobile };
