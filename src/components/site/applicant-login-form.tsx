"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

export function ApplicantLoginForm() {
  const [cnic, setCnic] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const response = await fetch("/api/admissions/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cnic, password }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Login failed");
      localStorage.setItem("ghss-applicant-session", JSON.stringify({ cnic, signedInAt: new Date().toISOString() })); setOk(true);
    } catch (error) { toast({ title: "Could not sign in", description: error instanceof Error ? error.message : "Check your CNIC and password.", variant: "destructive" }); } finally { setBusy(false); }
  }
  if (ok) return <div className="mx-auto max-w-xl rounded-2xl border border-gold/40 bg-card p-6 text-center sm:p-10"><LogIn className="mx-auto h-12 w-12 text-primary" /><h2 className="mt-4 text-h2">Signed in</h2><p className="mt-2 text-small text-muted-foreground">Continue your application or look up an existing tracking ID.</p><div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild className="h-11 rounded-full"><Link href="/admissions/apply">Open application <ArrowRight className="ml-1 h-4 w-4" /></Link></Button><Button asChild variant="outline" className="h-11 rounded-full"><Link href="/admissions/track">Track status</Link></Button></div></div>;
  return <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-5 sm:p-8"><h2 className="text-h3">Sign in to applicant account</h2><p className="mt-2 text-small text-muted-foreground">CNIC/Form-B is entered without dashes, as on the registration page.</p><form onSubmit={submit} className="mt-6 space-y-5"><div><Label htmlFor="login-cnic" className="text-small font-semibold">CNIC / Form-B *</Label><Input id="login-cnic" value={cnic} onChange={(e) => setCnic(e.target.value.replace(/\D/g, "").slice(0, 13))} inputMode="numeric" className="mt-1.5 h-11" required /></div><div><Label htmlFor="login-password" className="text-small font-semibold">Password *</Label><Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 h-11" required /></div><Button type="submit" disabled={busy} className="h-11 rounded-full px-6 font-bold">{busy ? "Signing in…" : "Sign in"}</Button></form><p className="mt-5 text-small text-muted-foreground">New applicant? <Link href="/admissions/register" className="font-semibold text-primary underline underline-offset-4">Create an account</Link></p></div>;
}
