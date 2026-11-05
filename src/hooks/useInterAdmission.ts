/**
 * useInterAdmission — shared applicant hook for the Inter admission portal.
 *
 * NO ACCOUNTS, NO LOGIN.  The hook runs in one of two modes:
 *
 *   • DRAFT mode (no token) — the applicant is filling the form.  Everything
 *     lives on their device (lib/admissionDraft.ts); the database is not
 *     touched.  `session` is built from the draft and has the same shape as a
 *     server session, so every page renders it unchanged.  `isDraft` is true.
 *
 *   • SERVER mode (token present) — set after the final Submit (or after
 *     "Track Application" opens an existing application).  The session is
 *     loaded through inter_session_state exactly as before, so Pay / Edit /
 *     View keep working.
 *
 * SLOW-INTERNET HARDENING (kept from the previous version):
 *   • A network failure is never treated as an expired session — it throws
 *     inside the queryFn, React Query retries it, and pages show a retry card.
 *   • Sign-out only removes the applicant's own session queries, never the
 *     shared offline cache.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  interApi, getToken, clearToken, isAdmissionNetworkError, SessionState, TOKEN_EVENT,
} from "@/lib/interAdmission";
import { getDraft, clearDraft, draftToSession, DRAFT_EVENT, AdmissionDraft } from "@/lib/admissionDraft";
import { ADMISSION_CLIENT_CACHE } from "@/config/admissionCache";

/** Thrown (and retried) only when the session call failed for NETWORK
 *  reasons. A real "Session expired" answer is returned as data instead. */
class SessionNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionNetworkError";
  }
}

export function useInterSession(options: { requireToken?: boolean } = {}) {
  const { requireToken = false } = options;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [draft, setDraftState] = useState<AdmissionDraft>(() => getDraft());

  // Token / draft changes (this tab, other tabs, focus) are reflected at once.
  useEffect(() => {
    const syncToken = () => setTokenState(getToken());
    const syncDraft = () => setDraftState(getDraft());
    window.addEventListener("focus", syncToken);
    window.addEventListener("storage", syncToken);
    window.addEventListener(TOKEN_EVENT, syncToken);
    window.addEventListener(DRAFT_EVENT, syncDraft);
    return () => {
      window.removeEventListener("focus", syncToken);
      window.removeEventListener("storage", syncToken);
      window.removeEventListener(TOKEN_EVENT, syncToken);
      window.removeEventListener(DRAFT_EVENT, syncDraft);
    };
  }, []);

  const q = useQuery<SessionState>({
    queryKey: ["inter-session", token],
    queryFn: async () => {
      if (!token) return { ok: false, error: "No session." };
      const res = (await interApi.sessionState(token)) as unknown as SessionState;
      if (isAdmissionNetworkError(res)) {
        throw new SessionNetworkError(res.error || "Network error. Please check your connection.");
      }
      return res;
    },
    enabled: Boolean(token),
    retry: (failureCount, error) => {
      if (!(error instanceof SessionNetworkError)) return false;
      return failureCount < ADMISSION_CLIENT_CACHE.sessionNetworkRetries;
    },
    retryDelay: (attempt) =>
      Math.min(ADMISSION_CLIENT_CACHE.sessionRetryDelayMs * 2 ** attempt, 8000),
    staleTime: 30 * 1000,
  });

  // Pages that only make sense for an already-submitted application
  // (view / pay / edit) send a visitor with no session to "Track Application".
  useEffect(() => {
    if (requireToken && token === null) {
      navigate("/admission#track", { replace: true });
    }
  }, [requireToken, token, navigate]);

  // A REAL server verdict that the session is invalid (expired after 7/30
  // days): drop the token.  The applicant is simply back in draft mode — there
  // is no login page to bounce to.
  useEffect(() => {
    if (token && q.data && q.data.ok === false && !isAdmissionNetworkError(q.data)) {
      clearToken();
      if (requireToken) navigate("/admission#track", { replace: true });
    }
  }, [q.data, token, requireToken, navigate]);

  const refresh = useCallback(() => {
    if (token) queryClient.invalidateQueries({ queryKey: ["inter-session", token] });
    else setDraftState(getDraft());
  }, [queryClient, token]);

  /** End the private session on this device (server mode). */
  const logout = useCallback(async () => {
    if (token) {
      try { await interApi.logout(token); } catch { /* best-effort */ }
    }
    clearToken();
    queryClient.removeQueries({ queryKey: ["inter-session"] });
    navigate("/admission", { replace: true });
  }, [token, queryClient, navigate]);

  /** Throw away the on-device draft (draft mode). */
  const discardDraft = useCallback(() => {
    clearDraft();
    setDraftState(getDraft());
  }, []);

  const draftSession = useMemo(() => draftToSession(draft), [draft]);
  const isDraft = !token;

  return {
    token,
    isDraft,
    draft,
    session: isDraft ? draftSession : q.data,
    loading: isDraft ? false : q.isLoading,
    /** True when the session could not be loaded because of the NETWORK
     *  (after retries). Pages render a retry card instead of empty data. */
    netError: isDraft ? false : q.isError,
    expired: Boolean(token && q.data && q.data.ok === false),
    refresh,
    logout,
    discardDraft,
  };
}
