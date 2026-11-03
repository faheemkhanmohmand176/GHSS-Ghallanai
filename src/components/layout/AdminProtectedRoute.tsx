import { ReactNode, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

/**
 * AdminProtectedRoute — gates the entire /admin tree.
 *
 *  1. Must be signed in (Supabase Auth session present).
 *  2. Profile must exist and role === 'admin'.
 *  3. MFA: the session must be at assurance level aal2. If it is only aal1
 *     (password verified but no TOTP yet), the admin is redirected to
 *     /auth/mfa-verify to complete the second step. If no TOTP factor is
 *     enrolled at all, they are redirected to /auth/mfa-enroll.
 *
 * THE LATCH (admitted.current): once the guard has let the dashboard in, it
 * never takes it away because auth is merely SLOW or INCOMPLETE — this is the
 * documented fix for the "whole page refreshed while I was editing" bug. It
 * only removes the children on two definite answers: genuinely signed out, or
 * a successfully-loaded profile that says "not an admin".
 */
const AdminProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, profile, loading, hasCachedSession, sessionPending } = useAuth();
  const navigate = useNavigate();
  const admitted = useRef(false);
  const [aal, setAal] = useState<"aal2" | "aal1" | "unknown" | "checking">("checking");

  // Check MFA assurance level once we have a confirmed admin session.
  useEffect(() => {
    if (!user || profile?.role !== "admin") return;
    if (admitted.current) return; // already past the gate
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        if (cancelled) return;
        if (error) { setAal("unknown"); return; }
        if (data.currentLevel === "aal2") {
          setAal("aal2");
        } else {
          // aal1 — need the second step. But first check whether ANY factor is
          // enrolled; if not, send to enrollment instead of verify.
          try {
            const { data: fac } = await supabase.auth.mfa.listFactors();
            const has = (fac?.factors ?? []).some((f) => f.factorType === "totp" && f.status === "verified");
            setAal("aal1");
            navigate(has ? "/auth/mfa-verify" : "/auth/mfa-enroll", { replace: true });
          } catch {
            setAal("aal1");
            navigate("/auth/mfa-verify", { replace: true });
          }
        }
      } catch {
        if (!cancelled) setAal("unknown");
      }
    })();
    return () => { cancelled = true; };
  }, [user, profile, navigate]);

  const definitelySignedOut = !user && !loading && !sessionPending;
  const definitelyNotAdmin = !!profile && profile.role !== "admin";

  if (admitted.current) {
    if (definitelySignedOut) return <Navigate to="/auth/signin" replace />;
    if (definitelyNotAdmin) return <Navigate to="/" replace />;
    return <>{children}</>;
  }

  // First entry — a cached session lets us draw the shell while the network
  // round trip + MFA check finish.
  if ((loading || sessionPending || aal === "checking") && hasCachedSession) {
    if (profile && profile.role !== "admin") return <Navigate to="/" replace />;
    // Don't admit yet — wait for the aal2 confirmation from the effect above.
    return <Spinner />;
  }

  if (loading) return <Spinner />;

  if (!user) {
    if (sessionPending) return <Spinner />;
    return <Navigate to="/auth/signin" replace />;
  }

  if (!profile) return <Spinner />;

  if (profile.role !== "admin") return <Navigate to="/" replace />;

  // Admin confirmed — now the MFA gate
  if (aal === "aal2") {
    admitted.current = true;
    return <>{children}</>;
  }
  if (aal === "aal1") {
    // The effect already navigated to mfa-verify / mfa-enroll.
    return <Spinner />;
  }
  // unknown / checking — keep waiting briefly
  return <Spinner />;
};

export default AdminProtectedRoute;
