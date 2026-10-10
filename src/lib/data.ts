import { isSupabaseConfigured, getSupabaseServer } from "@/lib/supabase";
import { NOTICES, NEWS, type Notice, type NewsPost } from "@/content/news";
import { FACULTY, type FacultyMember as AboutFaculty } from "@/content/about";
import { BOARD_RESULTS, MERIT_LIST, type BoardResult, type MeritRow } from "@/content/results";
import {
  DEMO_TEACHERS, DEMO_ACHIEVEMENTS, DEMO_EVENTS, DEMO_ALBUMS, DEMO_PHOTOS,
  DEMO_LIBRARY, DEMO_SETTINGS,
  type TeacherRow, type AchievementRow, type EventRow, type GalleryAlbum,
  type GalleryPhoto, type LibraryFileRow, type SchoolSettingsRow,
} from "@/content/demo-content";

/**
 * DATA ACCESS LAYER — Master Plan §8.2/§8.8.
 * Server-side reads: Supabase when configured (with RLS), else static demo content.
 * Public pages consume these in server components — no client-side data fetching
 * waterfalls (performance budget §11.1).
 */

export async function getNotices(limit?: number): Promise<Notice[]> {
  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabaseServer();
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
      const sb = getSupabaseServer();
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
      const sb = getSupabaseServer();
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
      const sb = getSupabaseServer();
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
      const sb = getSupabaseServer();
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
      const sb = getSupabaseServer();
      const { data, error } = await sb.from("merit_lists").select("*").order("merit_no");
      if (!error && data && data.length > 0) return data as MeritRow[];
    } catch {
      /* fall through */
    }
  }
  return MERIT_LIST;
}

// ============================================================================
// ADMIN-CONSOLE READS (0006/0007) — same contract: live rows or demo content.
// All queries are parameterized Supabase-builder reads (safe SQL by design).
// ============================================================================

export async function getTeachers(limit?: number): Promise<TeacherRow[]> {
  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabaseServer();
      let q = sb.from("teachers").select("*").eq("is_active", true).order("display_order");
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (!error && data && data.length > 0) return data as TeacherRow[];
    } catch {
      /* fall through */
    }
  }
  const sorted = [...DEMO_TEACHERS].sort((a, b) => a.display_order - b.display_order);
  return limit ? sorted.slice(0, limit) : sorted;
}

export async function getAchievements(limit?: number): Promise<AchievementRow[]> {
  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabaseServer();
      let q = sb.from("achievements").select("*").order("created_at", { ascending: false });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (!error && data && data.length > 0) return data as AchievementRow[];
    } catch {
      /* fall through */
    }
  }
  return limit ? DEMO_ACHIEVEMENTS.slice(0, limit) : DEMO_ACHIEVEMENTS;
}

export async function getEvents(upcomingOnly = false): Promise<EventRow[]> {
  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabaseServer();
      let q = sb.from("school_events").select("*").eq("is_published", true).order("start_date");
      if (upcomingOnly) q = q.gte("start_date", new Date().toISOString().slice(0, 10));
      const { data, error } = await q;
      if (!error && data && data.length > 0) return data as EventRow[];
    } catch {
      /* fall through */
    }
  }
  const rows = upcomingOnly
    ? DEMO_EVENTS.filter((e) => e.start_date >= new Date().toISOString().slice(0, 10))
    : DEMO_EVENTS;
  return rows;
}

export async function getGallery(): Promise<{ albums: GalleryAlbum[]; photos: GalleryPhoto[] }> {
  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabaseServer();
      const [albumsRes, photosRes] = await Promise.all([
        sb.from("gallery_albums").select("*").order("created_at", { ascending: false }),
        sb.from("gallery_photos").select("*").order("created_at", { ascending: false }),
      ]);
      if (!albumsRes.error && albumsRes.data && albumsRes.data.length > 0) {
        return {
          albums: albumsRes.data as GalleryAlbum[],
          photos: (photosRes.data as GalleryPhoto[]) ?? [],
        };
      }
    } catch {
      /* fall through */
    }
  }
  return { albums: DEMO_ALBUMS, photos: DEMO_PHOTOS };
}

export async function getLibraryFiles(category?: string): Promise<LibraryFileRow[]> {
  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabaseServer();
      let q = sb.from("library_files").select("*").order("created_at", { ascending: false });
      if (category) q = q.eq("category", category);
      const { data, error } = await q;
      if (!error && data && data.length > 0) return data as LibraryFileRow[];
    } catch {
      /* fall through */
    }
  }
  return category ? DEMO_LIBRARY.filter((f) => f.category === category) : DEMO_LIBRARY;
}

/** College Setting row — merged over the static SITE fallback. */
export async function getSchoolSettings(): Promise<SchoolSettingsRow> {
  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabaseServer();
      const { data } = await sb.from("school_settings").select("*").eq("id", 1).maybeSingle();
      if (data) return data as SchoolSettingsRow;
    } catch {
      /* fall through */
    }
  }
  return DEMO_SETTINGS;
}

/** Notices that carry an embedded poll (homepage + notices page). */
export async function getPollNotices(): Promise<Notice[]> {
  const all = await getNotices(10);
  return all.filter((n) => "is_poll" in n && (n as Notice & { is_poll?: boolean }).is_poll);
}

/** Next scheduled board-results publish (homepage countdown strip). */
export async function getScheduledResultPublish(): Promise<{ at: string; label: string } | null> {
  if (isSupabaseConfigured()) {
    try {
      const sb = getSupabaseServer();
      const { data } = await sb
        .from("board_results")
        .select("publish_at, programme, year")
        .eq("published", false)
        .not("publish_at", "is", null)
        .order("publish_at", { ascending: true })
        .limit(1);
      if (data && data.length > 0) {
        const row = data[0] as { publish_at: string; programme: string; year: number };
        return {
          at: row.publish_at,
          label: `${row.programme.replace("-", " ")} ${row.year} results`,
        };
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}
