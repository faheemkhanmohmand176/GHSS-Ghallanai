/**
 * useAdmission: shared admission settings for the whole site.
 *
 * One source of truth for: open / closed, session year, open and last
 * date, days remaining, processing fee and the school's own payment
 * accounts. The server (migration 21, inter_admission_open) enforces the
 * same rule, so closing admissions locks the whole flow, not just the UI.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PaymentMethod } from "@/hooks/useFees";

export function normalizePhone(phone: string | null | undefined): string {
  return (phone || "").replace(/[^\d+]/g, "");
}

export interface AdmissionSettings {
  id: number;
  is_open: boolean;
  session_year: string;
  open_date: string | null;
  last_date: string | null;
  banner_message: string | null;
  notes: string | null;
  processing_fee: number;
  payment_methods: PaymentMethod[];
  /** Safepay online payment switch (server also needs its env keys). */
  online_payment_enabled: boolean;
  updated_at?: string;
}

export const ADMISSION_SETTINGS_KEY = ["admission-settings"] as const;

export function useAdmissionSettings() {
  return useQuery<AdmissionSettings | null>({
    queryKey: ADMISSION_SETTINGS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admission_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as Record<string, unknown>;
      return {
        ...(row as unknown as AdmissionSettings),
        processing_fee: Number(row.processing_fee ?? 100) || 100,
        payment_methods: Array.isArray(row.payment_methods) ? (row.payment_methods as PaymentMethod[]) : [],
        online_payment_enabled: row.online_payment_enabled !== false,
      };
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}

/** Today's date in Pakistan time as YYYY-MM-DD. */
function todayPk(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Karachi" });
}

function dayDiff(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86400000);
}

export type AdmissionReason = "open" | "closed" | "not_started" | "ended";

export interface AdmissionState {
  open: boolean;
  reason: AdmissionReason;
  /** Days left including today; null when no last date is set. */
  daysLeft: number | null;
  /** Days until opening when a future open date is set. */
  daysToStart: number | null;
  lastDate: string | null;
  openDate: string | null;
}

export function getAdmissionState(s: AdmissionSettings | null | undefined): AdmissionState {
  const base = { daysLeft: null, daysToStart: null, lastDate: s?.last_date ?? null, openDate: s?.open_date ?? null };
  if (!s || !s.is_open) return { ...base, open: false, reason: "closed" };
  const today = todayPk();
  if (s.open_date && today < s.open_date) {
    return { ...base, open: false, reason: "not_started", daysToStart: dayDiff(today, s.open_date) };
  }
  if (s.last_date && today > s.last_date) {
    return { ...base, open: false, reason: "ended" };
  }
  return {
    ...base, open: true, reason: "open",
    daysLeft: s.last_date ? dayDiff(today, s.last_date) + 1 : null,
  };
}

export function formatAdmissionDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** Admission cycle label built from the admin's session year. */
export function cycleLabel(s: AdmissionSettings | null | undefined): string {
  return `F.A / F.Sc Admissions ${s?.session_year || ""}`.trim();
}

/** One printable line per configured school payment account. */
export function describePaymentMethod(m: PaymentMethod): { title: string; lines: string[] } {
  if (m.type === "bank") {
    return {
      title: m.bank_name || "Bank",
      lines: [
        m.account_title ? `Account Title: ${m.account_title}` : "",
        m.account_number ? `Account No: ${m.account_number}` : "",
        m.iban ? `IBAN: ${m.iban}` : "",
      ].filter(Boolean),
    };
  }
  if (m.type === "easypaisa" || m.type === "jazzcash") {
    return {
      title: m.type === "easypaisa" ? "EasyPaisa" : "JazzCash",
      lines: [
        m.account_name ? `Account Name: ${m.account_name}` : "",
        m.phone ? `Mobile No: ${m.phone}` : "",
      ].filter(Boolean),
    };
  }
  if (m.type === "cash") {
    return { title: "Cash at School Office", lines: [m.instructions || "Pay at the school office during working hours."] };
  }
  return { title: m.label || "Other", lines: [m.instructions || ""].filter(Boolean) };
}
