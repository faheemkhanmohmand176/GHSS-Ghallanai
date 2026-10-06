"use client";

import { useState } from "react";
import { Upload, FileSpreadsheet, ShieldCheck, Send } from "lucide-react";
import { AdminChrome, AdminDemoBanner, AdminTitle } from "@/components/site/admin-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { TOPPERS, RESULT_TREND } from "@/content/results";

/**
 * Results publishing — the supervised import pipeline (§7.2):
 * official BISE file → CLI validation → two-person confirmation → publish.
 */
export default function AdminResults() {
  const [stage, setStage] = useState(0); // 0 idle, 1 validated, 2 confirmed, 3 published
  const steps = ["Import file", "Validate & checksum", "Two-person confirm", "Publish"];

  function simulateImport() {
    setStage(1);
    toast({ title: "Import validated", description: "1,142 rows · checksum verified · 0 anomalies." });
  }
  function confirm() {
    setStage(2);
    toast({ title: "Confirmed by second officer", description: "Exam branch + principal confirmed counts." });
  }
  function publish() {
    setStage(3);
    toast({
      title: "Results published",
      description: "/results/lookup live · toppers wall updated · WhatsApp broadcast dispatched.",
    });
  }

  return (
    <AdminChrome>
      <AdminDemoBanner />
      <AdminTitle
        title="Results publishing"
        desc="Supervised import replaces fragile manual entry: the exam branch downloads the official board file, a CLI script validates it, two staff members confirm counts, then one click publishes."
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Import pipeline */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-small">
              <FileSpreadsheet className="h-4 w-4 text-primary" aria-hidden /> Import pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={stage * 33.3} className="h-2" aria-label={`Pipeline stage ${stage + 1} of 4`} />
            <ol className="mt-5 space-y-3">
              {steps.map((s, i) => (
                <li key={s} className="flex items-center gap-3">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      i < stage ? "bg-primary text-primary-foreground" : i === stage ? "border-2 border-primary text-primary" : "border border-border text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className={`text-small font-semibold ${i <= stage ? "" : "text-muted-foreground"}`}>{s}</span>
                </li>
              ))}
            </ol>

            <label className="mt-6 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/30 p-8 text-center hover:border-gold">
              <Upload className="h-8 w-8 text-muted-foreground" aria-hidden />
              <span className="text-small font-semibold">Drop the official BISE result file</span>
              <span className="text-xs text-muted-foreground">CSV/XLSX · validated client-side in demo</span>
              <input
                type="file"
                accept=".csv,.xlsx"
                className="absolute inset-0 cursor-pointer opacity-0 sr-only"
                onChange={simulateImport}
              />
            </label>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={confirm} disabled={stage < 1} variant="outline" className="h-11 rounded-full">
                <ShieldCheck className="mr-1.5 h-4 w-4" aria-hidden /> Two-person confirm
              </Button>
              <Button onClick={publish} disabled={stage < 2} className="h-11 rounded-full font-bold">
                <Send className="mr-1.5 h-4 w-4" aria-hidden /> Publish to website
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Toppers preview + trend */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-small">Toppers wall preview</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2.5">
                {TOPPERS.map((t) => (
                  <li key={t.name} className="flex items-center justify-between gap-3 border-b border-border/50 pb-2.5 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate text-small font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.programme} · {t.position}</p>
                    </div>
                    <span className="shrink-0 text-small font-bold text-primary">{t.percentage}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-small">Five-year trend (published)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex h-24 items-end gap-2">
                {RESULT_TREND.map((r) => (
                  <div key={r.year} className="flex flex-1 flex-col items-center gap-1">
                    <div className="w-full rounded-t bg-primary" style={{ height: `${r.passPercent}%` }} aria-hidden />
                    <span className="text-[0.6rem] text-muted-foreground">{r.year}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminChrome>
  );
}
