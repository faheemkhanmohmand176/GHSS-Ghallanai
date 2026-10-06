import Link from "next/link";
import { MapPin, Phone, Clock, Mail } from "lucide-react";
import { SITE, NAV, WHATSAPP_LINK } from "@/content/site";
import { CrestMark } from "./crest";
import { WhatsAppIcon } from "./whatsapp";

/**
 * Footer — Master Plan §4.3: four columns — quick links, contact (incl. WhatsApp),
 * programme shortcuts, sign-in block.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-border bg-primary-strong text-[#E8F5EC] dark:bg-[#0a1810]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Identity */}
        <div>
          <div className="flex items-center gap-3">
            <CrestMark className="h-12 w-12" />
            <div className="leading-tight">
              <p className="font-display text-lg font-bold">
                GHSS <span className="text-gold">Ghallanai</span>
              </p>
              <p className="text-xs text-[#E8F5EC]/70">{SITE.fullName}</p>
            </div>
          </div>
          <p className="mt-4 text-small leading-relaxed text-[#E8F5EC]/75" dir="rtl" lang="ur">
            {SITE.urduName}
          </p>
          <p className="mt-3 text-small text-[#E8F5EC]/75">
            Serving the students of {SITE.district}, {SITE.province} — first year and second year,
            ICS · Pre-Medical · Pre-Engineering · Arts.
          </p>
        </div>

        {/* Quick links */}
        <nav aria-label="Footer quick links">
          <h2 className="text-small font-bold uppercase tracking-[0.14em] text-gold">Quick Links</h2>
          <ul className="mt-4 space-y-1">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-block min-h-11 py-2.5 text-small text-[#E8F5EC]/85 transition-colors hover:text-white hover:underline underline-offset-4"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Programmes */}
        <nav aria-label="Programme shortcuts">
          <h2 className="text-small font-bold uppercase tracking-[0.14em] text-gold">Programmes</h2>
          <ul className="mt-4 space-y-1">
            {[
              ["ICS — Computer Science", "/academics/ics"],
              ["F.Sc Pre-Medical", "/academics/pre-medical"],
              ["F.Sc Pre-Engineering", "/academics/pre-engineering"],
              ["FA Humanities (Arts)", "/academics/arts"],
              ["Apply Online", "/admissions/apply"],
              ["Check Results", "/results/lookup"],
            ].map(([label, href]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-block min-h-11 py-2.5 text-small text-[#E8F5EC]/85 transition-colors hover:text-white hover:underline underline-offset-4"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Contact + portals */}
        <div>
          <h2 className="text-small font-bold uppercase tracking-[0.14em] text-gold">Contact</h2>
          <ul className="mt-4 space-y-3 text-small text-[#E8F5EC]/85">
            <li className="flex gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{SITE.address}</span>
            </li>
            <li className="flex gap-2.5">
              <Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{SITE.phone}</span>
            </li>
            <li className="flex gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{SITE.officeHours}</span>
            </li>
            <li className="flex gap-2.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{SITE.email}</span>
            </li>
          </ul>
          <a
            href={WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-[#E8F5EC]/25 px-4 py-2.5 text-small font-semibold text-[#E8F5EC] transition-colors hover:border-gold hover:text-gold"
          >
            <WhatsAppIcon className="h-4 w-4" />
            WhatsApp us
          </a>

          <h2 className="mt-6 text-small font-bold uppercase tracking-[0.14em] text-gold">Portals</h2>
          <p className="mt-3 text-small text-[#E8F5EC]/85">
            <Link href="/login" className="underline underline-offset-4 hover:text-white">
              Student · Teacher · Admin sign-in
            </Link>
          </p>
        </div>
      </div>

      <div className="border-t border-[#E8F5EC]/15">
        <div className="mx-auto flex max-w-7xl flex-col gap-1.5 px-4 py-5 text-xs text-[#E8F5EC]/60 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            © {year} {SITE.fullName}, {SITE.district}, {SITE.province}.
          </p>
          <p>
            Digital Campus Programme ·{" "}
            <Link href="/ur" lang="ur" className="underline underline-offset-2 hover:text-white">
              اردو نسخہ
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
