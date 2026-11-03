/**
 * authGateway — browser-side wrapper for the Vercel auth-gateway function.
 *
 * The browser no longer calls inter_register / inter_login / inter_track or
 * supabase.auth.signInWithPassword / resetPasswordForEmail directly.  Instead
 * it POSTs to /api/auth-gateway?action=<action> with the form fields + a
 * Turnstile token.  The gateway verifies the Turnstile token server-side,
 * applies IP rate limits, then calls the (anon-revoked) Supabase RPC or the
 * Supabase Auth admin API with the service role.
 *
 * This is the ONLY safe path: because migration 24 REVOKEs anon EXECUTE on
 * inter_register / inter_login / inter_track, a browser that bypasses the
 * Turnstile widget (or a bot) still cannot reach those RPCs — the gateway
 * refuses it.
 */

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
    });
    const data = await res.json().catch(() => ({ ok: false, error: "Gateway returned invalid JSON." }));
    return data as GatewayResult;
  } catch {
    return { ok: false, error: "Network error. Please check your connection and try again." };
  }
}

export const authGateway = {
  /** Admission applicant registration (inter_register via gateway). */
  register: (p: { nationality: string; cnic: string; mobile: string; password: string; turnstile: string }) =>
    postAction("register", p),

  /** Admission applicant login (inter_login via gateway). */
  login: (p: { loginId: string; password: string; turnstile: string }) =>
    postAction("login", p),

  /** Public application tracking (inter_track via gateway, with 2nd factor). */
  track: (p: { trackingId: string; secondFactor: string; turnstile: string }) =>
    postAction("track", p),

  /** Main-site password reset (Supabase Auth admin via gateway). */
  reset: (p: { email: string; turnstile: string }) =>
    postAction("reset", p),

  /** Main-site sign in (Supabase Auth signInWithPassword via gateway). */
  signIn: (p: { email: string; password: string; turnstile: string }) =>
    postAction("signin", p),
};
