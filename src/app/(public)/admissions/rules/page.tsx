import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck, Users, GraduationCap, Award, Calendar, FileText, Wallet, Trophy, CheckCircle2, AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { Reveal } from "@/components/site/reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";

export const metadata: Metadata = {
  title: "Admission Rules & Policy — HED KPK Pattern",
  description: "Full admission policy for GHSS Ghallanai — eligibility, age limits, seat allocation (quotas), merit determination, document requirements and grievance redressal. Modeled on the HED KPK Admission Policy for government colleges.",
};

const QUOTAS = [
  { name: "Open Merit", percent: "40%", seats: "16 / 40", desc: "Pakistani citizens on merit basis. Candidates applying under any quota (except Afghan) are automatically considered for Open Merit." },
  { name: "Local Quota", percent: "45%", seats: "18 / 40", desc: "Candidates domiciled in Mohmand district, or whose parents'/own CNIC address matches the college jurisdiction, or are wards of in-service/retired HED KPK employees posted in district." },
  { name: "College Employee", percent: "6%", seats: "2 / 40", desc: "Children of in-service or retired Higher Education Department Khyber Pakhtunkhwa employees (college sub-sector) on provincial basis." },
  { name: "Sports Quota", percent: "5%", seats: "2 / 40", desc: "Provincial sports quota. Merit = certificate marks (max 35) + trial marks (max 65). Active participation in college sports team is mandatory." },
  { name: "Special Person", percent: "2%", seats: "1 / 40", desc: "Candidates with a disability certificate issued by the relevant department. Entitled to fee waiver per HED KPK directives." },
  { name: "Minority", percent: "2%", seats: "1 / 40", desc: "Provincial minority quota. Declaration on affidavit required." },
  { name: "Afghan", percent: "1 seat", seats: "1 (over & above)", desc: "Afghan citizens with NOC and recommendation from the Afghan Commissionerate, plus clearance certificate from local police station." },
];

const PROGRAMMES = [
  { code: "pre-medical", label: "FSc Pre-Medical", subjects: "English · Urdu · Islamiat/Pak Studies · Biology · Chemistry · Physics", careers: "MBBS · BDS · Pharmacy · DPT · Nursing · Biotechnology", seats: 40 },
  { code: "pre-engineering", label: "FSc Pre-Engineering", subjects: "English · Urdu · Islamiat/Pak Studies · Mathematics · Physics · Chemistry", careers: "BE/BS Engineering · Architecture · Computer Science · Mathematics", seats: 40 },
  { code: "ics", label: "ICS — Computer Science", subjects: "English · Urdu · Islamiat/Pak Studies · Computer Science · Mathematics · Physics", careers: "BS Computer Science · BS Software Engineering · BS IT · BS AI", seats: 40 },
  { code: "arts", label: "FA Humanities", subjects: "English · Urdu · Islamiat/Pak Studies · Civics · Education · General History", careers: "LLB · BBA · Mass Comm · BS English · BS Political Science", seats: 40 },
];

const REQUIRED_DOCS = [
  "SSC (Matriculation) Certificate — original + 2 photocopies",
  "Detail Marks Certificate / Provisional Certificate of last exam passed",
  "Domicile Certificate (Mohmand district preferred for Local Quota)",
  "Own / Father CNIC / Form-B (13 digits, no dashes)",
  "Character Certificate issued by the institution last attended (or gazetted officer if private candidate)",
  "4 coloured passport-size photographs",
  "Quota eligibility certificate (if applying under Sports / Special Person / Minority / Afghan / Employee)",
  "Hafiz-e-Quran certificate (if claiming +20 marks)",
  "Original Migration Certificate (Board-to-Board) for candidates from a board other than BISE Peshawar",
  "Affidavit for non-involvement in politics (on plain paper) — already built into the online declaration",
];

export default function AdmissionRulesPage() {
  return (
    <>
      <PageHeader
        kicker="Admissions · Rules"
        title={<>Admission <span className="text-gold">policy</span> & rules</>}
        lead="Modeled on the HED KPK Admission Policy for Government Colleges. Read carefully before applying — every field in the online form maps to one of these rules."
        breadcrumbs={[
          { name: "Admissions", href: "/admissions" },
          { name: "Admission Rules", href: "/admissions/rules" },
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16 space-y-12">

        {/* Quick summary */}
        <Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Calendar, label: "Admission Window", value: "15 Sep – 30 Nov 2026", hint: "Session 2026-27" },
              { icon: Wallet, label: "Processing Fee", value: "Rs 100 / application", hint: "Payable at college office" },
              { icon: Users, label: "Total Seats", value: "160 (4 × 40)", hint: "1st Year · 4 programmes" },
              { icon: GraduationCap, label: "Age Limit (Male)", value: "19 years", hint: "Females: no limit" },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-border bg-card p-5">
                <s.icon className="h-5 w-5 text-primary" strokeWidth={1.75} aria-hidden />
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
                <p className="mt-1 font-display text-lg font-bold tracking-tight">{s.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* 4-step flow */}
        <Reveal>
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <p className="kicker">The 4-step online flow</p>
            <h2 className="mt-2 text-h2">How to apply — modeled on admission.hed.gkp.pk</h2>
            <p className="mt-3 max-w-2xl text-lead text-muted-foreground">
              The online application portal walks you through 4 guided steps. Each step saves
              automatically to your browser, so an interrupted connection loses nothing.
            </p>

            <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { n: 1, t: "Create Account", d: "Enter your nationality, CNIC/Form-B (13 digits), mobile number and password. Mobile cannot be changed later — it carries your fee receipts and SMS alerts.", icon: Users },
                { n: 2, t: "Board Verification", d: "Enter your matric board, roll number, year and marks. We compute your percentage which is used in the merit calculation.", icon: ShieldCheck },
                { n: 3, t: "Personal Information", d: "Full name, father/guardian name + CNIC, date of birth, gender, domicile district and permanent address. Age is verified against HED rules.", icon: FileText },
                { n: 4, t: "Programme & Quota", d: "Choose 1st/2nd Year, programme (Pre-Medical / Pre-Engineering / ICS / Arts), quota (Open Merit / Local / Sports / etc.), subjects and declarations. Submit → get tracking token.", icon: GraduationCap },
              ].map((s) => (
                <li key={s.n} className="relative rounded-xl border border-border p-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{s.n}</span>
                    <s.icon className="h-4 w-4 text-primary" strokeWidth={1.75} aria-hidden />
                  </div>
                  <p className="mt-2 text-sm font-bold">{s.t}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.d}</p>
                </li>
              ))}
            </ol>

            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild className="h-11 rounded-full font-semibold">
                <Link href="/admissions/apply">Start Your Application</Link>
              </Button>
              <Button asChild variant="outline" className="h-11 rounded-full">
                <Link href="/admissions/track">Track Application</Link>
              </Button>
            </div>
          </div>
        </Reveal>

        {/* Eligibility */}
        <Reveal>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-h3">Eligibility criteria</h2>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  <span>Passed SSC (Matriculation) from any BISE in Pakistan or equivalent (O-Level with IBCC equivalency).</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  <span>Minimum marks as per BISE policy for Intermediate Part-I (typically 33% but merit cutoff is much higher).</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  <span>Age limit for male candidates: 19 years (relaxable by the Principal with valid reason).</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  <span>No upper age limit for female candidates (except Sports Quota).</span>
                </li>
                <li className="flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  <span>Failed in any subject in the preceding exam → not eligible for 1st Year admission.</span>
                </li>
                <li className="flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  <span>Supplementary exam pass-outs of the immediately preceding year are not eligible in the same academic year.</span>
                </li>
                <li className="flex gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  <span>Gap of 1+ years requires an affidavit stating no previous admission was taken.</span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6">
              <h2 className="text-h3">Merit determination</h2>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <Trophy className="h-4 w-4 shrink-0 text-gold-strong" aria-hidden />
                  <span><strong>Aggregate percentage</strong> in the qualifying examination (matriculation for 1st Year).</span>
                </li>
                <li className="flex gap-2">
                  <Award className="h-4 w-4 shrink-0 text-gold-strong" aria-hidden />
                  <span><strong>+20 marks</strong> for Hafiz-e-Quran candidates (verified by certificate + admission committee test).</span>
                </li>
                <li className="flex gap-2">
                  <Calendar className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span><strong>−5 marks per gap year</strong> (no deduction if passed in supplementary session of the immediately preceding year).</span>
                </li>
                <li className="flex gap-2">
                  <Users className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <span>In case of equal percentage: the candidate older in age is placed higher. If age also ties: the one who applied first wins.</span>
                </li>
                <li className="flex gap-2">
                  <Trophy className="h-4 w-4 shrink-0 text-gold-strong" aria-hidden />
                  <span>Sports quota merit = certificate marks (max 35) + trial marks (max 65).</span>
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  <span>Merit lists are publicly displayed on the college notice board and on <Link href="/results/merit-list" className="font-semibold text-primary hover:underline">/results/merit-list</Link>.</span>
                </li>
              </ul>
            </div>
          </div>
        </Reveal>

        {/* Seat allocation table */}
        <Reveal>
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <p className="kicker">Seat allocation</p>
            <h2 className="mt-2 text-h2">Intermediate Part-I quota distribution</h2>
            <p className="mt-3 max-w-2xl text-lead text-muted-foreground">
              Per HED KPK policy. Total 40 seats per programme × 4 programmes = 160 seats for 1st Year.
              Vacant seats under any quota (except Afghan) are re-allocated to Open Merit.
            </p>

            <div className="mt-6 overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Quota</TableHead>
                    <TableHead>Percentage</TableHead>
                    <TableHead>Seats (of 40)</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {QUOTAS.map((q, i) => (
                    <TableRow key={q.name}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell><strong>{q.name}</strong></TableCell>
                      <TableCell><Badge variant="outline" className="border-gold/40 text-gold-strong">{q.percent}</Badge></TableCell>
                      <TableCell className="font-mono">{q.seats}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{q.desc}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </Reveal>

        {/* Programmes offered */}
        <Reveal>
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <p className="kicker">Programmes offered</p>
            <h2 className="mt-2 text-h2">1st Year & 2nd Year streams</h2>
            <p className="mt-3 max-w-2xl text-lead text-muted-foreground">
              GHSS Ghallanai offers all 4 HSSC programmes approved by BISE. Each programme has 3
              compulsory + 3 elective subjects (mirroring the official BISE subject combinations).
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {PROGRAMMES.map((p) => (
                <div key={p.code} className="rounded-xl border border-border p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-display text-base font-bold">{p.label}</p>
                      <Badge variant="outline" className="mt-1 text-[10px]">{p.seats} seats</Badge>
                    </div>
                    <GraduationCap className="h-5 w-5 text-primary" strokeWidth={1.75} aria-hidden />
                  </div>
                  <dl className="mt-3 space-y-1.5 text-xs">
                    <div>
                      <dt className="font-semibold text-muted-foreground">Subjects</dt>
                      <dd className="mt-0.5">{p.subjects}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-muted-foreground">Career paths</dt>
                      <dd className="mt-0.5">{p.careers}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Documents */}
        <Reveal>
          <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
            <p className="kicker">Documents required</p>
            <h2 className="mt-2 text-h2">Bring these to the college office</h2>
            <p className="mt-3 max-w-2xl text-lead text-muted-foreground">
              After your online application is submitted and fee paid, present these documents
              (original + photocopies) at the admission office for verification.
            </p>
            <ol className="mt-6 space-y-2.5">
              {REQUIRED_DOCS.map((d, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{i + 1}</span>
                  <span className="text-muted-foreground">{d}</span>
                </li>
              ))}
            </ol>
          </div>
        </Reveal>

        {/* CTA */}
        <Reveal>
          <div className="rounded-2xl border-2 border-gold/40 bg-gold-soft/20 p-6 sm:p-10 text-center">
            <h2 className="text-h2">Ready to apply?</h2>
            <p className="mx-auto mt-3 max-w-xl text-lead text-muted-foreground">
              The online application takes about 15 minutes. Each step saves automatically.
              On submission you receive a tracking token to follow your status in real time.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button asChild className="h-12 rounded-full font-bold text-base">
                <Link href="/admissions/apply">Start Application</Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-full">
                <Link href="/admissions/track">Track Application</Link>
              </Button>
              <Button asChild variant="ghost" className="h-12 rounded-full">
                <Link href="/admissions/faq">Read FAQ</Link>
              </Button>
            </div>
          </div>
        </Reveal>

      </section>
    </>
  );
}
