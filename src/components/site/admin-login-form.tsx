"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Lock, Mail, Eye, EyeOff, KeyRound, ArrowLeft } from "lucide-react";
import { signInWithPassword, requestPasswordReset, supabaseBrowser } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * AdminLoginForm — email + password sign-in (Babi Khel pattern).
 * Verifies the profile really holds role = admin before entering /admin.
 * Generic errors never reveal which field failed (anti-enumeration).
 * Already signed in as admin? Skips straight to the dashboard.
 */
export function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/admin";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    // If a valid admin session already exists, go straight in.
    (async () => {
      const { data: sess } = await sb.auth.getSession();
      if (!sess.session?.user) return;
      const { data: profile } = await sb.from("profiles").select("role").eq("id", sess.session.user.id).maybeSingle();
      if (profile?.role === "admin") router.replace(next);
    })();
  }, [router, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    const res = await signInWithPassword(email.trim(), password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    setError(null);
    setBusy(true);
    const res = await requestPasswordReset(email.trim());
    setBusy(false);
    setResetSent(res.ok);
    if (!res.ok) setError(res.error);
  }

  return (
    <div className="rounded-2xl border border-[#E8F5EC]/15 bg-card p-6 shadow-2xl sm:p-8">
      {resetMode ? (
        <form onSubmit={reset} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-small font-semibold">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 pl-10"
                placeholder="admin@ghssghallanai.edu.pk"
                required
              />
            </div>
          </div>
          {resetSent && (
            <p className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              If the address belongs to an account, a reset link is on its way.
            </p>
          )}
          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs font-semibold text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={busy} className="button-press h-11 flex-1 rounded-full font-bold">
              <KeyRound className="mr-1.5 h-4 w-4" aria-hidden />
              {busy ? "Sending…" : "Send reset link"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setResetMode(false);
                setError(null);
                setResetSent(false);
              }}
              className="button-press h-11 rounded-full border-[#E8F5EC]/30 bg-transparent text-[#E8F5EC] hover:bg-[#E8F5EC]/10 hover:text-white"
            >
              Back
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-small font-semibold">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 pl-10"
                placeholder="admin@ghssghallanai.edu.pk"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-small font-semibold">Password</Label>
              <button
                type="button"
                onClick={() => setResetMode(true)}
                className="text-xs font-semibold text-primary hover:underline underline-offset-2"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 pl-10 pr-11"
                placeholder="••••••••"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
              >
                {showPw ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3.5 py-2.5 text-xs font-semibold text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="button-press sheen relative h-12 w-full overflow-hidden rounded-full bg-gold text-base font-bold text-[#1A2E22] hover:bg-gold-strong"
          >
            <LogIn className="mr-1.5 h-4.5 w-4.5" aria-hidden />
            {busy ? "Verifying…" : "Sign In"}
          </Button>
        </form>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to the website
        </Link>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" aria-hidden /> RLS-protected
        </span>
      </div>
    </div>
  );
}
