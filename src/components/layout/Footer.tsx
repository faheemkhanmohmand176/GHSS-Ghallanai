import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap, MapPin, Phone, Mail,
  Facebook, MessageCircle, ChevronRight,
} from "lucide-react";
import { useSchoolSettings, safeMediaUrl, optimizedCloudinaryUrl } from "@/hooks/useSchoolSettings";

// SEO / crawlability: every PUBLIC route keeps a permanent <a href> in the DOM
// (the Navbar dropdowns only mount their links while open). Do not remove links.
const footerLinks = {
  quickLinks: [
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
    { to: "/library",       label: "Library" },
  ],
};

const GOLD = "text-[hsl(43_74%_66%)]";

function LinkList({ title, links }: { title: string; links: { to: string; label: string }[] }) {
  return (
    <nav aria-label={title}>
      <h3 className={`font-heading text-[15px] font-semibold tracking-wide ${GOLD} mb-2.5 flex items-center gap-2`}>
        <span className="h-px w-4 bg-[hsl(43_74%_66%)]/60" aria-hidden="true" />
        {title}
      </h3>
      <ul className="space-y-0.5">
        {links.map((l) => (
          <li key={l.to}>
            <Link
              to={l.to}
              className="group inline-flex min-h-[36px] items-center gap-1 text-[13.5px] text-white/70 transition-colors hover:text-white"
            >
              <ChevronRight className="h-3 w-3 -ml-1 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0 text-[hsl(43_74%_66%)]" aria-hidden="true" />
              {l.label}
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
  const phone = settings?.phone && settings.phone.trim().length > 5 ? settings.phone : null;
  const name = settings?.school_name || "GHSS Ghallanai";

  const chip =
    "inline-flex h-10 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3.5 text-[12.5px] text-white/85 transition-all hover:border-[hsl(43_74%_66%)]/50 hover:bg-white/10 hover:text-white";

  return (
    <footer className="relative overflow-hidden bg-[hsl(144_62%_13%)] dark:bg-[hsl(146_41%_6%)] text-[#E8F5EC]">
      {/* brand hairline */}
      <div className="h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent" aria-hidden="true" />
      {/* soft glow */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[28rem] -translate-x-1/2 rounded-full bg-[hsl(43_74%_66%)]/10 blur-3xl" aria-hidden="true" />

      <div className="container relative mx-auto px-5 pt-9 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] md:pt-12">
        <div className="grid gap-8 md:grid-cols-12 md:gap-10">

          {/* Brand */}
          <div className="flex flex-col items-center text-center md:col-span-5 md:items-start md:text-left">
            <div className="flex items-center gap-3">
              {settings?.logo_url && !logoFailed ? (
                <img
                  src={optimizedCloudinaryUrl(settings.logo_url, { width: 112 }) || safeMediaUrl(settings.logo_url)!}
                  alt={`${name} logo`}
                  className="h-12 w-12 rounded-xl object-cover ring-1 ring-[hsl(43_74%_66%)]/40"
                  loading="lazy" decoding="async"
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-[hsl(43_74%_66%)]/40">
                  <GraduationCap className="h-6 w-6" />
                </div>
              )}
              <div className="text-left">
                <span className="block font-heading text-xl font-bold leading-tight tracking-tight">{name}</span>
                <span className={`block text-[11px] font-medium uppercase tracking-[0.18em] ${GOLD}`}>
                  {settings?.tagline || "Excellence in Education"}
                </span>
              </div>
            </div>

            <p className="mt-3.5 max-w-sm text-[13px] leading-relaxed text-white/65">
              {settings?.description ||
                "Government Higher Secondary School Ghallanai is committed to quality education and nurturing the future leaders of Pakistan."}
            </p>

            {/* Social */}
            <div className="mt-4 flex items-center gap-2.5">
              <a href="https://www.facebook.com/share/19doja9mNr/" target="_blank" rel="noopener noreferrer"
                aria-label="Follow GHSS Ghallanai on Facebook"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1877F2] shadow-md transition-transform hover:scale-105">
                <Facebook className="h-[18px] w-[18px] text-white" />
              </a>
              <a href="https://wa.me/923459409585" target="_blank" rel="noopener noreferrer"
                aria-label="Contact GHSS Ghallanai on WhatsApp"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] shadow-md transition-transform hover:scale-105">
                <MessageCircle className="h-[18px] w-[18px] fill-white text-white" />
              </a>
            </div>
          </div>

          {/* Links — two compact columns side by side on every screen */}
          <div className="grid grid-cols-2 gap-6 md:col-span-4">
            <LinkList title="Quick Links" links={footerLinks.quickLinks} />
            <LinkList title="Resources" links={footerLinks.resources} />
          </div>

          {/* Contact */}
          <div className="md:col-span-3">
            <h3 className={`mb-2.5 flex items-center justify-center gap-2 font-heading text-[15px] font-semibold tracking-wide md:justify-start ${GOLD}`}>
              <span className="h-px w-4 bg-[hsl(43_74%_66%)]/60" aria-hidden="true" />
              Get in Touch
            </h3>
            <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:justify-center md:flex-col md:items-stretch md:justify-start">
              <div className="flex items-start gap-2.5 rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-2.5 text-[12.5px] leading-snug text-white/80">
                <MapPin className={`mt-0.5 h-4 w-4 shrink-0 ${GOLD}`} />
                <span>{settings?.address || "Ghallanai, District Mohmand, KPK"}</span>
              </div>
              {phone && (
                <a href={`tel:${phone.replace(/\s/g, "")}`} className={chip}>
                  <Phone className={`h-4 w-4 shrink-0 ${GOLD}`} /> <span className="truncate">{phone}</span>
                </a>
              )}
              {email && (
                <a href={`mailto:${email}`} className={chip}>
                  <Mail className={`h-4 w-4 shrink-0 ${GOLD}`} /> <span className="truncate">{email}</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar — copyright centred */}
        <div className="mt-8 border-t border-white/10 pt-4 text-center">
          <p className="mx-auto text-[12px] leading-relaxed text-white/60">
            &copy; {new Date().getFullYear()} <span className="font-medium text-white/80">{name}</span>. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
