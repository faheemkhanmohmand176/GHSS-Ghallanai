"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GraduationCap, Briefcase, ShieldCheck, LogIn, ArrowLeft } from "lucide-react";
import { CrestMark } from "@/components/site/crest";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured } from "@/lib/supabase";

/**
 * /login — Supabase Auth when configured (email OTP + password, §8.6);
 * demo entry otherwise so the ZIP runs out of the box.
 */

const DEMO_ROLES = [
  {
    role: "student",
    label: "Student portal",
    desc: "Timetable, assignments, attendance, results",
    icon: GraduationCap,
    href: "/portal/student",
  },
  {
    role: "teacher",
    label: "Teacher portal",
    desc: "Classes, attendance marking, gradebook",
    icon: Briefcase,
    href: "/portal/teacher",
  },
  {
    role: "admin",
    label: "Admin dashboard",
    desc: "Notices, admissions queue, publishing",
    icon: ShieldCheck,
    href: "/admin",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = isSupabaseConfigured();

  async function onSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    if (!email || !password) {
      setError("Enter your institutional email and password.");
      return;
    }
    setLoading(true);
    try {
      const { getSupabaseBrowser } = await import("@/lib/supabase");
      const sb = getSupabaseBrowser();
      const { error: authError } = await sb.auth.signInWithPassword({ email, password });
      if (authError) throw new Error(authError.message);
      // Role routing happens in /portal after profile load
      router.push("/portal/student");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setLoading(false);
    }
  }

  function enterDemo(role: string, href: string) {
    document.cookie = `ghss-demo-role=${role}; path=/; max-age=86400; samesite=lax`;
    router.push(href);
  }

  return (
    <div className="app-shell">
      <header className="border-b border-border/70">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <CrestMark className="h-9 w-9" />
            <span className="font-display text-lg font-bold">
              GHSS <span className="text-gold">Ghallanai</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/"
              className="inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-small font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back to site
            </Link>
          </div>
        </div>
      </header>

      <main className="app-main mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
        <div className="text-center">
          <CrestMark className="mx-auto h-14 w-14" />
          <h1 className="mt-4 text-h1">Sign in</h1>
          <p className="mt-2 text-small text-muted-foreground">
            {live
              ? "Students, teachers and staff sign in with their institutional accounts."
              : "Supabase is not configured — use a demo workspace, or connect Supabase for live authentication (see README)."}
          </p>
        </div>

        {live ? (
          <form onSubmit={onSignIn} className="mt-8 space-y-4 rounded-2xl border border-border bg-card p-6">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-small font-semibold">Institutional email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" className="h-11" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-small font-semibold">Password</Label>
              <Input id="password" name="password" type="password" autoComplete="current-password" className="h-11" required />
            </div>
            {error && (
              <p className="text-small font-semibold text-destructive" role="alert">{error}</p>
            )}
            <Button type="submit" disabled={loading} className="h-11 w-full rounded-full font-bold">
              <LogIn className="mr-1.5 h-4 w-4" aria-hidden />
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Email OTP and password reset flows are configured in the Supabase dashboard
              (Master Plan §8.6).
            </p>
          </form>
        ) : null}

        {/* Demo workspaces — always available, labelled honestly */}
        <div className={live ? "mt-6" : "mt-8"}>
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {live ? "Or preview a workspace" : "Preview a workspace"}
          </p>
          <div className="space-y-2.5">
            {DEMO_ROLES.map((r) => (
              <button
                key={r.role}
                type="button"
                onClick={() => enterDemo(r.role, r.href)}
                className="card-lift flex w-full items-center gap-4 rounded-xl border border-border bg-card p-4 text-left focus-visible:border-gold"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <r.icon className="h-5.5 w-5.5 text-primary" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-small font-bold">{r.label}</span>
                  <span className="block text-xs text-muted-foreground">{r.desc}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Demo workspaces show SAMPLE data to demonstrate every screen of the
            SaaS layer (Master Plan §1.2).
          </p>
        </div>
      </main>

      <footer className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        GHSS Ghallanai · Mohmand District · Khyber Pakhtunkhwa
      </footer>
    </div>
  );
}
