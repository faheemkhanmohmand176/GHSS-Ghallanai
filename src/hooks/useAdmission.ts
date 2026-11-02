/**
 * useAdmission — shared admission-settings hook.
 *
 * The old direct-form admission funnel (public form, OTP, interviews,
 * challans) was replaced on 01-Nov-2026 by the accurate HED-mirror
 * Inter admission system (see src/lib/interAdmission.ts, the
 * /admission/* routes and Supabase migration 20_inter_admission_hed_mirror.sql).
 *
 * What remains here is the one piece still used site-wide: the
 * admission_settings toggle that drives the NewsTicker "Admissions Open"
 * pill and the admin on/off switch.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

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
}

export function useAdmissionSettings() {
  return useQuery<AdmissionSettings | null>({
    queryKey: ["admission-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admission_settings")
        .select("id, is_open, session_year, open_date, last_date, banner_message, notes, updated_at")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });
}
