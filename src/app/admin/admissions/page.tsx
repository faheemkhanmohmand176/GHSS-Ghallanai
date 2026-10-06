"use client";

import { useState } from "react";
import { ChevronRight, BadgeCheck, Search } from "lucide-react";
import { AdminChrome, AdminDemoBanner, AdminTitle } from "@/components/site/admin-chrome";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { DEMO_ADMISSIONS_QUEUE } from "@/content/portal";

/**
 * Admissions review queue (§7.1): filterable list, eligibility flags,
 * status machine (received → review → shortlisted → offered/admitted/rejected),
 * every change audit-logged.
 */
const STATUS_FLOW: Record<string, string[]> = {
  received: ["review", "rejected"],
  review: ["shortlisted", "rejected"],
  shortlisted: ["offered", "rejected"],
  offered: ["admitted", "rejected"],
  admitted: [],
  rejected: [],
};

export default function AdminAdmissions() {
  const [queue, setQueue] = useState(DEMO_ADMISSIONS_QUEUE);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const visible = queue.filter(
    (a) =>
      (filter === "all" || a.status === filter) &&
      (search === "" ||
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.no.toLowerCase().includes(search.toLowerCase()))
  );

  function advance(no: string, next: string) {
    setQueue((q) => q.map((a) => (a.no === no ? { ...a, status: next as typeof a.status } : a)));
    toast({
      title: `Status → ${next}`,
      description: `${no} moved to ${next}. Audit row written · WhatsApp status alert queued (§7.6).`,
    });
  }

  return (
    <AdminChrome>
      <AdminDemoBanner />
      <AdminTitle
        title="Admissions review queue"
        desc="Applications filterable by programme, status and date. Eligibility flags are computed from submitted matric marks; every status change writes an audit row."
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or application no…"
            className="h-11 pl-10"
            aria-label="Search applications"
          />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="h-11 w-40" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["all", "received", "review", "shortlisted", "offered", "admitted", "rejected"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-3 pr-4 font-semibold">Application</th>
                  <th className="py-3 pr-4 font-semibold">Candidate</th>
                  <th className="py-3 pr-4 font-semibold">Programme</th>
                  <th className="py-3 pr-4 text-right font-semibold">Matric</th>
                  <th className="py-3 pr-4 font-semibold">Flags</th>
                  <th className="py-3 pr-4 font-semibold">Status</th>
                  <th className="py-3 font-semibold text-right">Advance</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => {
                  const nexts = STATUS_FLOW[a.status] ?? [];
                  return (
                    <tr key={a.no} className="border-b border-border/40 last:border-0">
                      <td className="py-3.5 pr-4 font-mono text-xs text-muted-foreground">{a.no}</td>
                      <td className="py-3.5 pr-4 font-semibold">{a.name}</td>
                      <td className="py-3.5 pr-4 text-muted-foreground">{a.programme}</td>
                      <td className="py-3.5 pr-4 text-right font-semibold">{a.percent}</td>
                      <td className="py-3.5 pr-4">
                        {a.flags ? (
                          <span className="rounded-full bg-gold-soft px-2.5 py-1 text-xs font-semibold text-gold-strong dark:text-gold">
                            {a.flags}
                          </span>
                        ) : (
                          <BadgeCheck className="h-4.5 w-4.5 text-primary" aria-label="No flags" />
                        )}
                      </td>
                      <td className="py-3.5 pr-4">
                        <Badge
                          variant="outline"
                          className={
                            a.status === "rejected"
                              ? "border-destructive/40 text-destructive"
                              : a.status === "admitted"
                                ? "border-primary/40 text-primary"
                                : ""
                          }
                        >
                          {a.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 text-right">
                        {nexts.length > 0 ? (
                          <div className="inline-flex gap-1.5">
                            {nexts.map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => advance(a.no, n)}
                                className={`h-9 rounded-full px-3.5 text-xs font-bold ${
                                  n === "rejected"
                                    ? "border border-destructive/40 text-destructive hover:bg-destructive/10"
                                    : "bg-primary text-primary-foreground hover:opacity-90"
                                }`}
                              >
                                {n === "rejected" ? "Reject" : n}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-small text-muted-foreground">
                      No applications match the current filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-small">Publish merit list</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-small text-muted-foreground">
              One click generates the ranked list from admitted-mark applications against seat
              quotas, posts it to /results/merit-list, regenerates the sitemap entry, and triggers
              the WhatsApp broadcast (§7.1).
            </p>
            <Button
              onClick={() =>
                toast({
                  title: "Merit list published (demo)",
                  description: "HTML + PDF generated · sitemap pinged · 146 WhatsApp notifications dispatched.",
                })
              }
              className="mt-4 h-11 rounded-full font-bold"
            >
              Generate &amp; publish <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-small">Review flow</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2.5 text-small text-muted-foreground">
              {[
                "received — form submitted, documents verified by the office",
                "review — marks checked against stream eligibility",
                "shortlisted — called for test/interview where applicable",
                "offered → admitted — fee deposit and enrolment complete",
                "rejected — with reason; retained two sessions (§11.4)",
              ].map((s, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </AdminChrome>
  );
}
