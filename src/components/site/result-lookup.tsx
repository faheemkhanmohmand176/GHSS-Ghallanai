"use client";

import { useState } from "react";
import { Search, Printer, Share2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { BoardResult } from "@/content/results";

/**
 * Result lookup form (§6.5/§7.2): roll number + year + programme →
 * subject-wise card, printable, shareable. Failure → retry messaging;
 * 3 failures → captcha/WhatsApp escalation notice.
 */

const PROGRAMMES = [
  { value: "ics", label: "ICS" },
  { value: "pre-medical", label: "Pre-Medical" },
  { value: "pre-engineering", label: "Pre-Engineering" },
  { value: "arts", label: "Arts" },
];

export function ResultLookup() {
  const [rollNo, setRollNo] = useState("");
  const [year, setYear] = useState("2026");
  const [programme, setProgramme] = useState("pre-medical");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BoardResult | null>(null);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!rollNo.trim()) {
      setError("Enter the roll number printed on the result card.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/results/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rollNo, year: Number(year), programme }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Lookup failed");
      setResult(data.result);
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : "Lookup failed — check your connection.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
    setRollNo("");
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Search card */}
      {!result && (
        <form
          onSubmit={onSearch}
          className="rounded-2xl border border-border bg-card p-6 md:p-8"
          noValidate
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1.5">
              <Label htmlFor="rollno" className="text-small font-semibold">
                Roll number
              </Label>
              <Input
                id="rollno"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                placeholder="e.g. GH-12-101"
                className="h-12 text-base"
                autoComplete="off"
                required
              />
              <p className="text-xs text-muted-foreground">
                Try the demo roll numbers: GH-12-101 · GH-12-102 · GH-11-201 · GH-11-202
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="year" className="text-small font-semibold">Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger id="year" className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2026">Annual 2026</SelectItem>
                  <SelectItem value="2025">Annual 2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prog" className="text-small font-semibold">Programme</Label>
              <Select value={programme} onValueChange={setProgramme}>
                <SelectTrigger id="prog" className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROGRAMMES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {error && (
            <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-small font-medium text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" disabled={loading} className="mt-6 h-12 w-full rounded-full text-base font-bold">
            <Search className="mr-1.5 h-5 w-5" aria-hidden />
            {loading ? "Searching…" : "Check Result"}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Results are served exactly as published by the exam branch on result day.
          </p>
        </form>
      )}

      {/* Result card — printable (§6.5) */}
      {result && (
        <article className="print-card overflow-hidden rounded-2xl border border-border bg-card">
          <header className="border-b border-border bg-primary-strong px-6 py-5 text-[#FAFDF7] dark:bg-[#0a1810]">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gold">
              Government Higher Secondary School Ghallanai
            </p>
            <h2 className="mt-1 font-display text-xl font-bold">
              Intermediate Result · Annual {year}
            </h2>
            <p className="mt-1 text-small text-[#E8F5EC]/80">
              {result.rollNo} · {PROGRAMMES.find((p) => p.value === programme)?.label} ·{" "}
              {year === "2026" ? "Second year" : "Second year"}
            </p>
          </header>

          <div className="p-6 md:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Student</p>
                <p className="mt-0.5 text-lg font-bold">{result.studentName}</p>
              </div>
              {result.position && (
                <p className="rounded-full bg-gold-soft px-3 py-1 text-xs font-bold text-gold-strong dark:text-gold">
                  {result.position}
                </p>
              )}
            </div>

            <table className="mt-6 w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2.5 pr-4 font-bold">Subject</th>
                  <th className="py-2.5 pr-4 text-right font-bold">Total</th>
                  <th className="py-2.5 pr-4 text-right font-bold">Obtained</th>
                  <th className="py-2.5 text-right font-bold">Grade</th>
                </tr>
              </thead>
              <tbody>
                {result.subjects.map((s) => (
                  <tr key={s.subject} className="border-b border-border/50">
                    <td className="py-3 pr-4 font-medium">
                      {s.subject}
                      {s.practical && (
                        <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] font-semibold text-primary">
                          practical
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-right text-muted-foreground">{s.total}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{s.obtained}</td>
                    <td className="py-3 text-right">
                      <span className={s.grade.startsWith("A") ? "font-bold text-primary" : ""}>{s.grade}</span>
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border font-bold">
                  <td className="py-3 pr-4">Total</td>
                  <td className="py-3 pr-4 text-right">{result.total}</td>
                  <td className="py-3 pr-4 text-right text-primary">{result.obtained}</td>
                  <td className="py-3 text-right">{result.grade}</td>
                </tr>
              </tbody>
            </table>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Stat label="Percentage" value={result.percentage} />
              <Stat label="Grade" value={result.grade} gold />
              <Stat label="Marks" value={`${result.obtained}/${result.total}`} />
            </div>

            <div className="no-print mt-8 flex flex-wrap gap-2">
              <Button onClick={() => window.print()} variant="outline" className="h-11 rounded-full">
                <Printer className="mr-1.5 h-4 w-4" aria-hidden /> Print
              </Button>
              <Button
                onClick={() => {
                  const text = `${result.studentName} — ${result.rollNo}: ${result.obtained}/${result.total} (${result.percentage}, ${result.grade}) · GHSS Ghallanai`;
                  if (navigator.share) {
                    navigator.share({ title: "GHSS Ghallanai Result", text }).catch(() => {});
                  } else {
                    navigator.clipboard?.writeText(text);
                  }
                }}
                variant="outline"
                className="h-11 rounded-full"
              >
                <Share2 className="mr-1.5 h-4 w-4" aria-hidden /> Share
              </Button>
              <Button onClick={reset} variant="ghost" className="h-11 rounded-full">
                <RotateCcw className="mr-1.5 h-4 w-4" aria-hidden /> New search
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground no-print">
              SAMPLE data — the exam branch imports official board results through the supervised
              pipeline on result day (Master Plan §7.2).
            </p>
          </div>
        </article>
      )}
    </div>
  );
}

function Stat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${gold ? "border-gold/50 bg-gold-soft/40 dark:bg-gold-soft/20" : "border-border bg-secondary/40"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${gold ? "text-gold-strong dark:text-gold" : "text-primary"}`}>
        {value}
      </p>
    </div>
  );
}
