import { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Newspaper, Search, ChevronLeft, ChevronRight, X, Siren } from "lucide-react";
import PageLayout from "@/components/layout/PageLayout";
import PageBanner from "@/components/shared/PageBanner";
import { useNotices, type Notice } from "@/hooks/useNotices";
import { Skeleton } from "@/components/ui/skeleton";
import TextToSpeechPlayer from "@/components/shared/TextToSpeechPlayer";
import EditorialNoticeCard from "@/components/shared/EditorialNoticeCard";
import NoticePollCard from "@/components/shared/NoticePollCard";

const tabs = ["All", "Urgent", "General", "Academic", "Events"];
const PER_PAGE = 9;

const Notices = () => {
  const { data: allNotices = [], isLoading } = useNotices();
  const [activeTab, setActiveTab] = useState("All");
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [ttsNotice, setTtsNotice] = useState<{ title: string; content: string } | null>(null);

  const filtered = allNotices.filter((n) => {
    const needle = q.trim().toLowerCase();
    if (needle && !`${n.title ?? ""} ${n.content ?? ""}`.toLowerCase().includes(needle)) return false;
    if (activeTab === "All") return true;
    if (activeTab === "Urgent") return n.is_urgent;
    // The admin dashboard saves categories in lowercase ("general", "academic",
    // "events", "urgent") while these tabs are capitalised, so a strict ===
    // never matched and the General/Academic/Events tabs always showed
    // "No notices found". Compare case-insensitively and ignore stray spaces.
    return (n.category || "").trim().toLowerCase() === activeTab.toLowerCase();
  });

  const urgentCount = allNotices.filter((n) => n.is_urgent).length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const openListen = (item: Notice, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setTtsNotice({ title: item.title, content: item.content || item.title });
  };

  return (
    <PageLayout>
      <PageBanner variant="premium" eyebrow="Official Announcements" icon={<Bell className="w-6 h-6" />} title="Notice Board" subtitle="Stay updated with school announcements" />

      {/* ══════════════════════════════════════════
          SECTION — Notices (editorial dispatch style)
         ══════════════════════════════════════════ */}
      <section className="py-8 sm:py-14">
        <div className="container mx-auto px-4">

          {/* ── Editorial header ── */}
          <div className="mb-6 sm:mb-9 text-center">
            <span className="eyebrow">The Dispatch</span>
            <h2 className="section-title !mt-2">
              From <span className="italic lux-gold-text">GHSS Ghallanai</span>
            </h2>
            <div className="luxe-orn mt-3"><i /></div>
            <p className="text-muted-foreground mt-3 text-[13.5px] sm:text-sm leading-relaxed max-w-xl mx-auto">
              Official notices and announcements from our school administration — read or listen, in English or Urdu.
            </p>

            {/* live counters */}
            <div className="mt-4 flex items-center justify-center gap-2.5">
              <span className="luxe-tile-card inline-flex items-center gap-2 !rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold text-foreground">
                <Newspaper className="w-3.5 h-3.5 text-gold" /> {allNotices.length} published
              </span>
              {urgentCount > 0 && (
                <button
                  type="button"
                  onClick={() => { setActiveTab("Urgent"); setPage(1); }}
                  className="inline-flex items-center gap-2 rounded-full border border-[hsl(348_55%_28%/.35)] bg-[hsl(348_55%_28%/.08)] px-3.5 py-1.5 text-[11.5px] font-semibold text-[hsl(348_55%_32%)] dark:text-[hsl(348_70%_72%)] active:scale-[0.97] transition"
                >
                  <Siren className="w-3.5 h-3.5" /> {urgentCount} urgent
                </button>
              )}
            </div>
          </div>

          {/* ── Search ── */}
          <div className="relative mx-auto mb-4 max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search notices…"
              aria-label="Search notices"
              className="h-11 w-full rounded-full border border-gold/30 bg-card pl-11 pr-10 text-[13.5px] shadow-[0_10px_24px_-18px_hsl(var(--primary)/.5)] outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/25"
            />
            {q && (
              <button type="button" aria-label="Clear search" onClick={() => { setQ(""); setPage(1); }}
                className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Tabs — slim pills in ONE swipeable row */}
          <div className="-mx-4 mb-6 sm:mb-9">
            <div
              role="tablist"
              aria-label="Notice categories"
              className="flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:justify-center [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x"
            >
              {tabs.map((tab) => {
                const active = activeTab === tab;
                return (
                  <button
                    key={tab}
                    role="tab"
                    aria-selected={active}
                    onClick={() => { setActiveTab(tab); setPage(1); }}
                    className={`inline-flex h-9 shrink-0 snap-start items-center gap-1.5 rounded-full border px-4 text-[11px] font-bold uppercase tracking-[0.14em] transition-all active:scale-[0.96] ${
                      active
                        ? "bg-gradient-to-b from-[hsl(348_55%_34%)] to-[hsl(348_58%_24%)] text-[hsl(45_40%_96%)] border-[hsl(348_55%_28%)] shadow-[0_10px_20px_-10px_hsl(348_55%_28%/.8)]"
                        : "bg-card text-muted-foreground border-border hover:border-gold/60 hover:text-foreground"
                    }`}
                  >
                    {tab}
                    {tab === "Urgent" && (
                      <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${active ? "bg-[hsl(45_40%_95%)]" : "bg-[hsl(348_55%_38%)]"}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notices grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-56 sm:h-80 rounded-md" />)}
            </div>
          ) : paginated.length === 0 ? (
            <div className="luxe-tile-card text-center py-12 sm:py-16 px-5">
              <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl lux-tile"><Bell className="w-7 h-7" /></span>
              <p className="font-luxe text-2xl font-bold text-foreground">No notices found</p>
              <p className="mt-1 text-sm text-muted-foreground">{q ? "Try a different search word." : "Please check back soon."}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {paginated.map((item, i) => (
                item.is_poll ? (
                  <NoticePollCard key={item.id} item={item} index={i} />
                ) : (
                  <EditorialNoticeCard
                    key={item.id}
                    item={item}
                    index={i}
                    onListen={(it, e) => openListen(it, e)}
                  />
                )
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-8 sm:mt-12">
              <button type="button" aria-label="Previous page" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-9 w-9 rounded-full border border-border bg-card text-muted-foreground flex items-center justify-center disabled:opacity-40 hover:border-gold/60 transition">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  aria-current={page === i + 1 ? "page" : undefined}
                  className={`h-9 min-w-9 px-2 rounded-full text-xs font-bold transition-all border ${
                    page === i + 1
                      ? "bg-gradient-to-b from-[hsl(348_55%_34%)] to-[hsl(348_58%_24%)] text-[hsl(45_40%_96%)] border-[hsl(348_55%_28%)] shadow-md"
                      : "bg-card text-muted-foreground border-border hover:border-gold/60 hover:text-foreground"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button type="button" aria-label="Next page" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-9 w-9 rounded-full border border-border bg-card text-muted-foreground flex items-center justify-center disabled:opacity-40 hover:border-gold/60 transition">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Back to top link */}
          <div className="text-center mt-8 sm:mt-12">
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← Back to home
            </Link>
          </div>
        </div>
      </section>

      {ttsNotice && (
        <TextToSpeechPlayer
          text={ttsNotice.content}
          title={ttsNotice.title}
          onClose={() => setTtsNotice(null)}
        />
      )}
    </PageLayout>
  );
};

export default Notices;
