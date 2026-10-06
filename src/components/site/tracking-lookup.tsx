"use client";

import { useState } from "react";
import { CheckCircle2, Clock3, Search, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const FLOW = ["received", "review", "shortlisted", "offered", "admitted"];
const LABELS: Record<string, string> = { received: "Received", review: "Under review", shortlisted: "Shortlisted", offered: "Offer issued", admitted: "Admitted", rejected: "Rejected" };

export function TrackingLookup() {
  const [id, setId] = useState("");
  const [record, setRecord] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  async function lookup(e: React.FormEvent) {
    e.preventDefault(); setMessage(""); setRecord(null); setLoading(true);
    try {
      const response = await fetch(`/api/admissions/track?application_id=${encodeURIComponent(id.trim())}`);
      const result = await response.json();
      if (response.ok) setRecord(result.application);
      else {
        const raw = localStorage.getItem("ghss-demo-applications");
        const local = raw ? JSON.parse(raw) : [];
        const found = local.find((a: any) => a.applicationNo.toLowerCase() === id.trim().toLowerCase());
        if (found) setRecord({ application_no: found.applicationNo, full_name: found.fullName, programme: found.programme, admission_type: found.admissionType, status: "received", created_at: found.createdAt, demo: true });
        else setMessage(result.error ?? "No application was found for that tracking ID.");
      }
    } catch { setMessage("The tracking service could not be reached. Please try again."); } finally { setLoading(false); }
  }
  const current = record ? FLOW.indexOf(record.status) : -1;
  return <div className="space-y-6"><form onSubmit={lookup} className="rounded-2xl border border-border bg-card p-5 sm:p-8"><h2 className="text-h3">Application tracking ID</h2><p className="mt-2 text-small text-muted-foreground">Use the ID printed on the receipt, for example GHSS-2026-0001.</p><div className="mt-5 flex flex-col gap-3 sm:flex-row"><Input value={id} onChange={(e) => setId(e.target.value)} placeholder="GHSS-2026-0001" className="h-11 flex-1 font-mono uppercase" aria-label="Application tracking ID" /><Button type="submit" disabled={loading || !id.trim()} className="h-11 rounded-full px-6"><Search className="mr-1.5 h-4 w-4" />{loading ? "Searching…" : "Search"}</Button></div>{message && <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-small font-semibold text-destructive" role="alert">{message}</p>}</form>{record && <div className="rounded-2xl border border-border bg-card p-5 sm:p-8"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="kicker">Application status</p><h2 className="mt-2 text-h2">{record.full_name || "Applicant"}</h2><p className="mt-1 text-small text-muted-foreground">{String(record.programme).replaceAll("-", " ")} · {record.admission_type === "second_year" ? "2nd year" : "1st year"}</p></div><Badge variant="outline" className={record.status === "rejected" ? "border-destructive/40 text-destructive" : "border-primary/40 text-primary"}>{LABELS[record.status] ?? record.status}</Badge></div>{record.status === "rejected" ? <div className="mt-8 flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4"><XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" /><p className="text-small">The office has marked this application as not selected for the current stage. Contact the school office for the decision note and next available option.</p></div> : <ol className="mt-8 space-y-0">{FLOW.map((status, i) => { const complete = i <= current; const active = i === current; return <li key={status} className="relative flex gap-4 pb-7 last:pb-0"><div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${complete ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}>{complete ? <CheckCircle2 className="h-5 w-5" /> : <Clock3 className="h-4 w-4" />}</div>{i < FLOW.length - 1 && <span className={`absolute left-[17px] top-9 h-full w-0.5 ${i < current ? "bg-primary" : "bg-border"}`} /> }<div className="pt-1"><p className={`text-small font-bold ${active ? "text-primary" : ""}`}>{LABELS[status]}</p><p className="mt-0.5 text-xs text-muted-foreground">{status === "received" ? "Your form and required documents were received." : status === "review" ? "The office is checking marks, documents and programme eligibility." : status === "shortlisted" ? "You may be called for an admission test or interview." : status === "offered" ? "An offer has been issued; follow the office instructions for fee deposit." : "Complete fee deposit and enrolment to join the session."}</p></div></li>; })}</ol>}{record.demo && <p className="mt-6 rounded-lg border border-gold/40 bg-gold-soft/30 px-4 py-3 text-xs text-muted-foreground dark:bg-gold-soft/20">Demo tracking record — live applications are read from Supabase after the SQL migration is applied.</p>}</div>}</div>;
}
