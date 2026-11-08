import { useState, useCallback, useRef, useEffect, memo, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LogOut, Menu, X, ExternalLink, Moon, Sun, type LucideIcon,
  LayoutDashboard, Settings2, UserPlus, Trophy, CalendarDays, Ticket,
  Armchair, Medal, GraduationCap, Clock, Megaphone, Library, ShieldCheck,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { pingDispatch } from "@/lib/push";
import { useAuth } from "@/hooks/useAuth";
import { useDarkMode } from "@/hooks/useDarkMode";
import { cn } from "@/lib/utils";
import { ADMIN_ICONS, type AdminIconName } from "@/components/admin/AdminIcons";

// ── Nav structure with sections ───────────────────────────────────────────────
interface NavItem {
  id: string;
  label: string;
  short: string;
  icon: LucideIcon;
}
interface NavSection {
  heading: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    heading: "OVERVIEW",
    items: [
      { id: "overview",          label: "Overview",              short: "Home", icon: LayoutDashboard },
      { id: "settings",          label: "School Settings",       short: "Setup", icon: Settings2 },
    ],
  },
  {
    heading: "STUDENTS",
    items: [
      { id: "admissions",    label: "Admissions",          short: "Admit", icon: UserPlus },
      { id: "results",       label: "Manage Results",      short: "Results", icon: Trophy },
    ],
  },
  {
    heading: "EXAMS",
    items: [
      { id: "exam-date-sheet",  label: "Exam Date Sheet",   short: "Dates", icon: CalendarDays },
      { id: "exam-rolls",       label: "Exam Roll Numbers", short: "Rolls", icon: Ticket },
      { id: "exam-seating",     label: "Exam Seating",      short: "Seats", icon: Armchair },
      { id: "merit-list",       label: "Merit List",        short: "Merit", icon: Medal },
    ],
  },
  {
    heading: "SCHOOL",
    items: [
      { id: "teachers",       label: "Manage Teachers",   short: "Staff", icon: GraduationCap },
      { id: "timetables",     label: "Timetables",        short: "Time", icon: Clock },
      { id: "announcements",  label: "Notices",           short: "Notices", icon: Megaphone },
      { id: "library",        label: "Library",           short: "Library", icon: Library },
    ],
  },
  {
    heading: "ADMIN ACCESS",
    items: [
      { id: "users",  label: "Manage Users", short: "Users", icon: ShieldCheck },
    ],
  },
];

// Flat list for searching
const allNavItems: NavItem[] = navSections.flatMap(s => s.items);

// First few items for the mobile bottom bar quick-access row
const bottomBarItems: NavItem[] = allNavItems.slice(0, 4);

// ── PERFORMANCE: NavBtn + SectionedNav are defined OUTSIDE the parent ────────
// Previously these were defined INSIDE <AdminLayout>, which meant every
// render of the parent (e.g. typing in the search box, opening the mobile
// sidebar) created NEW component identities for NavBtn and SectionedNav.
// React then unmounted + remounted every single nav button on every render
// → focus loss, layout thrash, visible jank, and slow search filtering.
// Moving them outside + wrapping NavBtn in memo() means React can now skip
// re-rendering buttons whose props haven't changed. Pure refactor — the DOM
// output is byte-identical to before.
/** Full-colour SVG icon for a nav item (falls back to nothing if the id is unknown). */
const NavIcon = ({ id, className }: { id: string; className?: string }) => {
  const Cmp = ADMIN_ICONS[id as AdminIconName];
  return Cmp ? <Cmp className={className} /> : null;
};

type NavBtnProps = {
  item: NavItem;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onItemClick?: () => void;
};
const NavBtn = memo(({ item, activeTab, onTabChange, onItemClick }: NavBtnProps) => {
  const isActive = activeTab === item.id;
  return (
    <button
      key={item.id}
      data-active={isActive ? "true" : "false"}
      onClick={() => { onTabChange(item.id); onItemClick?.(); }}
      className={cn(
        "group relative w-full flex items-center gap-3 rounded-lg pl-4 pr-3 py-1.5 min-h-[2.5rem] text-[13px] font-medium tracking-[0.01em] transition-all duration-200",
        isActive
          ? "bg-gradient-to-r from-primary via-primary to-primary-light text-primary-foreground ring-1 ring-inset ring-white/10 shadow-[0_8px_20px_-8px_hsl(144_61%_20%/0.5)]"
          : "hover:bg-secondary/80 text-foreground",
      )}
    >
      {/* gold active rail — hairline with a soft heritage-gold glow */}
      <span
        aria-hidden
        className={cn(
          "absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full transition-all duration-200",
          isActive ? "bg-[hsl(43_89%_58%)] shadow-[0_0_8px_hsl(43_89%_58%/0.75)] opacity-100" : "opacity-0",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
          isActive
            ? "bg-white/95 ring-1 ring-inset ring-white/40 shadow-sm"
            : "bg-muted/60 ring-1 ring-inset ring-border/60 group-hover:bg-muted",
        )}
      >
        <NavIcon id={item.id} className="h-[19px] w-[19px]" />
      </span>
      <span className="admin-nav-label min-w-0 flex-1 text-left leading-tight break-words">{item.label}</span>
      <span
        aria-hidden
        className={cn(
          "ml-auto h-1.5 w-1.5 shrink-0 rotate-45 transition-all duration-200",
          isActive ? "bg-[hsl(43_85%_62%)] opacity-100" : "bg-[hsl(43_70%_45%)] opacity-0 group-hover:opacity-70",
        )}
      />
    </button>
  );
});
NavBtn.displayName = "NavBtn";

type SectionedNavProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onItemClick?: () => void;
};
const SectionedNav = memo(({ activeTab, onTabChange, onItemClick }: SectionedNavProps) => (
  <div className="space-y-5">
    {navSections.map(section => (
      <div key={section.heading}>
        <p className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground/80 tracking-[0.16em] uppercase px-3 mb-1.5">
          <span aria-hidden className="h-px w-3 rounded-full bg-gradient-to-r from-[hsl(43_89%_58%/0.7)] to-transparent" />
          {section.heading}
        </p>
        <div className="space-y-1">
          {section.items.map(item => <NavBtn key={item.id} item={item} activeTab={activeTab} onTabChange={onTabChange} onItemClick={onItemClick} />)}
        </div>
      </div>
    ))}
  </div>
));
SectionedNav.displayName = "SectionedNav";

/* ── Footer actions: Main Website + Sign Out on ONE line (desktop + mobile) ─── */
const SidebarFooter = ({ onItemClick, onSignOut }: { onItemClick?: () => void; onSignOut: () => void }) => (
  <div className="px-3 py-2 border-t border-border/60 bg-card">
    <div className="grid grid-cols-2 gap-2">
      <Link
        to="/"
        onClick={onItemClick}
        className="flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-primary/20 bg-primary/5 px-2 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
      >
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Main Website</span>
      </Link>
      <button
        onClick={onSignOut}
        className="flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-destructive/20 bg-destructive/5 px-2 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
      >
        <LogOut className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">Sign Out</span>
      </button>
    </div>
  </div>
);

/* ── Sidebar shell (desktop rail) ───────────────────────────────────────────── */
const SidebarInner = ({
  activeTab, onTabChange, onItemClick, onSignOut,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onItemClick?: () => void;
  onSignOut: () => void;
}) => (
  <>
    {/* Brand */}
    <div className="relative overflow-hidden border-b border-border/60 px-5 py-5">
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute -left-10 -bottom-10 h-24 w-24 rounded-full bg-[hsl(43_89%_58%/0.10)] blur-2xl" />
      <Link to="/" className="relative flex items-center gap-3">
        <div className="relative">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl ring-2 ring-primary/15 shadow-md">
            <img src="/icon-512.png" alt="GHSS Ghallanai logo" className="h-full w-full object-cover" />
          </div>
          <span aria-hidden className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-emerald-500" />
        </div>
        <div className="min-w-0">
          <span className="block truncate font-heading text-[15px] font-bold leading-tight text-foreground">GHSS Ghallanai</span>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(43_89%_40%)]">Admin Panel</p>
        </div>
      </Link>
    </div>

    <nav className="flex-1 overflow-y-auto px-3 py-4 admin-nav-scroll">
      <SectionedNav activeTab={activeTab} onTabChange={onTabChange} onItemClick={onItemClick} />
    </nav>

    <SidebarFooter onItemClick={onItemClick} onSignOut={onSignOut} />
  </>
);

interface AdminLayoutProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}

const AdminLayout = ({ activeTab, onTabChange, children }: AdminLayoutProps) => {
  const { profile, signOut } = useAuth();

  // Web Push: whenever any admin action (publish notice/results/merit list/
  // roll slips/date sheet, change an application status…) succeeds, ask the
  // server to announce whatever is newly public. Debounced; the server is
  // idempotent so repeated pings never double-notify.
  const queryClientForPush = useQueryClient();
  useEffect(() => {
    let timer: number | undefined;
    const unsub = queryClientForPush.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success") {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => pingDispatch("admin"), 2500);
      }
    });
    return () => { unsub(); window.clearTimeout(timer); };
  }, [queryClientForPush]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mobileNavRef = useRef<HTMLElement>(null);
  const [bottomHidden, setBottomHidden] = useState(false);
  const bottomLastScrollYRef = useRef(0);
  const bottomHiddenRef = useRef(false);
  const bottomRafRef = useRef(0);
  const navigate = useNavigate();
  // PERF: rAF-coalesced — one pass per animation frame at most, and the
  // state is only written when the value actually flips (React then bails
  // out of re-rendering the layout for no-op scrolls).
  useEffect(() => {
    bottomLastScrollYRef.current = window.scrollY;
    const onScrollPass = () => {
      bottomRafRef.current = 0;
      const y = window.scrollY;
      const delta = y - bottomLastScrollYRef.current;
      let next: boolean;
      if (y <= 64 || delta < -4) next = false;
      else if (delta > 4) next = true;
      else next = bottomHiddenRef.current;
      bottomLastScrollYRef.current = y;
      if (next !== bottomHiddenRef.current) {
        bottomHiddenRef.current = next;
        setBottomHidden(next);
      }
    };
    const onScroll = () => {
      if (bottomRafRef.current) return;
      bottomRafRef.current = requestAnimationFrame(onScrollPass);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (bottomRafRef.current) cancelAnimationFrame(bottomRafRef.current);
    };
  }, []);
  const { isDark, toggle } = useDarkMode();

  useEffect(() => {
    if (!sidebarOpen) return;
    requestAnimationFrame(() => {
      const nav = mobileNavRef.current;
      if (!nav) return;
      const active = nav.querySelector('[data-active="true"]') as HTMLElement | null;
      if (active) {
        const top = active.offsetTop - nav.clientHeight / 2 + active.clientHeight / 2;
        nav.scrollTop = Math.max(0, top);
      }
    });
  }, [sidebarOpen]);

  const handleSignOut = async () => { await signOut(); navigate("/"); };

  const initials = profile?.full_name
    ?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "A";

  const activeLabel = allNavItems.find(n => n.id === activeTab)?.label || "Admin Dashboard";
  const activeSection = navSections.find(s => s.items.some(i => i.id === activeTab))?.heading || "Panel";

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-[264px] bg-card border-r border-border/70 shrink-0 sticky top-0 h-screen">
        <SidebarInner
          activeTab={activeTab} onTabChange={onTabChange}
          onSignOut={handleSignOut}
        />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Top header — breadcrumb + actions */}
        <header className="sticky top-0 z-40 bg-card/90 border-b border-border/60 flex items-center h-14 px-3 sm:px-4 gap-2 sm:gap-3">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-xl hover:bg-secondary text-foreground transition-colors" aria-label="Open menu">
            <Menu className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="hidden sm:block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80 leading-none">{activeSection}</p>
            <h1 className="truncate font-heading font-bold text-foreground text-[15px] sm:text-base leading-tight">{activeLabel}</h1>
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button onClick={toggle} className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary" title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            {/* Sign out lives in the sidebar on desktop; header copy only below lg */}
            <button onClick={handleSignOut} aria-label="Sign Out" className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 lg:hidden">
              <LogOut className="h-3.5 w-3.5" />
            </button>
            {/* Desktop profile chip */}
            <div className="hidden lg:flex items-center gap-2.5 pl-3 ml-1 border-l border-border/70">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-primary/15" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary ring-2 ring-primary/15">{initials}</div>
              )}
              <div className="min-w-0 leading-tight">
                <p className="max-w-[160px] truncate text-[13px] font-semibold text-foreground">{profile?.full_name || "Admin"}</p>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Administrator</p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4 md:p-6 pb-24 lg:pb-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>

      {/* Mobile bottom bar */}
      <div className={`lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 border-t border-border/70 shadow-[0_-8px_24px_-16px_hsl(var(--primary)/0.28)] transition-transform duration-300 ease-out ${bottomHidden ? "translate-y-full" : "translate-y-0"}`} style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="flex items-center justify-around py-1.5">
          {bottomBarItems.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                aria-label={item.label}
                className={`admin-dock-item relative flex flex-col items-center justify-center gap-0.5 px-2.5 py-2 min-w-[3.4rem] rounded-lg transition-all duration-200 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                aria-current={isActive ? "page" : undefined}
              >
                {isActive && <span aria-hidden className="absolute -top-1.5 h-1 w-7 rounded-full bg-[hsl(43_89%_58%)] shadow-[0_0_10px_hsl(43_89%_58%/0.8)]" />}
                <NavIcon id={item.id} className={`h-[26px] w-[26px] transition-transform duration-200 ${isActive ? "scale-110 drop-shadow" : "opacity-90"}`} />
                <span className={`admin-dock-label text-[11px] font-semibold tracking-wide leading-none ${isActive ? "text-primary" : ""}`}>{item.short}</span>
              </button>
            );
          })}
          <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="admin-dock-item flex flex-col items-center gap-0.5 p-2 min-w-[3.25rem] text-muted-foreground">
            <Menu className="h-5 w-5" strokeWidth={1.8} aria-hidden />
            <span className="text-[11px] font-semibold tracking-wide leading-none">Menu</span>
          </button>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-foreground/50 backdrop-blur-[2px]" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-[290px] bg-card h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
            {/* Profile block for mobile */}
            <div className="flex items-center justify-between p-4 border-b border-border/60">
              <div className="flex items-center gap-2.5 min-w-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-border shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                    {initials}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate leading-tight">{profile?.full_name || "Admin"}</p>
                  <span className="inline-block text-[10px] font-semibold uppercase bg-primary text-primary-foreground px-2 py-0.5 rounded-full mt-0.5 tracking-wider">
                    Administrator
                  </span>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-xl hover:bg-secondary shrink-0" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav ref={mobileNavRef} className="flex-1 overflow-y-auto px-3 py-4 admin-nav-scroll">
              <SectionedNav activeTab={activeTab} onTabChange={onTabChange} onItemClick={() => setSidebarOpen(false)} />
            </nav>
            <SidebarFooter onItemClick={() => setSidebarOpen(false)} onSignOut={handleSignOut} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLayout;
