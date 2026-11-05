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
  try {
    const res = await fetch(`/api/auth-gateway?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(ADMISSION_CLIENT_CACHE.gatewayTimeoutMs),
    });
    const data = await res.json().catch(() => ({ ok: false, error: "Gateway returned invalid JSON." }));
    return data as GatewayResult;
  } catch {
    return { ok: false, error: "Network error. Please check your connection and try again." };
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
