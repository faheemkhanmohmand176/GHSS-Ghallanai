import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, Lock, GraduationCap, ArrowRight, Loader2, Clock, XCircle } from "lucide-react";
import { supabase, signOutSafely } from "@/lib/supabase";
import { authGateway } from "@/lib/authGateway";
import Turnstile from "@/components/shared/Turnstile";
import toast from "react-hot-toast";
import { useSchoolSettings, safeMediaUrl } from "@/hooks/useSchoolSettings";

// Hard timeout wrapper — rejects if promise doesn't settle in time
function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    ),
  ]);
}

const SignIn = () => {
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [loading, setLoading]         = useState(false);
  const [logoFailed, setLogoFailed]   = useState(false);
  const [pendingStatus, setPendingStatus] = useState<"pending" | "rejected" | null>(null);
  const navigate = useNavigate();

  const { data: settings } = useSchoolSettings();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnstileToken) { toast.error("Please complete the security check."); return; }
    setLoading(true);
    setPendingStatus(null);

    try {
      // ── 1. Authenticate via the auth-gateway (Turnstile verified server-side)
      //    The gateway calls supabase.auth.signInWithPassword with the service
      //    role after verifying the Turnstile token, then returns the session
      //    tokens.  We establish the session locally with setSession().
      const gw = await authGateway.signIn({ email, password, turnstile: turnstileToken });
      if (!gw.ok || !gw.access_token) {
        toast.error(gw.error || "Login failed.");
        setTurnstileToken("");
        setLoading(false);
        return;
      }

      const { error: setErr } = await supabase.auth.setSession({
        access_token: gw.access_token as string,
        refresh_token: gw.refresh_token as string,
      });
      if (setErr) {
        toast.error(setErr.message || "Could not establish session.");
        setTurnstileToken("");
        setLoading(false);
        return;
      }

      const userId = (gw.user as { id?: string } | undefined)?.id;

      // ── 2. Fetch profile to check approval status (6s timeout each) ───────
      let profile: { role?: string; status?: string } | null = null;

      try {
        // Try RPC first
        const { data: rpcData, error: rpcError } = await withTimeout(
          supabase.rpc("get_my_profile"),
          6000
        );

        if (!rpcError && rpcData) {
          profile = rpcData;
        } else {
          // Fallback to direct table query
          const { data: directData } = await withTimeout(
            supabase
              .from("profiles")
              .select("role, status")
              .eq("id", userId || "")
              .maybeSingle(),
            6000
          );
          profile = directData ?? null;
        }
      } catch {
        await signOutSafely();
        toast.error("Server is slow. Please try again in a moment.");
        setLoading(false);
        return;
      }

      if (!profile) {
        await signOutSafely();
        toast.error("No account found for this email. Please sign up first.");
        setLoading(false);
        return;
      }

      const status = profile?.status ?? "pending";
      const role   = profile?.role;

      if (status === "pending") {
        await signOutSafely();
        setPendingStatus("pending");
        setLoading(false);
        return;
      }

      if (status === "rejected") {
        await signOutSafely();
        setPendingStatus("rejected");
        setLoading(false);
        return;
      }

      // ── 3. Admin → straight to the dashboard (no 2-step / authenticator).
      if (role === "admin") {
        try { await supabase.rpc("log_admin_action", { p_action: "admin.login", p_target_type: "auth", p_summary: "Admin signed in" }); } catch { /* ignore */ }
        navigate("/admin", { replace: true });
        setLoading(false);
        return;
      }

      // Non-admin → home
      toast.success("Signed in successfully!");
      setLoading(false);
      navigate("/", { replace: true });

    } catch (err) {
      const isTimeout = err instanceof Error && err.message === "Request timed out";
      toast.error(
        isTimeout
          ? "Sign in is taking too long. Check your connection and try again."
          : "An unexpected error occurred. Please try again."
      );
      setTurnstileToken("");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute bottom-20 -left-20 w-80 h-80 rounded-full bg-white/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-card rounded-2xl shadow-elevated p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl gradient-hero mx-auto mb-4 flex items-center justify-center overflow-hidden">
              {settings?.logo_url && !logoFailed ? (
                <img
                  src={safeMediaUrl(settings.logo_url)!}
                  alt={`${settings?.school_name || "GHSS Ghallanai"} logo`}
                  className="w-full h-full object-cover"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <GraduationCap className="w-8 h-8 text-on-hero" />
              )}
            </div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Welcome Back</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to your {settings?.school_name || "GHSS Ghallanai"} account
            </p>
          </div>

          {pendingStatus === "pending" && (
            <div className="mb-6 p-4 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-center">
              <Clock className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-400">Waiting for Admin Approval</p>
              <p className="text-xs text-blue-700 dark:text-blue-400/80 mt-1">
                Your account is under review. You'll be able to login once an administrator approves your account.
              </p>
            </div>
          )}

          {pendingStatus === "rejected" && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-center">
              <XCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Account Rejected</p>
              <p className="text-xs text-red-600 dark:text-red-400/80 mt-1">
                Your account request was rejected by the administrator. Please contact the school for more information.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-ring outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-foreground">Password</label>
                <Link to="/auth/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-ring outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !turnstileToken}
              className="w-full gradient-accent text-primary-foreground font-semibold py-3 rounded-xl shadow-card hover:shadow-elevated transition-all flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {loading ? "Signing in..." : "Sign In"}
            </button>

            <div className="flex justify-center pt-1">
              <Turnstile onToken={setTurnstileToken} onExpire={() => setTurnstileToken("")} />
            </div>
          </form>

        </div>
      </motion.div>
    </div>
  );
};

export default SignIn;

