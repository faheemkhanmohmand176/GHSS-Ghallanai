import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { NoticeTicker } from "@/components/site/ticker";
import { WhatsAppFloat } from "@/components/site/whatsapp-float";
import { InstallPrompt } from "@/components/site/install-prompt";
import { SwRegister } from "@/components/site/sw-register";
import { getNotices } from "@/lib/data";

/** Public marketing shell (§4.3): header + ticker + main + footer + PWA layers. */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const notices = await getNotices(4);
  return (
    <div className="app-shell">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-small focus:font-bold focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <SiteHeader />
      <NoticeTicker notices={notices} />
      <main id="main" className="app-main">
        {children}
      </main>
      <SiteFooter />
      <WhatsAppFloat />
      <InstallPrompt />
      <SwRegister />
    </div>
  );
}
