// src/hooks/useDrawLookup.ts — BISE Peshawar Exam Duties (Supervisory Draw)
// Talks to /api/bisep-draw (served by api/public-data.js?kind=draw).
import { useMutation, useQuery } from "@tanstack/react-query";

export interface DrawSource { id: string; label: string; session: string; official_page: string }
export interface DrawDetails {
  centerNo?: string; name?: string; designation?: string;
  institute?: string; mobile?: string; appointedAs?: string;
}
export interface DrawResult {
  ok: boolean; error?: string; detail?: string;
  selected?: boolean; details?: DrawDetails; letter?: string | null;
  notes?: string[]; session?: string; source?: string;
  fetched_at?: string; official_page?: string; cached?: boolean;
}
export interface DrawPreviewEntry extends DrawDetails { letter?: string }
export interface DrawPreview {
  ok: boolean; entries?: DrawPreviewEntry[]; fetched_at?: string;
  official_page?: string; error?: string;
}

// Used instantly (no network) and as fallback if the sources call fails.
export const FALLBACK_SOURCES: DrawSource[] = [
  { id: "theory", label: "Theory Duties", session: "SSC Annual-II 2026", official_page: "https://bisep.edu.pk/DrawSSC2026A2/" },
  { id: "practical", label: "Practical Duties", session: "SSC Annual-II 2026", official_page: "https://bisep.edu.pk/DrawSSC2026A2Pract/" },
];

async function getJson<T>(qs: string, timeoutMs = 15000): Promise<T> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(`/api/bisep-draw?${qs}`, { signal: ctl.signal });
    return (await r.json()) as T;
  } finally { clearTimeout(t); }
}

export function useDrawSources() {
  return useQuery({
    queryKey: ["draw-sources"],
    queryFn: async () => {
      const j = await getJson<{ ok: boolean; sources: DrawSource[] }>("mode=sources", 8000);
      return j.ok && j.sources?.length ? j.sources : FALLBACK_SOURCES;
    },
    initialData: FALLBACK_SOURCES,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useDrawLookup() {
  return useMutation({
    mutationFn: async (p: { source: string; by: "cnic" | "mobile"; value: string }) => {
      const qs = new URLSearchParams({ source: p.source, by: p.by, value: p.value }).toString();
      let res = await getJson<DrawResult>(qs);
      // one gentle retry if the board was busy (matches the rest of the site)
      if (!res.ok && res.detail) {
        await new Promise((r) => setTimeout(r, 900));
        res = await getJson<DrawResult>(qs);
      }
      return res;
    },
  });
}

export function useDrawPreview(source: string) {
  return useQuery({
    queryKey: ["draw-preview", source],
    queryFn: () => getJson<DrawPreview>(`mode=preview&source=${encodeURIComponent(source)}`),
    staleTime: 15 * 60_000,
    retry: 1,
  });
}
