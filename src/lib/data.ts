import { isSupabaseConfigured } from "@/lib/supabase";
import { getSupabaseServer } from "@/lib/supabase-server";
import { NOTICES, NEWS, type Notice, type NewsPost } from "@/content/news";
import { FACULTY, type FacultyMember as AboutFaculty } from "@/content/about";
import { BOARD_RESULTS, MERIT_LIST, type BoardResult, type MeritRow } from "@/content/results";

/**
 * DATA ACCESS LAYER — Master Plan §8.2/§8.8.
 * Server-side reads: Supabase when configured (with RLS), else static demo content.
 * Public pages consume these in server components — no client-side data fetching
 * waterfalls (performance budget §11.1).
 */

export async function getNotices(limit?: number): Promise<Notice[]> {
  if (isSupabaseConfigured()) {
    try {
      const sb = await getSupabaseServer();
      let q = sb
        .from("notices")
        .select("id, title, body, category, date, pinned")
        .order("pinned", { ascending: false })
        .order("date", { ascending: false });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (!error && data && data.length > 0) return data as Notice[];
    } catch {
      /* fall through to demo content */
    }
  }
  const sorted = [...NOTICES].sort((a, b) =>
    a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.date.localeCompare(a.date)
  );
  return limit ? sorted.slice(0, limit) : sorted;
}

export async function getNews(limit?: number): Promise<NewsPost[]> {
  if (isSupabaseConfigured()) {
    try {
      const sb = await getSupabaseServer();
      let q = sb.from("news_posts").select("*").order("date", { ascending: false });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (!error && data && data.length > 0) return data as NewsPost[];
    } catch {
      /* fall through */
    }
  }
  const sorted = [...NEWS].sort((a, b) => b.date.localeCompare(a.date));
  return limit ? sorted.slice(0, limit) : sorted;
}

export async function getNewsBySlug(slug: string): Promise<NewsPost | null> {
  if (isSupabaseConfigured()) {
    try {
      const sb = await getSupabaseServer();
      const { data } = await sb.from("news_posts").select("*").eq("slug", slug).single();
      if (data) return data as NewsPost;
    } catch {
      /* fall through */
    }
  }
  return NEWS.find((n) => n.slug === slug) ?? null;
}

export async function getFaculty(): Promise<AboutFaculty[]> {
  if (isSupabaseConfigured()) {
    try {
      const sb = await getSupabaseServer();
      const { data, error } = await sb
        .from("faculty")
        .select("*")
        .order("years", { ascending: false });
      if (!error && data && data.length > 0) return data as AboutFaculty[];
    } catch {
      /* fall through */
    }
  }
  return FACULTY as unknown as AboutFaculty[];
}

export async function lookupResult(
  rollNo: string,
  year: number,
  programme: string
): Promise<BoardResult | null> {
  if (isSupabaseConfigured()) {
    try {
      const sb = await getSupabaseServer();
      const { data } = await sb
        .from("board_results")
        .select("*")
        .eq("roll_no", rollNo)
        .eq("year", year)
        .eq("programme", programme)
        .single();
      if (data) return data as BoardResult;
    } catch {
      /* fall through */
    }
  }
  return (
    BOARD_RESULTS.find(
      (r) =>
        r.rollNo.toLowerCase() === rollNo.trim().toLowerCase() &&
        r.year === year &&
        r.programme === programme
    ) ?? null
  );
}

export async function getMeritList(): Promise<MeritRow[]> {
  if (isSupabaseConfigured()) {
    try {
      const sb = await getSupabaseServer();
      const { data, error } = await sb.from("merit_lists").select("*").order("merit_no");
      if (!error && data && data.length > 0) return data as MeritRow[];
    } catch {
      /* fall through */
    }
  }
  return MERIT_LIST;
}
