import type { Metadata } from "next";
import Link from "next/link";
import { FileText, GraduationCap, Search } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lookupByCode, lookupByRollNo } from "./_lib/data";
import type { ReportCard } from "./_lib/demo";
import { ReportCardView } from "./_components/report-card-view";

export const metadata: Metadata = {
  title: "Report Card — Annual Examination · 1st Year & 2nd Year",
  description:
    "Look up the GHSS Ghallanai intermediate annual examination report card by exam roll number or report card code — full subject-wise card, printable and shareable.",
  alternates: { languages: { ur: "/ur/results" } },
};

interface ReportCardPageProps {
  searchParams: Promise<{
    rollNo?: string;
    code?: string;
  }>;
}

export default async function ReportCardPage({ searchParams }: ReportCardPageProps) {
  const params = await searchParams;
  const rollNo = params.rollNo?.trim();
  const code = params.code?.trim();

  let result: ReportCard | null = null;
  let searchedBy: "roll" | "code" | null = null;
  let query = "";
  let notFound = false;

  if (rollNo) {
    searchedBy = "roll";
    query = rollNo;
    result = await lookupByRollNo(rollNo);
    if (!result) notFound = true;
  } else if (code) {
    searchedBy = "code";
    query = code;
    result = await lookupByCode(code);
    if (!result) notFound = true;
  }

  const defaultTab = searchedBy === "code" ? "code" : "roll";

  return (
    <>
      <PageHeader
        kicker="Results · Report Card"
        title={
          <>
            Report <span className="text-gold">Card</span>
          </>
        }
        lead="Annual Examination · 1st Year & 2nd Year. Look up the full subject-wise report card by exam roll number (from your roll slip) or by report card code — printable, shareable, official."
        breadcrumbs={[
          { name: "Results", href: "/results" },
          { name: "Report Card", href: "/results/report-card" },
        ]}
      />

      <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
        {/* Print stylesheet — isolate the report card when the user prints */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @media print {
                body * { visibility: hidden !important; }
                .report-card, .report-card * { visibility: visible !important; }
                .report-card {
                  position: absolute !important;
                  top: 0; left: 0;
                  width: 100%;
                  box-shadow: none !important;
                  border-radius: 0 !important;
                }
                .no-print { display: none !important; }
              }
            `,
          }}
        />

        {result ? (
          <ReportCardView result={result} />
        ) : (
          <div className="space-y-6">
            {notFound && (
              <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-6 text-center">
                <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Search className="h-5 w-5 text-muted-foreground" aria-hidden />
                </div>
                <h3 className="mt-3 text-h3 font-display font-bold">No report card found</h3>
                <p className="mx-auto mt-2 max-w-md text-small text-muted-foreground">
                  We could not find a published report card for{" "}
                  <strong className="font-mono">{query}</strong>. Check the value against your roll
                  slip or report card print-out and try again.
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
              <div className="mb-6 flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary">
                  <FileText className="h-5 w-5 text-primary" strokeWidth={1.75} aria-hidden />
                </span>
                <div>
                  <h2 className="text-h3 font-display font-bold">Find your report card</h2>
                  <p className="mt-1 text-small text-muted-foreground">
                    Choose how you&apos;d like to look up the result. Either field works — the
                    subject-wise card opens instantly, ready to print or share.
                  </p>
                </div>
              </div>

              <Tabs defaultValue={defaultTab}>
                <TabsList className="h-auto w-full justify-stretch rounded-full bg-secondary p-1 sm:w-auto">
                  <TabsTrigger
                    value="roll"
                    className="h-9 flex-1 rounded-full px-5 text-sm font-semibold data-[state=active]:bg-background sm:flex-none"
                  >
                    By Roll Number
                  </TabsTrigger>
                  <TabsTrigger
                    value="code"
                    className="h-9 flex-1 rounded-full px-5 text-sm font-semibold data-[state=active]:bg-background sm:flex-none"
                  >
                    By Report Card Code
                  </TabsTrigger>
                </TabsList>

                {/* Tab 1 — By exam roll number */}
                <TabsContent value="roll" className="mt-6">
                  <form
                    method="get"
                    action="/results/report-card"
                    className="space-y-4"
                    noValidate
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="rollNo" className="text-small font-semibold">
                        Exam roll number
                      </Label>
                      <Input
                        id="rollNo"
                        name="rollNo"
                        defaultValue={searchedBy === "roll" ? query : ""}
                        placeholder="e.g. 100000"
                        className="h-12 text-base font-mono"
                        autoComplete="off"
                        inputMode="numeric"
                        pattern="[0-9]+"
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        The 6-digit number printed on your exam roll slip — e.g.{" "}
                        <span className="font-mono">100000</span>.
                      </p>
                    </div>
                    <Button type="submit" className="h-11 rounded-full font-semibold">
                      <Search className="mr-1.5 h-4 w-4" aria-hidden /> Search by Roll Number
                    </Button>
                  </form>
                </TabsContent>

                {/* Tab 2 — By report card code */}
                <TabsContent value="code" className="mt-6">
                  <form
                    method="get"
                    action="/results/report-card"
                    className="space-y-4"
                    noValidate
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="code" className="text-small font-semibold">
                        Report card code
                      </Label>
                      <Input
                        id="code"
                        name="code"
                        defaultValue={searchedBy === "code" ? query : ""}
                        placeholder="e.g. GHSS-2026-001"
                        className="h-12 text-base font-mono uppercase"
                        autoComplete="off"
                        maxLength={12}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        The 12-character code printed on the official report card — format{" "}
                        <span className="font-mono">GHSS-YYYY-NNN</span>.
                      </p>
                    </div>
                    <Button type="submit" className="h-11 rounded-full font-semibold">
                      <Search className="mr-1.5 h-4 w-4" aria-hidden /> Search by Code
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="mt-8 rounded-lg border border-dashed border-border bg-secondary/30 p-4">
                <p className="flex items-center gap-1.5 text-small font-semibold text-foreground">
                  <GraduationCap className="h-4 w-4 text-primary" aria-hidden />
                  SAMPLE data — try these:
                </p>
                <ul className="mt-2 grid gap-1.5 text-small text-muted-foreground sm:grid-cols-2">
                  <li>
                    Roll <span className="font-mono">100000</span> — Muhammad Hamza Khan (1st Year ICS, class topper)
                  </li>
                  <li>
                    Roll <span className="font-mono">100004</span> — Hassan Raza (2nd Year Pre-Medical, school topper)
                  </li>
                  <li>
                    Roll <span className="font-mono">100002</span> — Bilal Ahmed (1st Year Pre-Engineering, compartment)
                  </li>
                  <li>
                    Code <span className="font-mono">GHSS-2026-002</span> — Hassan Raza (by code)
                  </li>
                </ul>
              </div>
            </div>

            {/* Cross-link to the roll-numbers page if the user doesn't have a roll number */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <p className="kicker">Don&apos;t have a roll number?</p>
              <h3 className="mt-2 text-h3 font-display font-bold">Find your roll slip first</h3>
              <p className="mt-2 text-small text-muted-foreground">
                If you don&apos;t yet know your exam roll number, look it up by class and full name
                on the public roll-numbers page — your slip will display the exam roll number to
                enter here.
              </p>
              <Button asChild variant="outline" className="mt-4 h-11 rounded-full font-semibold">
                <Link href="/results/roll-numbers" prefetch>
                  Go to Roll Numbers Lookup →
                </Link>
              </Button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
