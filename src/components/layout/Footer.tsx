import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap, MapPin, Phone, Mail,
  Facebook, MessageCircle, ChevronRight, ArrowUp,
} from "lucide-react";
import { useSchoolSettings, safeMediaUrl, optimizedCloudinaryUrl } from "@/hooks/useSchoolSettings";

// SEO / crawlability: every PUBLIC route keeps a permanent <a href> in the DOM
// (the Navbar dropdowns only mount their links while open). Do not remove links.
// ✅ SEO audit: "Home" added so the two footer columns together form a
// COMPLETE site map (all 10 public routes) on every page of the site —
// Google treats a persistent, complete footer link mesh as a crawl-priority
// signal, exactly what "Discovered — currently not indexed" pages need.
const footerLinks = {
  quickLinks: [
    { to: "/",         label: "Home" },
    { to: "/about",     label: "About Us" },
    { to: "/admission", label: "Admission" },
    { to: "/teachers",  label: "Our Teachers" },
    { to: "/notices",   label: "Notices" },
    { to: "/faq",       label: "FAQs" },
    { to: "/contact",   label: "Contact Us" },
  ],
  resources: [
    { to: "/results",       label: "Results" },
    { to: "/merit-list",    label: "Merit List" },
    { to: "/roll-no-slip",  label: "Roll No. Slip" },
  ],
};

const GOLD_HSL = "hsl(43 74% 66%)";
const GOLD = "text-[hsl(43_74%_66%)]";
const FB_URL = "https://www.facebook.com/share/19doja9mNr/";
const WA_URL = "https://wa.me/923459409585";

function LinkList({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <nav aria-label={title} className="min-w-0">
      <h3 className={`mb-1.5 font-heading text-[12px] font-semibold uppercase tracking-[0.16em] ${GOLD}`}>
        {title}
      </h3>
      <ul>
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="group flex min-h-[38px] items-center justify-between gap-1 border-b border-white/[0.06] text-[13px] font-medium text-white/75 transition-colors last:border-b-0 hover:text-white active:text-white"
            >
              <span className="truncate">{l.label}</span>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/25 transition-all group-hover:translate-x-0.5 group-hover:text-[hsl(43_74%_66%)]" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

const Footer = () => {
  const { data: settings } = useSchoolSettings();
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => { setLogoFailed(false); }, [settings?.logo_url]);

  const email = settings?.email || "";
  const phone = settings?.phone && settings.phone.trim().length > 5 ? settings.phone : "03459409585";
  const name = settings?.school_name || "GHSS Ghallanai";
  const address = settings?.address || "Ghallanai, District Mohmand, KPK, Pakistan";

  const action =
    "flex h-8 items-center justify-center gap-1 rounded-lg border text-[11.5px] font-semibold transition-all active:scale-[0.97]";

  return (
    <footer className="relative overflow-hidden bg-[hsl(144_62%_12%)] text-[#E8F5EC] dark:bg-[hsl(146_41%_6%)]">
      {/* brand hairline + soft glows */}
      <div className="h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent" aria-hidden="true" />
      <div className="pointer-events-none absolute -top-28 left-1/2 h-56 w-[30rem] -translate-x-1/2 rounded-full bg-[hsl(43_74%_66%)]/10 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-52 w-52 rounded-full bg-emerald-400/10 blur-3xl" aria-hidden="true" />

      <div className="container relative mx-auto px-4 pt-7 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:px-5 md:pt-12">
        <div className="grid gap-6 md:grid-cols-12 md:gap-10">

          {/* ── Brand + quick actions ── */}
          <div className="md:col-span-4">
            <div className="flex items-center gap-3">
              {settings?.logo_url && !logoFailed ? (
                <img
                  src={optimizedCloudinaryUrl(settings.logo_url, { width: 80 }) || safeMediaUrl(settings.logo_url)!}
                  alt={`${name} logo`}
                  className="h-9 w-9 shrink-0 rounded-lg bg-white object-cover p-0.5 shadow-lg ring-1 ring-[hsl(43_74%_66%)]/50"
                  loading="lazy" decoding="async"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-[hsl(43_74%_66%)]/40">
                  <GraduationCap className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                <span className="block truncate font-heading text-[19px] font-bold leading-tight tracking-tight">{name}</span>
                <span className={`block truncate text-[10.5px] font-semibold uppercase tracking-[0.2em] ${GOLD}`}>
                  {settings?.tagline || "Excellence in Education"}
                </span>
              </div>
            </div>

            <p className="mt-3 line-clamp-3 text-[12.5px] leading-relaxed text-white/60">
              {settings?.description ||
                "Government Higher Secondary School Ghallanai, District Mohmand — quality education for 1st Year and 2nd Year students."}
            </p>

            <div className="mt-3 grid grid-cols-3 gap-1.5">
              <a href={`tel:${phone.replace(/\s/g, "")}`} aria-label="Call the school"
                className={`${action} border-[hsl(43_74%_66%)]/40 bg-[hsl(43_74%_66%)]/15 text-[hsl(43_74%_72%)] hover:bg-[hsl(43_74%_66%)]/25`}>
                <Phone className="h-3.5 w-3.5" /> Call
              </a>
              <a href={WA_URL} target="_blank" rel="noopener noreferrer" aria-label="Contact GHSS Ghallanai on WhatsApp"
                className={`${action} border-[#25D366]/40 bg-[#25D366]/15 text-[#7BEFA6] hover:bg-[#25D366]/25`}>
                <MessageCircle className="h-3.5 w-3.5" /> Chat
              </a>
              <a href={FB_URL} target="_blank" rel="noopener noreferrer" aria-label="Follow GHSS Ghallanai on Facebook"
                className={`${action} border-[#1877F2]/50 bg-[#1877F2]/20 text-[#9CC4FF] hover:bg-[#1877F2]/30`}>
                <Facebook className="h-3.5 w-3.5" /> Follow
              </a>
            </div>
          </div>

          {/* ── Links: one glass card, two compact columns ── */}
          <div className="grid grid-cols-2 gap-x-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 backdrop-blur-sm md:col-span-5 md:border-0 md:bg-transparent md:p-0 md:gap-x-10">
            <LinkList title="Quick Links" links={footerLinks.quickLinks} />
            <LinkList title="Resources" links={footerLinks.resources} />
          </div>

          {/* ── Contact ── */}
          <div className="md:col-span-3">
            <h3 className={`mb-2 font-heading text-[12px] font-semibold uppercase tracking-[0.16em] ${GOLD}`}>
              Get in Touch
            </h3>
            <ul className="space-y-2">
              <li className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(43_74%_66%)]/15">
                  <MapPin className={`h-3.5 w-3.5 ${GOLD}`} />
                </span>
                <span className="text-[12.5px] leading-snug text-white/80">{address}</span>
              </li>
              <li>
                <a href={`tel:${phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 transition-colors hover:bg-white/10">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(43_74%_66%)]/15">
                    <Phone className={`h-3.5 w-3.5 ${GOLD}`} />
                  </span>
                  <span className="text-[13px] font-medium tracking-wide text-white/90">{phone}</span>
                </a>
              </li>
              {email && (
                <li>
                  <a href={`mailto:${email}`}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5 transition-colors hover:bg-white/10">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[hsl(43_74%_66%)]/15">
                      <Mail className={`h-3.5 w-3.5 ${GOLD}`} />
                    </span>
                    <span className="min-w-0 truncate text-[12.5px] text-white/85">{email}</span>
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="relative mt-6 flex items-center justify-center border-t border-white/10 pt-3.5">
          <p className="px-12 text-center text-[11.5px] leading-snug text-white/55">
            &copy; {new Date().getFullYear()} <span className="font-medium text-white/80">{name}</span>. All rights reserved.
          </p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Back to top"
            className="absolute right-0 top-1/2 mt-[7px] flex h-9 w-9 -translate-y-1/2 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-white/75 transition-colors hover:text-white active:scale-95"
            style={{ boxShadow: `0 0 0 1px ${GOLD_HSL}22` }}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
