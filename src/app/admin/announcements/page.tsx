import { Megaphone, Newspaper, Trophy, Plus, Pin, Eye, Image as ImageIcon } from "lucide-react";
import { AdminTitle, AdminDemoBanner } from "@/components/admin/admin-shell";
import { PageContainer, SectionCard, StatCard, StatGrid, EmptyState } from "@/components/admin/stat-card";
import { NoticesPublishForm } from "@/components/admin/notices-publish-form";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { isSupabaseConfigured } from "@/lib/supabase";
import { NOTICES, NEWS, type NoticeCategory } from "@/content/news";

// ---- Types -----------------------------------------------------------------

interface NoticeRow {
  id: string;
  title: string;
  body: string;
  category: string;
  date: string;
  pinned: boolean;
  published: boolean;
}

interface NewsRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  date: string;
  category: string;
  cover_url: string | null;
  published: boolean;
}

interface AchievementRow {
  id: string;
  title: string;
  student_name: string;
  class_label: string;
  year: number;
  category: string;
  image_url: string | null;
  is_published: boolean;
  is_pinned: boolean;
}

// ---- Demo data -------------------------------------------------------------

const DEMO_NOTICES: NoticeRow[] = NOTICES.map((n) => ({
  id: n.id,
  title: n.title,
  body: n.body,
  category: n.category,
  date: n.date,
  pinned: n.pinned,
  published: true,
}));

const DEMO_NEWS: NewsRow[] = NEWS.map((n) => ({
  id: n.id,
  title: n.title,
  slug: n.slug,
  excerpt: n.excerpt,
  date: n.date,
  category: n.category,
  cover_url: null,
  published: true,
}));

const DEMO_ACHIEVEMENTS: AchievementRow[] = [
  { id: "a1", title: "1st Position — Inter-School Science Quiz", student_name: "Hassan Ali", class_label: "1st Year Pre-Engineering", year: 2026, category: "Science", image_url: null, is_published: true, is_pinned: true },
  { id: "a2", title: "District Debating Championship Winner", student_name: "Maryam Bibi", class_label: "2nd Year Arts", year: 2026, category: "Academic", image_url: null, is_published: true, is_pinned: false },
  { id: "a3", title: "Cricket Team — Regional Runners-Up", student_name: "School Cricket Team", class_label: "School", year: 2026, category: "Sports", image_url: null, is_published: true, is_pinned: false },
  { id: "a4", title: "Programming Circle Hackathon — Best Project", student_name: "Abdul Rahman Khan", class_label: "2nd Year ICS", year: 2026, category: "Science", image_url: null, is_published: true, is_pinned: false },
];

const CATEGORY_TONE: Record<string, string> = {
  admission: "border-primary/40 text-primary",
  exam: "border-gold/40 text-gold-strong",
  result: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  general: "border-muted-foreground/40 text-muted-foreground",
  holiday: "border-rose-500/40 text-rose-600 dark:text-rose-400",
  scholarship: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  Academic: "border-primary/40 text-primary",
  Achievement: "border-gold/40 text-gold-strong",
  Guidance: "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
  Institution: "border-muted-foreground/40 text-muted-foreground",
  Sports: "border-amber-500/40 text-amber-600 dark:text-amber-400",
  Science: "border-violet-500/40 text-violet-700 dark:text-violet-300",
  Art: "border-rose-500/40 text-rose-600 dark:text-rose-400",
  Other: "border-muted-foreground/40 text-muted-foreground",
};

function formatDate(d: string) {
  try {
    return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(d));
  } catch {
    return d;
  }
}

export default async function AdminAnnouncementsPage() {
  let notices: NoticeRow[] = DEMO_NOTICES;
  let news: NewsRow[] = DEMO_NEWS;
  let achievements: AchievementRow[] = DEMO_ACHIEVEMENTS;

  if (isSupabaseConfigured()) {
    try {
      const { getSupabaseServer } = await import("@/lib/supabase-server");
      const sb = await getSupabaseServer();

      const [noticesRes, newsRes, achRes] = await Promise.all([
        sb.from("notices").select("*").is("deleted_at", null).order("pinned", { ascending: false }).order("date", { ascending: false }),
        sb.from("news_posts").select("*").is("deleted_at", null).order("date", { ascending: false }),
        sb.from("achievements").select("*").is("deleted_at", null).order("is_pinned", { ascending: false }).order("year", { ascending: false }).order("created_at", { ascending: false }),
      ]);

      if (!noticesRes.error && noticesRes.data && noticesRes.data.length > 0) {
        notices = (noticesRes.data as any[]).map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body ?? "",
          category: n.category ?? "general",
          date: n.date ?? "",
          pinned: n.pinned ?? false,
          published: n.published ?? true,
        }));
      }
      if (!newsRes.error && newsRes.data && newsRes.data.length > 0) {
        news = (newsRes.data as any[]).map((n) => ({
          id: n.id,
          title: n.title,
          slug: n.slug,
          excerpt: n.excerpt ?? "",
          date: n.date ?? "",
          category: n.category ?? "Institution",
          cover_url: n.cover_url ?? null,
          published: n.published ?? true,
        }));
      }
      if (!achRes.error && achRes.data && achRes.data.length > 0) {
        achievements = (achRes.data as any[]).map((a) => ({
          id: a.id,
          title: a.title,
          student_name: a.student_name ?? "—",
          class_label: a.class ?? "—",
          year: a.year ?? new Date().getFullYear(),
          category: a.category ?? "Academic",
          image_url: a.image_url ?? null,
          is_published: a.is_published ?? true,
          is_pinned: a.is_pinned ?? false,
        }));
      }
    } catch {
      /* fall back to demo */
    }
  }

  const pinnedNotices = notices.filter((n) => n.pinned).length;
  const publishedNews = news.filter((n) => n.published).length;
  const publishedAch = achievements.filter((a) => a.is_published).length;
  const pinnedAch = achievements.filter((a) => a.is_pinned).length;

  return (
    <PageContainer>
      <AdminDemoBanner />
      <AdminTitle
        title="Announcements"
        desc="Publish notices, news articles and student achievements. Each section writes to its own Supabase table with audit logging and is reflected on the public site within 60 seconds."
      />

      <StatGrid className="mb-6">
        <StatCard
          label="Notices"
          value={notices.length}
          hint={`${pinnedNotices} pinned`}
          icon={Megaphone}
          accent="primary"
        />
        <StatCard
          label="News Articles"
          value={news.length}
          hint={`${publishedNews} published`}
          icon={Newspaper}
          accent="gold"
        />
        <StatCard
          label="Achievements"
          value={achievements.length}
          hint={`${publishedAch} published · ${pinnedAch} pinned`}
          icon={Trophy}
          accent="gold"
        />
        <StatCard
          label="Total Reach"
          value={(notices.length + news.length + achievements.length).toLocaleString()}
          hint="Items visible to families"
          icon={Eye}
          accent="primary"
        />
      </StatGrid>

      <Tabs defaultValue="notices">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="notices">Notices</TabsTrigger>
          <TabsTrigger value="news">News</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>

        {/* ============ Notices ============ */}
        <TabsContent value="notices">
          <div className="grid gap-5 lg:grid-cols-3">
            <SectionCard
              title="All Notices"
              description="Latest first · pinned items stay at the top"
              className="lg:col-span-2"
              actions={
                <Button className="h-11 rounded-full font-semibold">
                  <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add Notice
                </Button>
              }
            >
              {notices.length === 0 ? (
                <EmptyState icon={Megaphone} title="No notices yet" description="Publish the first notice using the form." />
              ) : (
                <div className="space-y-2.5">
                  {notices.map((n) => (
                    <div
                      key={n.id}
                      className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border bg-background p-3.5 transition-colors hover:border-primary/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {n.pinned && (
                            <Pin className="h-3.5 w-3.5 text-gold-strong" aria-hidden />
                          )}
                          <p className="font-semibold leading-tight">{n.title}</p>
                          <Badge variant="outline" className={CATEGORY_TONE[n.category] ?? CATEGORY_TONE.Other}>
                            {n.category}
                          </Badge>
                          {!n.published && (
                            <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">
                              Draft
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{n.body}</p>
                        <p className="mt-1.5 text-xs text-muted-foreground">{formatDate(n.date)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch defaultChecked={n.published} aria-label={`Toggle publication for ${n.title}`} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            {/* New notice form */}
            <SectionCard
              title="Publish New Notice"
              description="Goes live on /notices within 60 seconds"
            >
              <NoticesPublishForm />
            </SectionCard>
          </div>
        </TabsContent>

        {/* ============ News ============ */}
        <TabsContent value="news">
          <SectionCard
            title="News Articles"
            description="Longer-form posts with cover images. Each article gets its own page at /notices/[slug]."
            actions={
              <Button className="h-11 rounded-full font-semibold">
                <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add Article
              </Button>
            }
          >
            {news.length === 0 ? (
              <EmptyState icon={Newspaper} title="No news articles yet" description="Publish the first news article." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cover</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {news.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>
                        {n.cover_url ? (
                          <img
                            src={n.cover_url}
                            alt=""
                            className="h-12 w-16 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-16 items-center justify-center rounded-md bg-secondary">
                            <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold">{n.title}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{n.excerpt}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={CATEGORY_TONE[n.category] ?? CATEGORY_TONE.Other}>
                          {n.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{formatDate(n.date)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">/{n.slug}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            n.published
                              ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                              : "border-muted-foreground/40 text-muted-foreground"
                          }
                        >
                          {n.published ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </TabsContent>

        {/* ============ Achievements ============ */}
        <TabsContent value="achievements">
          <SectionCard
            title="Student Achievements"
            description="Honour wall entries — academic, sports, art, science and other categories. Pinned items appear first."
            actions={
              <Button className="h-11 rounded-full font-semibold">
                <Plus className="mr-1.5 h-4 w-4" aria-hidden /> Add Achievement
              </Button>
            }
          >
            {achievements.length === 0 ? (
              <EmptyState icon={Trophy} title="No achievements yet" description="Add the first student achievement." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {achievements.map((a) => (
                  <div
                    key={a.id}
                    className={`flex gap-3 rounded-xl border p-3.5 transition-colors hover:border-primary/30 ${
                      a.is_pinned ? "border-gold/40 bg-gold/5" : "border-border bg-background"
                    }`}
                  >
                    {a.image_url ? (
                      <img src={a.image_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Trophy className="h-6 w-6 text-gold-strong" aria-hidden />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {a.is_pinned && <Pin className="h-3.5 w-3.5 text-gold-strong" aria-hidden />}
                        <p className="font-semibold leading-tight">{a.title}</p>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {a.student_name} · {a.class_label} · {a.year}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline" className={CATEGORY_TONE[a.category] ?? CATEGORY_TONE.Other}>
                          {a.category}
                        </Badge>
                        {!a.is_published && (
                          <Badge variant="outline" className="border-muted-foreground/40 text-muted-foreground">
                            Hidden
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
