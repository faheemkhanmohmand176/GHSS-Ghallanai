import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { NewsTicker, type TickerItem } from "@/components/site/news-ticker";
import { ResultsCountdownStrip } from "@/components/site/results-countdown";
import { CommandPalette } from "@/components/site/command-palette";
import { WhatsAppFloat } from "@/components/site/whatsapp-float";
import { InstallPrompt } from "@/components/site/install-prompt";
import { SwRegister } from "@/components/site/sw-register";
import { MobileBottomNav } from "@/components/site/mobile-nav";
import { PageTracker } from "@/components/site/page-tracker";
import { ScrollToTop } from "@/components/site/scroll-to-top";
import { DefinitionPopup } from "@/components/site/definition-popup";
import { TextToSpeechPlayer } from "@/components/site/tts-player";
import { AIAssistant } from "@/components/site/ai-assistant";
import {
  getNotices, getNews, getTeachers, getSchoolSettings, getScheduledResultPublish,
} from "@/lib/data";
import { SITE } from "@/content/site";

/**
 * Public marketing shell (§4.3) — now carrying the full Babi Khel chrome:
 * results countdown strip, header theme bar, seamless news ticker, ⌘K
 * command palette, notification bell, TTS player, definition popup, AI
 * assistant, scroll-to-top and the page tracker feeding Site Analytics.
 * Roll No. Slip surfaces are intentionally NOT ported (user request).
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [notices, news, teachers, settings, scheduled] = await Promise.all([
    getNotices(5),
    getNews(4),
    getTeachers(6),
    getSchoolSettings(),
    getScheduledResultPublish(),
  ]);

  const tickerItems: TickerItem[] = [
    ...notices.slice(0, 5).map((n) => ({
      key: n.id,
      label: n.title,
      href: "/notices",
      tag: n.pinned ? "Pinned" : undefined,
    })),
    ...(settings.admission_open
      ? [{ key: "adm", label: "Admissions open — apply online", href: "/admissions/apply", tag: "Admission" }]
      : []),
  ].slice(0, 8);

  return (
    <div className="app-shell">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-small focus:font-bold focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {scheduled && <ResultsCountdownStrip at={scheduled.at} label={scheduled.label} />}
      <SiteHeader admissionBanner={settings.admission_banner} />
      <NewsTicker items={tickerItems} />
      <main id="main" className="app-main">
        {children}
      </main>
      <SiteFooter />
      {/* Spacer so the fixed mobile nav never covers footer content */}
      <div aria-hidden className="h-[calc(3.5rem+env(safe-area-inset-bottom))] lg:hidden" />

      {/* Global chrome (client) */}
      <CommandPalette
        notices={notices.map((n) => ({ id: n.id, title: n.title }))}
        news={news.map((n) => ({ id: n.id, slug: "slug" in n ? (n as { slug?: string }).slug : undefined, title: n.title }))}
        teachers={teachers.map((t) => ({ id: t.id, full_name: t.full_name, subject: t.subject }))}
        phone={settings.phone ?? SITE.phone}
      />
      <WhatsAppFloat />
      <InstallPrompt />
      <SwRegister />
      <MobileBottomNav />
      <ScrollToTop />
      <PageTracker />
      <DefinitionPopup />
      <TextToSpeechPlayer />
      <AIAssistant />
    </div>
  );
}
