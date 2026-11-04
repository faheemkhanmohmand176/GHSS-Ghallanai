import { ReactNode, useRef } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
 *
 * (Two-step / authenticator-app MFA has been removed.)
 *
 * THE LATCH (admitted.current): once the guard has let the dashboard in, it
 * never takes it away because auth is merely SLOW or INCOMPLETE. It only
 * removes the children on two definite answers: genuinely signed out, or a
 * successfully-loaded profile that says "not an admin".
 */
const AdminProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user, profile, loading, hasCachedSession, sessionPending } = useAuth();
  const admitted = useRef(false);

  const definitelySignedOut = !user && !loading && !sessionPending;
  const definitelyNotAdmin = !!profile && profile.role !== "admin";

  if (admitted.current) {
    if (definitelySignedOut) return <Navigate to="/auth/signin" replace />;
    if (definitelyNotAdmin) return <Navigate to="/" replace />;
    return <>{children}</>;
  }

  // First entry — a cached session lets us wait for the profile to load.
  if ((loading || sessionPending) && hasCachedSession) {
    if (profile && profile.role !== "admin") return <Navigate to="/" replace />;
    return <Spinner />;
  }

  if (loading) return <Spinner />;

  if (!user) {
    if (sessionPending) return <Spinner />;
    return <Navigate to="/auth/signin" replace />;
  }

  if (!profile) return <Spinner />;

  if (profile.role !== "admin") return <Navigate to="/" replace />;

  admitted.current = true;
  return <>{children}</>;
};

export default AdminProtectedRoute;
