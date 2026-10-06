/**
 * SITE CONFIG — single source of truth for institution data.
 * Replace placeholder values (marked SAMPLE) with official records.
 * When Supabase is configured, live notices/news/faculty come from the DB
 * (see src/lib/data); these constants remain the static fallback.
 */

export const SITE = {
  name: "GHSS Ghallanai",
  fullName: "Government Higher Secondary School Ghallanai",
  urduName: "گورنمنٹ ہائر سیکنڈری سکول غلانئی",
  tagline: "Knowledge, Character, Service",
  district: "Mohmand District",
  province: "Khyber Pakhtunkhwa",
  country: "Pakistan",
  address: "Ghallanai, Mohmand District, Khyber Pakhtunkhwa, Pakistan",
  geo: { lat: 34.5269, lng: 71.4567 }, // SAMPLE — replace with surveyed coordinates
  phone: "+92-XXX-XXXXXXX", // SAMPLE
  whatsapp: "923001234567", // SAMPLE — international format, no +
  whatsappDisplay: "+92 300 1234567",
  email: "info@ghssghallanai.edu.pk", // SAMPLE
  established: "SAMPLE — confirm year with office records",
  session: "2026-27",
  admissionStatus: {
    open: true,
    label: "Admissions open for the 2026-27 session",
    deadline: "2026-11-15",
  },
  officeHours: "Mon-Sat · 8:00 AM - 2:00 PM",
  board: "BISE (Board of Intermediate and Secondary Education)",
} as const;

export const NAV = [
  {
    label: "About",
    href: "/about",
    children: [
      { label: "About the School", href: "/about", desc: "Our story, vision and mission" },
      { label: "Principal's Message", href: "/about/principal", desc: "A word from the head of the institution" },
      { label: "Faculty Directory", href: "/about/faculty", desc: "Meet our teaching staff" },
    ],
  },
  {
    label: "Academics",
    href: "/academics",
    children: [
      { label: "Programme Hub", href: "/academics", desc: "Scheme of studies and calendar" },
      { label: "ICS — Computer Science", href: "/academics/ics", desc: "Programming, mathematics and computing" },
      { label: "Pre-Medical (F.Sc)", href: "/academics/pre-medical", desc: "The path to medicine and life sciences" },
      { label: "Pre-Engineering (F.Sc)", href: "/academics/pre-engineering", desc: "The path to engineering disciplines" },
      { label: "Arts (FA Humanities)", href: "/academics/arts", desc: "Law, civil service, media and more" },
    ],
  },
  {
    label: "Admissions",
    href: "/admissions",
    children: [
      { label: "How Admissions Work", href: "/admissions", desc: "The four-step journey and key dates" },
      { label: "Eligibility", href: "/admissions/eligibility", desc: "Requirements per programme" },
      { label: "Fee Structure", href: "/admissions/fees", desc: "Fees, scholarships and concessions" },
      { label: "FAQ", href: "/admissions/faq", desc: "Twenty answered questions" },
      { label: "Create Applicant Account", href: "/admissions/register", desc: "Register with CNIC/Form-B before applying" },
      { label: "Applicant Login", href: "/admissions/login", desc: "Return to your saved application" },
      { label: "Apply Online", href: "/admissions/apply", desc: "Six-step online application" },
      { label: "Track Application", href: "/admissions/track", desc: "Search your application tracking ID" },
    ],
  },
  {
    label: "Results",
    href: "/results",
    children: [
      { label: "Result Lookup", href: "/results/lookup", desc: "Subject-wise result by roll number" },
      { label: "Merit Lists", href: "/results/merit-list", desc: "Published, versioned merit lists" },
      { label: "Toppers", href: "/results/toppers", desc: "Our position holders and their stories" },
    ],
  },
  { label: "Notices", href: "/notices" },
  { label: "Contact", href: "/contact" },
] as const;

export const WHATSAPP_LINK = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(
  "Assalam-o-Alaikum, I have a question about GHSS Ghallanai:"
)}`;

/** Map link (no heavy map JS on low bandwidth; opens externally) */
export const MAP_LINK = `https://www.google.com/maps?q=${SITE.geo.lat},${SITE.geo.lng}`;

export function formatDate(d: string | Date, opts?: Intl.DateTimeFormatOptions) {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...opts,
  }).format(date);
}
