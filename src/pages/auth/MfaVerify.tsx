/**
 * MfaVerify — the second step of admin login.
 *
 * After the admin enters email + password on /auth/signin, the route guard
 * sends them here if their session is only aal1.  They enter a 6-digit TOTP
 * code (or a recovery code) to raise the session to aal2, which
 * AdminProtectedRoute requires before it lets them into /admin.
 *
 * RECOVERY: if the admin loses their phone, they can use one of the recovery
 * codes shown at enrollment time.  If those are also lost, another admin
 * (or Supabase support / the Supabase dashboard) can remove the MFA factor.
 */

import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2, KeyRound } from "lucide-react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { useSchoolSettings, safeMediaUrl } from "@/hooks/useSchoolSettings";

export default function MfaVerify() {
  const navigate = useNavigate();
  const { data: settings } = useSchoolSettings();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [factorType, setFactorType] = useState<"totp" | "recovery">("totp");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [noFactor, setNoFactor] = useState(false);

  // Find the verified TOTP factor for the current session
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (error) {
        // If we can't list factors, the admin may not be signed in at all
        navigate("/auth/signin", { replace: true });
        return;
      }
      // supabase-js ≥2.100 groups factors as { all, totp, phone, webauthn,
      // recovery_code }. The old flat `factors` array no longer exists — it
      // was ALWAYS undefined at runtime, which made this page show "MFA not
      // set up" for admins who HAD enrolled (a lockout loop between this
      // page and /auth/mfa-enroll). `totp` holds the VERIFIED TOTP factors.
      const all = data?.all ?? [];
      const totp = data?.totp?.[0] ?? all.find((f) => f.factor_type === "totp" && f.status === "verified");
      if (!totp) {
        setNoFactor(true);
        return;
      }
      setFactorId(totp.id);
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    const c = code.trim();
    if (!c) { toast.error("Enter your code."); return; }
    setBusy(true);
    try {
      if (factorType === "totp") {
        const six = c.replace(/\D/g, "").slice(0, 6);
        if (six.length !== 6) { toast.error("Enter the 6-digit code."); setBusy(false); return; }
        const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
        if (chErr || !ch?.id) { toast.error(chErr?.message || "Could not create challenge."); setBusy(false); return; }
        const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: six });
        if (vErr) { toast.error(vErr.message || "Wrong code. Try again."); setBusy(false); return; }
      } else {
        // Recovery code path — challenge + verify with the recovery code
        const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
        if (chErr || !ch?.id) { toast.error(chErr?.message || "Could not create challenge."); setBusy(false); return; }
        const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: c });
        if (vErr) { toast.error(vErr.message || "Invalid recovery code."); setBusy(false); return; }
        toast.success("Recovery code used. Please re-enroll MFA soon — that code is now spent.");
      }
      // aal2 achieved → go to admin
      navigate("/admin", { replace: true });
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (noFactor) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl shadow-elevated p-7 text-center max-w-md">
          <ShieldCheck className="w-10 h-10 mx-auto text-amber-500" />
          <h1 className="text-xl font-heading font-bold text-foreground mt-2">MFA not set up</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-4">You need to enrol an authenticator before you can open the Admin Dashboard.</p>
          <button onClick={() => navigate("/auth/mfa-enroll", { replace: true })} className="w-full h-11 rounded-xl gradient-accent text-primary-foreground font-semibold">
            Set up now
          </button>
          <Link to="/auth/signin" className="block mt-3 text-sm text-muted-foreground hover:text-foreground">← Back to Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
        <div className="bg-card rounded-2xl shadow-elevated p-7">
          <div className="text-center mb-5">
            <div className="w-12 h-12 rounded-2xl gradient-hero mx-auto mb-3 flex items-center justify-center overflow-hidden">
              {settings?.logo_url ? (
                <img src={safeMediaUrl(settings.logo_url)!} alt="logo" className="w-full h-full object-cover" />
              ) : <ShieldCheck className="w-6 h-6 text-on-hero" />}
            </div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Two-step verification</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {factorType === "totp"
                ? "Enter the 6-digit code from your authenticator app."
                : "Enter one of your recovery codes."}
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-3">
            <input
              type="text"
              inputMode={factorType === "totp" ? "numeric" : "text"}
              value={code}
              onChange={(e) => setCode(factorType === "totp" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value)}
              placeholder={factorType === "totp" ? "123456" : "xxxx-xxxx-xxxx-xxxx"}
              className={`w-full rounded-xl border border-input bg-background px-3 py-3 text-center focus:ring-2 focus:ring-ring outline-none ${
                factorType === "totp" ? "text-lg font-mono tracking-[0.3em]" : "font-mono text-sm"
              }`}
              required
              autoFocus
            />
            <button
              type="submit"
              disabled={busy || !code}
              className="w-full gradient-accent text-primary-foreground font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Verify
            </button>
          </form>

          <button
            onClick={() => { setFactorType((t) => (t === "totp" ? "recovery" : "totp")); setCode(""); }}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5" />
            {factorType === "totp" ? "Lost phone? Use a recovery code" : "Use authenticator code instead"}
          </button>

          <Link to="/auth/signin" className="block mt-3 text-center text-sm text-muted-foreground hover:text-foreground">
            ← Back to Sign In
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
