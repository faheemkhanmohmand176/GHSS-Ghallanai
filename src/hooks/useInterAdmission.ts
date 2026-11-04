/**
 * useInterAdmission — shared applicant-session hook for the Inter admission
 * portal. Resolves the session token from localStorage, loads the full
 * session state (applicant + personal + ssc + applications) through the
 * inter_session_state RPC and exposes helpers used by every portal page.
 *
 * ── SLOW-INTERNET FIXES (all verified defects) ──────────────────────────────
 *  1. NETWORK ERROR ≠ EXPIRED SESSION (the big one).
 *     supabase-js returns {error} when the REQUEST never reaches the server
 *     (2G drop, DNS stall, timeout). The old hook treated ANY ok:false the
 *     same: clearToken() + bounce to /admission/login — an applicant who was
 *     mid-application was silently LOGGED OUT by one dropped packet. Now a
 *     network-shaped failure THROWS inside the queryFn, React Query retries
 *     it (network retries only), and if it still fails the pages show a
 *     "check your connection" retry card. Only a REAL server verdict
 *     ({ok:false} that actually came back from the database) signs out.
 *  2. NO TOKEN = NO INFINITE SKELETON.
 *     Landing on /admission/portal with no stored token used to render
 *     skeletons forever (query disabled → loading true forever). It now
 *     redirects to the login page, exactly like an expired session.
 *  3. LOGOUT NO LONGER WIPES THE OFFLINE CACHE.
 *     queryClient.clear() used to delete EVERY cached query — including the
 *     IndexedDB-persisted notices/results/admission data that makes the site
 *     usable offline. Only the applicant's own inter-session entries are
 *     removed now.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  interApi, getToken, clearToken, isAdmissionNetworkError, SessionState,
} from "@/lib/interAdmission";
import { ADMISSION_CLIENT_CACHE } from "@/config/admissionCache";

/** Thrown (and retried) only when the session call failed for NETWORK
 *  reasons. A real "Session expired" answer is returned as data instead. */
class SessionNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionNetworkError";
  }
}

export function useInterSession(options: { require?: boolean } = {}) {
  const { require: requireSession = true } = options;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // localStorage is synchronous — read once at first render so the very first
  // pass already knows whether a session exists (no skeleton flash, and the
  // no-token redirect below can fire immediately).
  const [token, setTokenState] = useState<string | null>(() => getToken());

  // Sign-out / sign-in from another tab is reflected on focus.
  useEffect(() => {
    const sync = () => setTokenState(getToken());
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, []);

  const q = useQuery<SessionState>({
    queryKey: ["inter-session", token],
    queryFn: async () => {
      if (!token) return { ok: false, error: "No session." };
      const res = (await interApi.sessionState(token)) as unknown as SessionState;
      // Network failure → throw, so React Query retries it and the pages can
      // offer a retry card. NEVER treated as "session expired".
      if (isAdmissionNetworkError(res)) {
        throw new SessionNetworkError(res.error || "Network error. Please check your connection.");
      }
      return res;
    },
    enabled: Boolean(token),
    // Only network failures retry (they throw). A server verdict never does.
    retry: (failureCount, error) => {
      if (!(error instanceof SessionNetworkError)) return false;
      return failureCount < ADMISSION_CLIENT_CACHE.sessionNetworkRetries;
    },
    retryDelay: (attempt) =>
      Math.min(ADMISSION_CLIENT_CACHE.sessionRetryDelayMs * 2 ** attempt, 8000),
    staleTime: 30 * 1000,
  });

  // No stored token on a page that requires a session → straight to login
  // (was: skeletons forever, because the disabled query never finishes).
  useEffect(() => {
    if (requireSession && token === null) {
      navigate("/admission/login", { replace: true });
    }
  }, [requireSession, token, navigate]);

  // Session expired / invalid → clear token and bounce to login.
  // q.data with ok:false can now ONLY be a real server verdict (network
  // failures throw instead of resolving), but the belt-and-braces network
  // check below keeps this safe even if a future error string slips through.
  useEffect(() => {
    if (
      requireSession &&
      token &&
      q.data &&
      q.data.ok === false &&
      !isAdmissionNetworkError(q.data)
    ) {
      clearToken();
      navigate("/admission/login", { replace: true });
    }
  }, [q.data, token, requireSession, navigate]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["inter-session", token] });
  }, [queryClient, token]);

  const logout = useCallback(async () => {
    if (token) {
      try { await interApi.logout(token); } catch { /* best-effort */ }
    }
    clearToken();
    // Scoped removal: the applicant's own session data only. The shared
    // offline cache (notices, results, admission settings…) must survive a
    // logout so the public site keeps working on a slow connection.
    queryClient.removeQueries({ queryKey: ["inter-session"] });
    navigate("/admission/login", { replace: true });
  }, [token, queryClient, navigate]);

  return {
    token,
    session: q.data,
    loading: !token || q.isLoading,
    /** True when the session could not be loaded because of the NETWORK
     *  (after retries). Pages render a retry card instead of empty data. */
    netError: q.isError,
    expired: Boolean(token && q.data && q.data.ok === false),
    refresh,
    logout,
  };
}
