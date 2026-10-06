"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

/**
 * Registration form — mirrors HED KPK apply_step1.php
 * Captured from https://admission.hed.gkp.pk/apply_step1.php
 *
 * Step indicator on HED: "1 Create Account → 2 Board Verification → 3 Personal
 * Information → 4 Academic Information"
 *
 * Fields captured from the live HED portal:
 *  - Nationality (Pakistani / Afghani) — radio
 *  - CNIC/Form-B (Pakistani): 13 digits, no dashes, locked for life
 *  - Afghan Card/Passport (Afghani)
 *  - Mobile number: 11 digits, format 03451234567, used for payment + SMS
 *  - Password: min 8 chars
 *  - Confirm password
 *  - Math captcha (e.g. "7 + 4 = ?")
 */

const schema = z.object({
  nationality: z.enum(["Pakistani", "Afghani"]),
  cnic: z.string().regex(/^\d{13}$/, "CNIC/Form-B must be exactly 13 digits without dashes."),
  afghaniCard: z.string().min(5, "Enter Afghan card or passport number (no dashes).").max(40).optional(),
  email: z.string().email("Enter a valid email address.").or(z.literal("")),
  phone: z.string().regex(/^03\d{9}$/, "Enter a valid Pakistani mobile number (03xxxxxxxxx)."),
  password: z.string().min(8, "Password should be at least 8 characters."),
  confirmPassword: z.string(),
  captcha: z.coerce.number(),
}).refine((v) => v.password === v.confirmPassword, { message: "Passwords do not match.", path: ["confirmPassword"] })
  .refine((v) => v.nationality === "Pakistani" || Boolean(v.afghaniCard), {
    message: "Afghani applicants must enter their card/passport number.",
    path: ["afghaniCard"],
  });

type Values = z.infer<typeof schema>;

export function RegistrationForm() {
  const [values, setValues] = useState<Values>({
    nationality: "Pakistani",
    cnic: "",
    afghaniCard: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    captcha: 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  // Captcha: random 1-9 + 1-9 (HED uses small numbers like "1+1", "14+14")
  const captcha = useMemo(() => ({ a: 1 + Math.floor(Math.random() * 9), b: 1 + Math.floor(Math.random() * 9) }), []);

  function set<K extends keyof Values>(key: K, value: Values[K]) { setValues((v) => ({ ...v, [key]: value })); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ ...values, captcha: Number(values.captcha) });
    const nextErrors: Record<string, string> = {};
    if (!parsed.success) for (const issue of parsed.error.issues) nextErrors[String(issue.path[0])] = issue.message;
    if (values.captcha !== captcha.a + captcha.b) nextErrors.captcha = "Enter the correct answer to the maths question.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    try {
      const response = await fetch("/api/admissions/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Registration failed");
      localStorage.setItem("ghss-applicant-account", JSON.stringify({
        nationality: values.nationality,
        cnic: values.cnic,
        createdAt: new Date().toISOString(),
      }));
      setDone(true);
    } catch (error) {
      toast({
        title: "Could not create account",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-gold/40 bg-card p-6 text-center sm:p-10">
        <CheckCircle2 className="mx-auto h-14 w-14 text-primary" />
        <h2 className="mt-5 text-h2">Account created</h2>
        <p className="mt-3 text-small text-muted-foreground">
          Your applicant account is ready. Continue to the six-step form and keep your
          CNIC and password safe. The mobile number you entered is now locked and cannot
          be changed — it will be used for all SMS alerts and (future) online payment.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild className="h-11 rounded-full">
            <Link href="/admissions/apply">Start application <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
          <Button asChild variant="outline" className="h-11 rounded-full">
            <Link href="/admissions/track">Track an existing application</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 sm:p-8">
        <h2 className="text-h3">Step 1: Create Account</h2>
        <p className="mt-2 text-small text-muted-foreground">
          Use the same CNIC/Form-B you will use on the admission application. Your mobile
          number is locked for life — it will be used for online payment and SMS alerts.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <Label className="text-small font-semibold">Nationality *</Label>
            <Select value={values.nationality} onValueChange={(v) => set("nationality", v as Values["nationality"])}>
              <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Pakistani">Pakistani</SelectItem>
                <SelectItem value="Afghani">Afghani</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {values.nationality === "Pakistani" ? (
            <div>
              <Label htmlFor="reg-cnic" className="text-small font-semibold">CNIC / Form-B *</Label>
              <Input
                id="reg-cnic"
                value={values.cnic}
                onChange={(e) => set("cnic", e.target.value.replace(/\D/g, "").slice(0, 13))}
                inputMode="numeric"
                placeholder="0000000000000"
                className="mt-1.5 h-11 font-mono"
              />
              <p className="mt-1 text-xs text-muted-foreground">CNIC Number Must Be 13 Digits And Without dashes(-) E.g 0000000000000</p>
              {errors.cnic && <p className="mt-1 text-xs font-semibold text-destructive">{errors.cnic}</p>}
            </div>
          ) : (
            <div>
              <Label htmlFor="reg-afg" className="text-small font-semibold">Afghan Card | Passport Number *</Label>
              <Input
                id="reg-afg"
                value={values.afghaniCard ?? ""}
                onChange={(e) => set("afghaniCard", e.target.value)}
                placeholder="Enter Afghan Card | Passport Number Without Dashes(-)"
                className="mt-1.5 h-11"
              />
              {errors.afghaniCard && <p className="mt-1 text-xs font-semibold text-destructive">{errors.afghaniCard}</p>}
            </div>
          )}

          <div>
            <Label htmlFor="reg-phone" className="text-small font-semibold">Mobile Number *</Label>
            <Input
              id="reg-phone"
              value={values.phone}
              onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, 11))}
              inputMode="tel"
              placeholder="03xxxxxxxxx"
              className="mt-1.5 h-11"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Make sure your mobile number is correct and in 03451234567 format. You will not be
              able to change your mobile number later.
            </p>
            {errors.phone && <p className="mt-1 text-xs font-semibold text-destructive">{errors.phone}</p>}
          </div>

          <div>
            <Label htmlFor="reg-email" className="text-small font-semibold">Email address</Label>
            <Input
              id="reg-email"
              type="email"
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 h-11"
            />
            {errors.email && <p className="mt-1 text-xs font-semibold text-destructive">{errors.email}</p>}
          </div>

          <div>
            <Label htmlFor="reg-password" className="text-small font-semibold">Password *</Label>
            <Input
              id="reg-password"
              type="password"
              value={values.password}
              onChange={(e) => set("password", e.target.value)}
              className="mt-1.5 h-11"
            />
            <p className="mt-1 text-xs text-muted-foreground">Password should be at least 8 characters</p>
            {errors.password && <p className="mt-1 text-xs font-semibold text-destructive">{errors.password}</p>}
          </div>

          <div>
            <Label htmlFor="reg-confirm" className="text-small font-semibold">Confirm Password *</Label>
            <Input
              id="reg-confirm"
              type="password"
              value={values.confirmPassword}
              onChange={(e) => set("confirmPassword", e.target.value)}
              className="mt-1.5 h-11"
            />
            {errors.confirmPassword && <p className="mt-1 text-xs font-semibold text-destructive">{errors.confirmPassword}</p>}
          </div>

          <div>
            <Label htmlFor="reg-captcha" className="text-small font-semibold">{captcha.a} + {captcha.b} = *</Label>
            <Input
              id="reg-captcha"
              type="number"
              value={values.captcha || ""}
              onChange={(e) => set("captcha", Number(e.target.value))}
              className="mt-1.5 h-11 max-w-32"
            />
            <p className="mt-1 text-xs text-muted-foreground">Solve this simple math problem and enter the result.</p>
            {errors.captcha && <p className="mt-1 text-xs font-semibold text-destructive">{errors.captcha}</p>}
          </div>

          <Button type="submit" className="h-11 rounded-full px-6 font-bold">Create account</Button>
        </div>

        <p className="mt-5 text-small text-muted-foreground">
          Already have an account?{" "}
          <Link href="/admissions/login" className="font-semibold text-primary underline underline-offset-4">Sign in</Link>
        </p>
      </form>

      <aside className="rounded-2xl border border-border bg-secondary/60 p-6 sm:p-8">
        <ShieldCheck className="h-7 w-7 text-primary" />
        <h2 className="mt-4 text-h3">Before you begin</h2>
        <ul className="mt-4 space-y-3 text-small text-muted-foreground">
          <li>Use 13 digits without dashes in the CNIC/Form-B field.</li>
          <li>Keep your password private; the school will never ask for it.</li>
          <li>One account can be used to prepare and track an application.</li>
          <li>Your form draft is saved on this device while you work.</li>
          <li>The mobile number you enter is locked — make sure it&apos;s correct.</li>
        </ul>
        <p className="mt-6 rounded-xl border border-gold/40 bg-gold-soft/30 p-4 text-xs text-muted-foreground dark:bg-gold-soft/20">
          Demo mode creates a local-safe account marker. Configure the supplied Supabase
          migration and server key before accepting live applicant accounts. The full
          multi-step form mirrors HED KPK OCAS structure: registration → board verification
          → personal info → academic info → submit → track.
        </p>
      </aside>
    </div>
  );
}
