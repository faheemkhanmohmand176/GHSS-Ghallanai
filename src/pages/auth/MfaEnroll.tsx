/**
 * MfaEnroll — admin TOTP (authenticator app) enrollment.
 *
 * Uses Supabase Auth MFA (built-in, free).  The admin scans the QR code with
 * Google Authenticator / Microsoft Authenticator, enters the 6-digit code to
 * confirm, and is shown recovery codes ONCE.  After enrollment the admin is
 * sent to /auth/mfa-verify for the first verification, then to /admin.
 *
 * RECOVERY (lost phone):
 *   - Save the recovery codes shown here in a safe place.
 *   - To use one, go to /auth/mfa-verify and pick "Use recovery code".
 *   - If recovery codes are also lost: another admin can sign in, open the
 *     Supabase dashboard → Authentication → Users → find this admin →
 *     "MFA Factors" → delete the lost factor.  Or email Supabase support.
 */

import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2, ArrowRight, KeyRound, Copy, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import toast from "react-hot-toast";
import { useSchoolSettings, safeMediaUrl } from "@/hooks/useSchoolSettings";

type Phase = "loading" | "enroll" | "verify" | "recovery" | "done";

export default function MfaEnroll() {
  const navigate = useNavigate();
  const { data: settings } = useSchoolSettings();
  const [phase, setPhase] = useState<Phase>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Step 1 — enroll a new TOTP factor
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          issuer: settings?.school_name || "GHSS Ghallanai",
          friendlyName: "Admin Authenticator",
        });
        if (cancelled) return;
        if (error || !data?.id) {
          toast.error(error?.message || "Could not start MFA enrollment.");
          setPhase("loading");
          return;
        }
        setFactorId(data.id);
        setQr(data.totp?.qr_code ?? null);
        setSecret(data.totp?.secret ?? null);
        setRecovery(data.recovery_codes ?? []);
        setPhase("enroll");
      } catch {
        if (!cancelled) toast.error("Network error during enrollment.");
      }
    })();
    return () => { cancelled = true; };
  }, [settings?.school_name]);

  // Step 2 — verify the first 6-digit code
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    const c = code.replace(/\D/g, "").slice(0, 6);
    if (c.length !== 6) { toast.error("Enter the 6-digit code from your authenticator."); return; }
    setBusy(true);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr || !ch?.id) { toast.error(chErr?.message || "Could not create challenge."); setBusy(false); return; }
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: c });
      if (vErr) { toast.error(vErr.message || "Wrong code. Try again."); setBusy(false); return; }
      // Mark the profile so the admin UI can show the MFA badge without an extra call
      try {
        await supabase.from("profiles").update({ mfa_enrolled: true }).eq("id", (await supabase.auth.getUser()).data.user?.id);
      } catch { /* non-fatal */ }
      setPhase("recovery");
    } catch {
      toast.error("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (phase === "loading") {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-on-hero" />
      </div>
    );
  }

  if (phase === "recovery") {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md relative z-10">
          <div className="bg-card rounded-2xl shadow-elevated p-7">
            <div className="text-center mb-5">
              <KeyRound className="w-10 h-10 mx-auto text-gold" />
              <h1 className="text-2xl font-heading font-bold text-foreground mt-2">Save your recovery codes</h1>
              <p className="text-sm text-muted-foreground mt-1">
                If you lose your phone, these codes let you sign in once each. Store them somewhere safe — you will NOT see them again.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-muted/50 p-4 grid grid-cols-2 gap-1.5 font-mono text-[12.5px]">
              {recovery.map((r, i) => <span key={i} className="text-foreground">{r}</span>)}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { navigator.clipboard?.writeText(recovery.join("\n")); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold flex items-center justify-center gap-2 hover:bg-muted"
              >
                {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy all</>}
              </button>
              <button
                onClick={() => { setPhase("done"); navigate("/auth/mfa-verify", { replace: true }); }}
                className="flex-1 h-10 rounded-xl gradient-accent text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2"
              >
                I saved them <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl shadow-elevated p-7 text-center max-w-md">
          <ShieldCheck className="w-12 h-12 mx-auto text-green-600" />
          <h1 className="text-2xl font-heading font-bold text-foreground mt-2">MFA is on</h1>
          <p className="text-sm text-muted-foreground mt-1">Redirecting to verification…</p>
        </div>
      </div>
    );
  }

  // phase === "enroll" | "verify" — show QR + code input
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
            <h1 className="text-2xl font-heading font-bold text-foreground">Set up 2-step login</h1>
            <p className="text-sm text-muted-foreground mt-1">Scan this QR with Google Authenticator or Microsoft Authenticator.</p>
          </div>

          {qr && (
            <div className="flex justify-center mb-4">
              <div className="rounded-xl bg-white p-3 shadow-card">
                <img src={qr} alt="MFA QR code" className="w-48 h-48" />
              </div>
            </div>
          )}
          {secret && (
            <div className="mb-4 text-center">
              <p className="text-[11px] text-muted-foreground mb-1">Can't scan? Enter this secret manually:</p>
              <code className="font-mono text-[12.5px] bg-muted px-2 py-1 rounded break-all select-all">{secret}</code>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Enter the 6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-center text-lg font-mono tracking-[0.3em] focus:ring-2 focus:ring-ring outline-none"
                required
              />
            </div>
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full gradient-accent text-primary-foreground font-semibold py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Confirm & Enable
            </button>
          </form>

          <Link to="/auth/signin" className="block mt-4 text-center text-sm text-muted-foreground hover:text-foreground">
            ← Back to Sign In
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
