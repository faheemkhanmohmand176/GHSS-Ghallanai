"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/auth";

/**
 * ADMIN DATA HOOKS — the safe-SQL access layer every console page uses.
 *
 * All reads/writes go through the Supabase query builder / rpc() — never
 * string-interpolated SQL — so every statement is parameterized by
 * construction. RLS (0007) enforces is_admin() server-side; this layer just
 * keeps the UI honest and the code short.
 *
 * DEMO MODE: when Supabase env vars are absent the hooks keep working on
 * local state seeded from static content — the site still runs from a zip.
 */

export interface AdminRow {
  id: string;
}

interface TableOptions<T> {
  table: string;
  demo: T[];
  columns?: string;
  order?: { column: string; ascending?: boolean };
  filter?: (q: import("@supabase/supabase-js").PostgrestFilterBuilder<any, any, any, any, unknown>["then"] extends never ? never : any) => unknown;
  // ^ kept simple: pages pass .eq chains via `modify` below instead
  modify?: (q: any) => any;
}

export function useAdminTable<T extends AdminRow>(opts: {
  table: string;
  demo: T[];
  columns?: string;
  order?: string;
  ascending?: boolean;
  eq?: [string, string];
}) {
  const [rows, setRows] = useState<T[]>(opts.demo);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const table = opts.table;
  const columns = opts.columns;
  const order = opts.order;
  const ascending = opts.ascending;
  const eq = opts.eq;

  const refresh = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let q = sb.from(table).select(columns ?? "*");
    if (eq) q = q.eq(eq[0], eq[1]);
    if (order) q = q.order(order, { ascending: ascending ?? true });
    const { data, error: err } = await q;
    if (err) {
      if (mounted.current) setError(err.message);
    } else if (data && mounted.current) {
      setRows(data as unknown as T[]);
    }
    if (mounted.current) setLoading(false);
  }, [table, columns, order, ascending, eq]);

  useEffect(() => {
    mounted.current = true;
    const t = setTimeout(() => void refresh(), 0);
    return () => {
      clearTimeout(t);
      mounted.current = false;
    };
  }, [refresh]);

  /** Upsert one row (id-less payloads insert). Returns an error string or null. */
  const upsert = useCallback(
    async (row: Partial<T>): Promise<string | null> => {
      const sb = supabaseBrowser();
      if (!sb) return null; // demo mode: caller already updated local state
      const payload = { ...row } as Record<string, unknown>;
      if (!payload.id) delete payload.id;
      const { error: err } = await sb.from(opts.table).upsert(payload);
      if (err) return err.message;
      await refresh();
      return null;
    },
    [opts.table, refresh]
  );

  /** Delete by id. Returns an error string or null. */
  const remove = useCallback(
    async (id: string): Promise<string | null> => {
      const sb = supabaseBrowser();
      if (!sb) return null;
      const { error: err } = await sb.from(opts.table).delete().eq("id", id);
      if (err) return err.message;
      await refresh();
      return null;
    },
    [opts.table, refresh]
  );

  /** Raw builder for page-specific bulk ops (still parameterized). */
  const builder = useCallback(() => supabaseBrowser()?.from(opts.table), [opts.table]);

  return { rows, setRows, loading, error, refresh, upsert, remove, builder, live: Boolean(supabaseBrowser()) };
}

/** Head-count several tables in parallel (admin Overview). */
export async function countRows(table: string, column = "id", filter?: [string, unknown]) {
  const sb = supabaseBrowser();
  if (!sb) return null;
  let q = sb.from(table).select(column, { count: "exact", head: true });
  if (filter) q = q.eq(filter[0], filter[1]);
  const { count } = await q;
  return count ?? 0;
}

/** Fire an admin RPC (e.g. update_admission_status, record_fee_payment). */
export async function callRpc<T = unknown>(fn: string, args: Record<string, unknown>) {
  const sb = supabaseBrowser();
  if (!sb) return { ok: false as const, error: "Demo mode — RPC unavailable." };
  const { data, error } = await sb.rpc(fn, args);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, data: data as T };
}

/** Site analytics via the server-side aggregation RPC (admin-only). */
export interface AnalyticsPayload {
  since: string;
  totals: { views: number; visitors: number };
  daily: { day: string; views: number; visitors: number }[];
  devices: { device: string; count: number }[];
  top_pages: { page: string; views: number; visitors: number }[];
  top_referrers: { referrer: string; count: number }[];
}

export function useSiteAnalytics(days: number) {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    if (!sb) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data: d, error: e } = await sb.rpc("get_site_analytics", { p_days: days });
    if (e) setError(e.message);
    else if (d) setData(d as AnalyticsPayload);
    setLoading(false);
  }, [days]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  return { data, loading, error, reload: load, live: Boolean(supabaseBrowser()) };
}
