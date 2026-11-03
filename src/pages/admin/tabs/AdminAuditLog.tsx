/**
 * AdminAuditLog — the append-only audit log viewer.
 *
 * Reads from public.audit_log via the get_admin_audit_log SECURITY DEFINER
 * RPC (admin-only).  The table itself cannot be UPDATEd or DELETEd by anyone
 * (a trigger always raises — see migration 24).  Only admins can SELECT.
 *
 * Filters: action, actor (admin id), date range, free-text search.  The list
 * is mobile-first: each row is a stacked card on small screens.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { interApi } from "@/lib/interAdmission";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ScrollText, Search as SearchIcon, Loader2, Filter, Download,
} from "lucide-react";

interface AuditRow {
  id: number; actor_id: string | null; actor_email: string | null;
  action: string; target_type: string | null; target_id: string | null;
  summary: string | null; ip: string | null; created_at: string;
}

// Friendly labels for each action so the admin can scan quickly.
const ACTION_LABEL: Record<string, string> = {
  "admin.login":              "Admin sign-in",
  "fee.mark_paid":            "Fee marked paid",
  "fee.mark_rejected":        "Fee payment rejected",
  "application.unlock":       "Application unlocked",
  "application.delete":       "Application deleted",
  "application.status_change":"Status changed",
  "application.allow_new":    "New application allowed",
  "settings.change":          "Admission settings changed",
  "user.role_change":         "User role changed",
  "user.delete":              "User deleted",
  "export.applications":      "Applications exported",
};

const ACTION_OPTIONS = Object.keys(ACTION_LABEL);

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export default function AdminAuditLog() {
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [applied, setApplied] = useState({ action: "", actor: "", from: "", to: "", search: "" });

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin-audit-log", applied],
    queryFn: async () => {
      const res = (await interApi.adminAuditLog({
        action: applied.action || undefined,
        actor: applied.actor || undefined,
        from: applied.from ? new Date(applied.from).toISOString() : undefined,
        to: applied.to ? new Date(applied.to + "T23:59:59").toISOString() : undefined,
        search: applied.search || undefined,
        limit: 200,
        offset: 0,
      })) as unknown as { ok?: boolean; rows?: AuditRow[]; error?: string };
      if (!res?.ok) throw new Error(res?.error || "Could not load audit log.");
      return (res.rows ?? []) as AuditRow[];
    },
    staleTime: 30_000,
  });

  const rows = data ?? [];

  function applyFilters() {
    setApplied({ action, actor, from, to, search });
  }

  function clearFilters() {
    setAction(""); setActor(""); setFrom(""); setTo(""); setSearch("");
    setApplied({ action: "", actor: "", from: "", to: "", search: "" });
  }

  async function handleExport() {
    // Log the export action itself, then download as CSV.
    try {
      await supabase.rpc("log_admin_action", {
        p_action: "export.applications",
        p_target_type: "audit_log",
        p_summary: "Admin exported the audit log (CSV)",
      });
    } catch { /* non-fatal */ }
    const csv = [
      ["id", "created_at", "actor_email", "action", "target_type", "target_id", "summary", "ip"].join(","),
      ...rows.map((r) => [
        r.id, r.created_at, r.actor_email ?? "", r.action,
        r.target_type ?? "", r.target_id ?? "",
        '"' + (r.summary ?? "").replace(/"/g, '""') + '"',
        r.ip ?? "",
      ].join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-primary" />
            Audit Log
          </h1>
          <p className="text-[12.5px] text-muted-foreground mt-0.5">
            Append-only record of every admin action. Nobody can edit or delete rows.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-9">
            {isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Filter className="w-3.5 h-3.5" />}
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0} className="h-9">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border/80">
        <CardContent className="p-4 sm:p-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label className="text-[12px] font-semibold">Action</Label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-2 text-[13px]"
              >
                <option value="">All actions</option>
                {ACTION_OPTIONS.map((a) => <option key={a} value={a}>{ACTION_LABEL[a]}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-[12px] font-semibold">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-9 text-[13px]" />
            </div>
            <div>
              <Label className="text-[12px] font-semibold">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 h-9 text-[13px]" />
            </div>
            <div>
              <Label className="text-[12px] font-semibold">Search</Label>
              <div className="relative mt-1">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") applyFilters(); }}
                  placeholder="summary / target id"
                  className="h-9 pl-8 text-[13px]"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-[13px]">Clear</Button>
            <Button size="sm" onClick={applyFilters} className="h-9 text-[13px]">Apply filters</Button>
          </div>
        </CardContent>
      </Card>

      {/* Rows */}
      <Card className="border-border/80">
        <CardContent className="p-0">
          {isFetching ? (
            <div className="p-4 space-y-2.5">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center">
              <ScrollText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No audit entries match your filters.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((r) => (
                <li key={r.id} className="p-3.5 sm:p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-[11px] font-semibold">
                          {ACTION_LABEL[r.action] ?? r.action}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">{fmtDate(r.created_at)}</span>
                        {r.ip && <span className="text-[10px] text-muted-foreground/70 font-mono hidden sm:inline">IP {r.ip.split(",")[0]}</span>}
                      </div>
                      <p className="text-[13px] text-foreground mt-1 leading-snug">{r.summary || r.action}</p>
                      {r.target_id && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                          {r.target_type ?? "target"}: {r.target_id}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-[11px] text-muted-foreground shrink-0">
                      <p className="font-semibold text-foreground">{r.actor_email || "—"}</p>
                      <p className="font-mono text-[10px]">{r.actor_id ? r.actor_id.slice(0, 8) : ""}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
