/**
 * authGateway — browser-side wrapper for the Vercel auth-gateway function.
 *
 * The browser no longer calls inter_apply / inter_track or
 * supabase.auth.signInWithPassword / resetPasswordForEmail directly.  Instead
 * it POSTs to /api/auth-gateway?action=<action> with the form fields + a
 * Turnstile token.  The gateway verifies the Turnstile token server-side,
 * applies IP rate limits, then calls the (anon-revoked) Supabase RPC or the
 * Supabase Auth admin API with the service role.
 *
 * Admission has NO accounts or logins any more: the applicant's data stays on
 * their device until the final captcha-verified "apply" call (migration 26).
 *
 * This is the ONLY safe path: because anon EXECUTE is revoked on
 * inter_apply / inter_track, a browser that bypasses the
 * Turnstile widget (or a bot) still cannot reach those RPCs — the gateway
 * refuses it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE NOW RETRIES  (the "Failed to fetch" sign-in bug)
 * ─────────────────────────────────────────────────────────────────────────────
 * The symptom was: "Request failed after 1s (TypeError: Failed to fetch).
 * Request size 1 KB. The server is NOT reachable from this device right now."
 * …and the user could not sign in at all, no matter how often they retried.
 *
 * "TypeError: Failed to fetch" is the browser's message for a request that
 * never produced an HTTP response — the connection was dropped, the DNS
 * lookup failed, or a proxy on the path killed it. It is NOT an error the
 * server sends; the server was answering normally the whole time (verified:
 * the live endpoint returns 405 for GET and a clean JSON body for POST).
 *
 * Three things made this a hard failure instead of a hiccup:
 *
 *   1. THE APP TRIED EXACTLY ONCE. A single dropped request on a mobile
 *      network (Wi-Fi → 4G handover, a brief signal drop, a carrier proxy
 *      resetting an idle connection) ended the attempt. The project's own
 *      service worker already solves this for asset requests — see
 *      networkFirstAsset() in public/sw.js, whose comment says: "mobile
 *      networks (switching WiFi <-> 4G, brief signal drops) frequently cause
 *      a SINGLE fetch attempt to fail with a generic TypeError even though
 *      the network is fine a moment later." The auth gateway did not get the
 *      same treatment — that inconsistency is the bug.
 *
 *   2. THE ERROR MESSAGE WAS WRONG. The old code probed the endpoint with a
 *      GET and, if that probe ALSO failed, concluded "The server is NOT
 *      reachable from this device right now." On a flaky network the probe
 *      fails for the very same reason the POST failed, so the message blamed
 *      the server (or the site owner) for what was a local network problem.
 *      It also could not tell the two cases apart, so there was nothing
 *      actionable in it.
 *
 *   3. THE TURNSTILE TOKEN IS SINGLE-USE. Cloudflare consumes the token on
 *      the first successful siteverify. So a blind retry with the same token
 *      can turn a transient network blip into "Captcha check failed", which
 *      is a confusing dead end. The retry below therefore probes liveness
 *      FIRST: if the function answers a GET, the POST was dropped in transit
 *      and the token was never consumed, so retrying is safe. If the probe
 *      also fails, the device has no route to the function at all — we stop
 *      and say exactly that instead of burning the token.
 *
 * The result carries `unreachable: true` when no HTTP answer was ever
 * received, which lets the sign-in page fall back to a direct Supabase Auth
 * call (a completely different host, so it can still succeed when the
 * gateway path is blocked) instead of leaving the user locked out.
 *
 * SLOW-INTERNET HARDENING: every call still carries a hard timeout
 * (ADMISSION_CLIENT_CACHE.gatewayTimeoutMs).
 */

import { ADMISSION_CLIENT_CACHE } from "@/config/admissionCache";

export interface GatewayResult {
  ok?: boolean;
  error?: string;
  token?: string;
  /**
   * True when the request never received an HTTP response at all (the
   * connection was dropped / DNS failed / a proxy killed it). The server was
   * never able to answer, so no captcha token was consumed and no attempt
   * was recorded server-side.
   */
  unreachable?: boolean;
  [key: string]: unknown;
}

/** Total attempts (1 initial + retries) for a transport-level failure. */
const MAX_ATTEMPTS = 3;
/** Backoff before attempt 2 and attempt 3 (ms). */
const RETRY_BACKOFF_MS = [700, 2000];
/** Liveness probe budget (ms). A GET answers 405 almost instantly. */
const PROBE_TIMEOUT_MS = 6000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Cheap liveness probe. A GET to the gateway answers 405 + JSON immediately
 * when the function is alive, and never touches the captcha token.
 */
async function probeGateway(action: string): Promise<{ ok: boolean; ms: number; status?: number }> {
  const started = Date.now();
  try {
    const p = await fetch(`/api/auth-gateway?action=${action}`, {
      method: "GET",
      // Never let a cached response (or a cached network failure) decide
      // whether the server is alive.
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    return { ok: true, ms: Date.now() - started, status: p.status };
  } catch {
    return { ok: false, ms: Date.now() - started };
  }
}

function isOffline(): boolean {
  try {
    return typeof navigator !== "undefined" && navigator.onLine === false;
  } catch {
    return false;
  }
}

async function postAction(action: string, payload: Record<string, unknown>): Promise<GatewayResult> {
  const started = Date.now();
  const bodyText = JSON.stringify(payload);
  let lastFailure = "";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_BACKOFF_MS[Math.min(attempt - 1, RETRY_BACKOFF_MS.length - 1)]);
    }

    try {
      const res = await fetch(`/api/auth-gateway?action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: bodyText,
        cache: "no-store",
        signal: AbortSignal.timeout(ADMISSION_CLIENT_CACHE.gatewayTimeoutMs),
      });
      const text = await res.text();
      try {
        return JSON.parse(text) as GatewayResult;
      } catch {
        // Server answered but not with JSON (e.g. a Vercel crash page).
        return {
          ok: false,
          error: `Server error (HTTP ${res.status}). ${text.replace(/<[^>]+>/g, " ").trim().slice(0, 120)}`,
        };
      }
    } catch (e) {
      const name = e instanceof Error ? e.name : "Error";
      const msg = e instanceof Error ? e.message : String(e);
      lastFailure = `${name}: ${msg}`;

      // A client-side timeout means the request MAY have reached the server
      // (and consumed the captcha token). Do not retry it blindly.
      if (name === "TimeoutError" || name === "AbortError") {
        const secs = Math.round((Date.now() - started) / 1000);
        return {
          ok: false,
          unreachable: true,
          error:
            `The server did not answer within ${secs}s. Check your connection and try again.`,
        };
      }

      // Transport failure (no HTTP answer). Probe before retrying:
      //  • probe OK  → the function is alive, the POST was dropped in
      //    transit, the captcha token was NOT consumed → safe to retry.
      //  • probe fail → this device has no route to the function right now
      //    → retrying cannot help and would only waste the token.
      const probe = await probeGateway(action);
      if (!probe.ok) {
        const secs = Math.round((Date.now() - started) / 1000);
        return {
          ok: false,
          unreachable: true,
          error: isOffline()
            ? "You appear to be offline. Turn on mobile data or reconnect to Wi-Fi, then try again."
            : `Could not reach the server from this device (${lastFailure}) after ${secs}s. ` +
              `The network between you and the site is dropping the request — try again on a ` +
              `different connection (mobile data instead of Wi-Fi) or after the signal improves.`,
        };
      }
      // Server is alive → fall through to the next attempt.
    }
  }

  const secs = Math.round((Date.now() - started) / 1000);
  return {
    ok: false,
    unreachable: true,
    error:
      `The server is reachable, but the request was dropped ${MAX_ATTEMPTS} times (${lastFailure}). ` +
      `Something between you and the site (a proxy, carrier filter or network filter) is blocking ` +
      `this request. Try a different connection, or use the direct sign-in.`,
  };
}

export const authGateway = {
  /** Final submit — ONE atomic write of applicant + profiles + application
   *  (inter_apply via gateway, Turnstile verified). */
  apply: (p: {
    nationality: string; cnic: string;
    personal: Record<string, unknown>; ssc: Record<string, unknown>;
    programId: number; quota: string; criteria: Record<string, unknown>;
    subjectGroup: string | null; turnstile: string;
  }) => postAction("apply", p),

  /** Main-site password reset (Supabase Auth admin via gateway). */
  reset: (p: { email: string; turnstile: string }) =>
    postAction("reset", p),

  /** Main-site sign in (Supabase Auth signInWithPassword via gateway). */
  signIn: (p: { email: string; password: string; turnstile: string }) =>
    postAction("signin", p),
};
