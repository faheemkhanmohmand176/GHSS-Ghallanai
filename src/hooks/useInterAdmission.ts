/**
 * useInterAdmission — shared applicant-session hook for the Inter admission
 * portal. Resolves the session token from localStorage, loads the full
 * session state (applicant + personal + ssc + applications) through the
 * inter_session_state RPC and exposes helpers used by every portal page.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  interApi, getToken, clearToken, SessionState,
} from "@/lib/interAdmission";

export function useInterSession(options: { require?: boolean } = {}) {
  const { require: requireSession = true } = options;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | null>(null);

  useEffect(() => {
    setTokenState(getToken());
  }, []);

  const q = useQuery<SessionState>({
    queryKey: ["inter-session", token],
    queryFn: async () => {
      if (!token) return { ok: false, error: "No session." };
      return (await interApi.sessionState(token)) as unknown as SessionState;
    },
    enabled: Boolean(token),
    retry: false,
    staleTime: 30 * 1000,
  });

  // Session expired / invalid → clear token and bounce to login
  useEffect(() => {
    if (requireSession && token && q.data && q.data.ok === false) {
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
    queryClient.clear();
    navigate("/admission/login", { replace: true });
  }, [token, queryClient, navigate]);

  return {
    token,
    session: q.data,
    loading: !token || q.isLoading,
    expired: Boolean(token && q.data && q.data.ok === false),
    refresh,
    logout,
  };
}
