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
 * SLOW-INTERNET HARDENING: every call now carries a hard timeout
 * (ADMISSION_CLIENT_CACHE.gatewayTimeoutMs). A cold serverless instance on a
 * 2G link used to leave the Register / Login / Track button spinning forever;
 * now it fails at the cap with the friendly "check your connection" message.
 */

import { ADMISSION_CLIENT_CACHE } from "@/config/admissionCache";

export interface GatewayResult {
  ok?: boolean;
  error?: string;
  token?: string;
  [key: string]: unknown;
}

async function postAction(action: string, payload: Record<string, unknown>): Promise<GatewayResult> {
  const started = Date.now();
  try {
    const res = await fetch(`/api/auth-gateway?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(ADMISSION_CLIENT_CACHE.gatewayTimeoutMs),
    });
    const text = await res.text();
    try {
      return JSON.parse(text) as GatewayResult;
    } catch {
      // Server answered but not with JSON (e.g. Vercel crash page). Show the real status.
      return {
        ok: false,
        error: `Server error (HTTP ${res.status}). ${text.replace(/<[^>]+>/g, " ").trim().slice(0, 120)}`,
      };
    }
  } catch (e) {
    const secs = Math.round((Date.now() - started) / 1000);
    const name = e instanceof Error ? e.name : "Error";
    const msg = e instanceof Error ? e.message : String(e);
    if (name === "TimeoutError" || name === "AbortError") {
      return { ok: false, error: `Server did not answer within ${secs}s (timeout). Check Vercel function logs for /api/auth-gateway.` };
    }
    return { ok: false, error: `Request could not reach the server after ${secs}s (${name}: ${msg}).` };
  }
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
