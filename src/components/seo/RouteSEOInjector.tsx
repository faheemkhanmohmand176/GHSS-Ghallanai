import { useLocation, matchPath } from "react-router-dom";
import SEO from "./SEO";
import { SITE_URL } from "./SEO";
// Shared canonical FAQ dataset — the SAME data the /faq React page, the
// /api/ai-data feed and /api/render (crawler HTML) serve. Single source,
// zero drift. (Types come from src/data/faqData.d.mts. The import stays
// INSIDE src/ on purpose — the frontend build must never depend on api/.)
import { buildFaqJsonLd } from "../../data/faqData.mjs";

interface RouteSEO {
  pattern: string;
  title: string;
  description: string;
  keywords?: string;
  type?: "website" | "article" | "profile";
  noIndex?: boolean;
  hasUrdu?: boolean;
  breadcrumbs?: (params: Record<string, string | undefined>) => { name: string; path: string }[];
  jsonLd?: (params: Record<string, string | undefined>, path: string) => Record<string, any> | Record<string, any>[];
}

const baseBreadcrumb = { name: "Home", path: "/" };

// ─── Reusable schemas ────────────────────────────────────────────────────────

/** FAQPage schema for the Admission page — boosts rich results in Google.
 *  Updated to lead with an explicit "are admissions open" Q&A so the SERP
 *  snippet reinforces the open status even when the admin has paused live
 *  form submissions in the database. */
const admissionFAQSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Are admissions open at GHSS Ghallanai right now?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — admissions at Government Higher Secondary School Ghallanai are open every academic session. The online admission application form is available at https://ghssghallanai.dpdns.org/admission for 1st Year and 2nd Year (HSSC). Apply directly from your phone or computer.",
      },
    },
    {
      "@type": "Question",
      name: "Which classes can apply for admission at GHSS Ghallanai?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Fresh admissions are available for 1st Year (after SSC / Matric). Migration cases are accepted for 1st Year and 2nd Year through the BISEP migration process.",
      },
    },
    {
      "@type": "Question",
      name: "What documents are required for admission?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Required documents include: B-Form (NADRA) — mandatory, passport size photo — mandatory, previous result card or marksheet, school leaving certificate (for migration), father's CNIC copy, and migration certificate if applicable.",
      },
    },
    {
      "@type": "Question",
      name: "How can I track my admission application?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can track your admission application online by visiting the Admission page and entering your CNIC or application reference number in the Track Application section.",
      },
    },
    {
      "@type": "Question",
      name: "What is the migration process for 1st Year and 2nd Year?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "The 1st Year / 2nd Year migration process involves 8 steps: submit online application, write migration letter to current school principal, get principal signature, both principals sign, current school applies migration on BISEP portal, our school approves on BISEP, BISEP generates bank challan, submit fee at bank — migration confirmed.",
      },
    },
    {
      "@type": "Question",
      name: "Is there an online application form available?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, GHSS Ghallanai provides an online admission application form available at https://ghssghallanai.dpdns.org/admission. You can apply directly from your phone or computer.",
      },
    },
    {
      "@type": "Question",
      name: "What is the school address and how can I contact GHSS Ghallanai?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "GHSS Ghallanai is located in Ghallanai, District Mohmand, Khyber Pakhtunkhwa, Pakistan. You can email at  or visit the school directly.",
      },
    },
  ],
};

/** Library schema */
const librarySchema = {
  "@context": "https://schema.org",
  "@type": "Library",
  name: "GHSS Ghallanai Library",
  description:
    "Digital library of Government Higher Secondary School Ghallanai — textbooks, past papers, notes and educational resources for all classes.",
  url: `${SITE_URL}/library`,
  containedInPlace: {
    "@type": "HighSchool",
    "@id": `${SITE_URL}#organization`,
  },
};

const ROUTES: RouteSEO[] = [
  {
    pattern: "/",
    title: "GHSS Ghallanai — Government Higher Secondary School, District Mohmand KPK",
    description:
      "Government Higher Secondary School Ghallanai, District Mohmand, KPK Pakistan. Quality education, notices, results, library and admissions.",
    keywords:
      "GHSS Ghallanai, Government Higher Secondary School Ghallanai, Mohmand school, KPK school, school admission, school notices, school results Pakistan",
    hasUrdu: true,
  },
  {
    pattern: "/about",
    title: "About GHSS Ghallanai — History, Mission & Vision | District Mohmand KPK",
    description:
      "Learn about Government Higher Secondary School Ghallanai — our history, mission, vision, faculty and commitment to quality education in District Mohmand.",
    keywords: "about GHSS Ghallanai, school history, school mission, school vision, Mohmand education",
    breadcrumbs: () => [baseBreadcrumb, { name: "About", path: "/about" }],
    jsonLd: () => ({
      "@context": "https://schema.org",
      "@type": "AboutPage",
      name: "About GHSS Ghallanai",
      url: `${SITE_URL}/about`,
      about: { "@id": `${SITE_URL}#organization` },
    }),
  },
  {
    pattern: "/teachers",
    title: "Teachers & Faculty — GHSS Ghallanai | District Mohmand KPK",
    description:
      "Meet the qualified teachers and faculty of GHSS Ghallanai — dedicated educators shaping the future of students in District Mohmand, KPK.",
    keywords: "GHSS Ghallanai teachers, faculty, qualified educators, school staff KPK",
    breadcrumbs: () => [baseBreadcrumb, { name: "Teachers", path: "/teachers" }],
  },
  {
    pattern: "/notices",
    title: "School Notices & Announcements — GHSS Ghallanai",
    description:
      "Browse the latest school notices, urgent announcements, academic updates and event information from Government Higher Secondary School Ghallanai.",
    keywords: "school notices, announcements, urgent notices, academic updates, GHSS Ghallanai notices",
    breadcrumbs: () => [baseBreadcrumb, { name: "Notices", path: "/notices" }],
  },
  {
    pattern: "/results",
    title:
      "BISE Peshawar Result — HSSC Result, BISEP Result, Peshawar Board Result | GHSS Ghallanai",
    description:
      "Check BISE Peshawar Result by roll number — HSSC Result (1st Year & 2nd Year), BISEP Result, Peshawar Board Result, Annual-I & Annual-II exams. Fast, free, mobile-friendly BISE Peshawar board result lookup powered by GHSS Ghallanai.",
    keywords:
      "BISE Peshawar Result, BISEP Result, HSSC Result, Peshawar Board Result, BISE Result, Result, 1st Year result, 2nd Year result, Intermediate result, HSSC Part-I result, HSSC Part-II result, BISE Peshawar result by roll number, BISEP result by roll number, BISE Peshawar HSSC Result, Annual-I result, Annual-II result, Supplementary result, Peshawar board result, GHSS Ghallanai results, school results, exam results, annual results, term results",
    hasUrdu: true,
    breadcrumbs: () => [baseBreadcrumb, { name: "Results", path: "/results" }],
    // ✅ Rich JSON-LD stack for /results:
    //   RouteSEOInjector already auto-emits a basic WebPage schema for every
    //   route (see the `webPage` const in RouteSEOInjector component below),
    //   so we do NOT duplicate it here. Instead we add 4 unique rich schemas
    //   eligible for Google rich results:
    //     1. FAQPage  (15 Q&As targeting exact search queries — FAQ rich result)
    //     2. HowTo    (5-step "how to check BISEP result" — HowTo rich result)
    //     3. ItemList (6 result types — SSC-I, SSC-II, HSSC-I, HSSC-II, Supp)
    //     4. Service  (result lookup as a Service with a SearchAction —
    //                 eligible for sitelinks search box treatment)
    //
    // The text inside FAQ/HowTo mirrors the on-page copy in
    // ResultsSeoContent.tsx — keep both files in sync when editing wording.
    jsonLd: () => {
      // ── 1. FAQPage (15 Q&As) — mirrors FAQS in ResultsSeoContent.tsx ──
      const faqs = [
        {
          q: "How do I check my BISE Peshawar Result by roll number?",
          a: "To check your BISE Peshawar Result, enter your 6-digit roll number in the search box at the top of this page and tap Search Result. Our server fetches your result directly from the official BISEP portal (cloud.bisep.edu.pk) and displays your name, father name, total marks, grade, remarks and subject-wise theory and practical marks in a clean, mobile-friendly card. You can also visit cloud.bisep.edu.pk directly and enter your roll number on the board's official ShowResult page.",
        },
        {
          q: "What is the official website of BISE Peshawar (BISEP)?",
          a: "The official website of the Board of Intermediate and Secondary Education Peshawar is https://cloud.bisep.edu.pk/. This is the only authoritative source for BISEP results, date sheets, roll number slips, enrollment, migration and gazette publications. Result lookups on this page are routed through the same official BISEP endpoint via a cached proxy for speed and reliability.",
        },
        {
          q: "How do I check the 1st Year (HSSC-I) result of BISE Peshawar?",
          a: "The 1st Year (HSSC Part-I) result of BISE Peshawar is published as the HSSC Annual-I Result. Once announced by the board, you can search it on this page using your 1st Year roll number. The result card will show your obtained marks out of the total, grade, position in class (if available), and subject-wise breakdown. The HSSC-I result is usually declared in September or October each year.",
        },
        {
          q: "How do I check the 2nd Year (HSSC-II) result of BISE Peshawar?",
          a: "The 2nd Year (HSSC Part-II / Intermediate) result of BISE Peshawar is published as the HSSC Annual-II Result. Enter your 2nd Year roll number in the search box above to view your result instantly. The HSSC-II result includes marks for all subjects (English, Urdu, Islamiat, Pakistan Studies, Mathematics, Physics, Chemistry, Biology / Computer Science), total obtained marks, grade and pass/fail remarks. The HSSC-II result is typically declared in July or August.",
        },
        {
          q: "When will BISE Peshawar announce the HSSC Result?",
          a: "BISE Peshawar typically announces the HSSC Annual-II (2nd Year / Intermediate) Result in the last week of July or first week of August, and the HSSC Annual-I (1st Year) Result in August or September. The exact HSSC Result date is officially confirmed by the Chairman of the Board a few days before declaration. Once declared, results are searchable immediately on this page.",
        },
        {
          q: "What are the passing marks for BISE Peshawar HSSC exams?",
          a: "To pass any subject in BISE Peshawar HSSC (1st Year and 2nd Year) exams, a student must obtain at least 33% marks in both theory and practical separately. To pass the overall exam, a student must pass all subjects. Students who fail 1 or 2 subjects are placed in a supplementary exam; those who fail 3 or more subjects must repeat the entire year.",
        },
        {
          q: "What is the grading system of BISE Peshawar?",
          a: "BISE Peshawar uses the following grading system for SSC and HSSC results: 80% and above = A-1 (A-One), 70% to 79% = A, 60% to 69% = B, 50% to 59% = C, 40% to 49% = D, 33% to 39% = E, and below 33% = F (Fail). The overall grade on the result card is calculated from the combined percentage of theory and practical marks across all subjects.",
        },
        {
          q: "How do I check my BISEP result by name instead of roll number?",
          a: "BISE Peshawar's online result portal at cloud.bisep.edu.pk officially supports search by Roll Number only. Name-based search is available exclusively through the printed gazette, which is distributed to affiliated schools and educational institutions on result day. If you do not know your roll number, contact your school admin office — they have a complete list of roll numbers issued to enrolled students.",
        },
        {
          q: "How do I download the BISE Peshawar result gazette PDF?",
          a: "The BISE Peshawar result gazette PDF is a complete list of every student's result for a given exam session. It is published on result day and is accessible only to affiliated school principals and authorized institutions via the board's institutional login at cloud.bisep.edu.pk. Individual students cannot download the gazette directly; they should request a print copy from their school office.",
        },
        {
          q: "What does BISEP stand for?",
          a: "BISEP stands for Board of Intermediate and Secondary Education Peshawar. It is the government education board responsible for conducting, regulating and certifying Secondary School Certificate (SSC, 1st Year and 2nd Year) and Higher Secondary School Certificate (HSSC, Class 11 and 12) examinations in Peshawar District and several adjacent districts of Khyber Pakhtunkhwa (KPK), Pakistan.",
        },
        {
          q: "How do I apply for rechecking or re-totaling of my BISE Peshawar result?",
          a: "If you believe your BISE Peshawar result marks are incorrect, you can apply for rechecking (also called re-totaling) within 15 days of result declaration. Visit the BISEP office at Jamrud Road, Peshawar, or apply through your school. The rechecking fee is paid via bank challan at designated banks. Only the totals are re-counted — the answer sheet is not re-evaluated. Updated marks (if any) are reflected in a revised result card.",
        },
        {
          q: "How do I apply for result correction (name, father name, date of birth) in BISE Peshawar?",
          a: "To correct a name, father name or date of birth error on your BISE Peshawar result card, submit a result correction application through your school along with the original B-Form from NADRA, your father's CNIC copy and the original result card. The board processes corrections through its Record department. Processing typically takes 4 to 8 weeks. Always verify your B-Form details before enrollment to prevent such errors.",
        },
      ];

      const faqSchema = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        name: "BISE Peshawar Result — Frequently Asked Questions",
        url: `${SITE_URL}/results`,
        mainEntity: faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      };

      // ── 2. HowTo (5 steps) — mirrors HOW_TO_STEPS in ResultsSeoContent.tsx ──
      const howToSteps = [
        { name: "Find your roll number", text: "Locate your 6-digit exam roll number printed on your roll number slip issued by BISE Peshawar or your school. If you lost your slip, contact your school admin office — they have a master list of all issued roll numbers." },
        { name: "Enter the roll number in the search box", text: "Type your roll number into the 'Roll No' input field at the top of this page. Use digits only — no spaces, dashes or letters. The field accepts 4 to 10 digit roll numbers." },
        { name: "Tap 'Search Result'", text: "Click the blue Search Result button. Our server fetches your result from the official BISEP portal (cloud.bisep.edu.pk) through a cached proxy and parses the response into a clean card view." },
        { name: "Review your result card", text: "Your result appears instantly showing your name, father name, roll number, total marks, obtained marks, grade, remarks and subject-wise theory and practical marks. Take a screenshot or print the page for your records." },
        { name: "Collect your original DMC", text: "The online result is for information only. Collect your original Detailed Marks Certificate (DMC) from your school or the BISEP office on the date mentioned in the 'Collect DMC From' field of your result." },
      ];

      const howToSchema = {
        "@context": "https://schema.org",
        "@type": "HowTo",
        name: "How to Check Your BISE Peshawar Result by Roll Number",
        description:
          "Step-by-step guide to retrieve your BISEP (Board of Intermediate and Secondary Education Peshawar) result by roll number — covers HSSC (1st Year & 2nd Year) exams.",
        url: `${SITE_URL}/results`,
        inLanguage: ["en", "ur"],
        totalTime: "PT2M",
        estimatedCost: { "@type": "MonetaryAmount", currency: "PKR", value: "0" },
        supply: [{ "@type": "HowToSupply", name: "Exam roll number" }],
        tool: [
          { "@type": "HowToTool", name: "Any web browser (mobile or desktop)" },
          { "@type": "HowToTool", name: "Internet connection" },
        ],
        step: howToSteps.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.name,
          text: s.text,
        })),
      };

      // ── 3. ItemList (3 result types) — mirrors RESULT_TYPES in ResultsSeoContent.tsx ──
      const resultTypes = [
        { code: "HSSC-I", title: "HSSC Annual-I Result (1st Year)", desc: "First-year higher secondary school (HSSC Part-I / Class 11) BISE Peshawar annual examination result — Pre-Medical, Pre-Engineering, ICS and Humanities groups." },
        { code: "HSSC-II", title: "HSSC Annual-II Result (2nd Year)", desc: "Second-year higher secondary school (HSSC Part-II / Class 12 / Intermediate) BISE Peshawar annual examination result." },
        { code: "HSSC-SUPP", title: "HSSC Supplementary Result", desc: "BISE Peshawar 1st Year and 2nd Year class supplementary (second chance) examination result for students who failed a subject in the annual exam." },
      ];

      const itemListSchema = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "BISE Peshawar Result Types",
        description: "All examination result types conducted and published by the Board of Intermediate and Secondary Education Peshawar (BISEP).",
        url: `${SITE_URL}/results`,
        numberOfItems: resultTypes.length,
        itemListElement: resultTypes.map((rt, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: rt.title,
          description: rt.desc,
        })),
      };

      // ── 4. Service (result lookup as a Service with a SearchAction) ──
      const serviceSchema = {
        "@context": "https://schema.org",
        "@type": "Service",
        name: "BISE Peshawar Result Lookup by Roll Number",
        serviceType: "Examination result search",
        description:
          "Free online service to look up any BISE Peshawar (BISEP) examination result by roll number. Returns student name, father name, total marks, grade, remarks and subject-wise marks.",
        url: `${SITE_URL}/results`,
        inLanguage: ["en", "ur"],
        provider: { "@id": `${SITE_URL}#organization` },
        areaServed: {
          "@type": "AdministrativeArea",
          name: "Peshawar District and adjacent districts, Khyber Pakhtunkhwa, Pakistan",
        },
        isAccessibleForFree: true,
        category: "Education > Examination Results",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/results?roll={roll_number}`,
            actionPlatform: ["DesktopWebBrowser", "MobileWebBrowser"],
          },
          "query-input": "required name=roll_number",
        },
      };

      return [faqSchema, howToSchema, itemListSchema, serviceSchema];
    },
  },
  {
    pattern: "/merit-list",
    title: "Merit List — Official School Exam Rankings | GHSS Ghallanai",
    description:
      "Official GHSS Ghallanai merit list — top position holders of every exam, class-wise and whole-school rankings with marks, percentages and grades. Published live by the school office; upcoming merit lists show a countdown.",
    keywords:
      "merit list, GHSS Ghallanai merit list, school merit list, position holders, top students, exam rankings, toppers list, class merit list, whole school merit list, Mohmand school ranking",
    breadcrumbs: () => [baseBreadcrumb, { name: "Merit List", path: "/merit-list" }],
  },
  {
    pattern: "/library",
    title: "Library — GHSS Ghallanai | Books & Past Papers",
    description:
      "Access the digital library of GHSS Ghallanai — books, past papers and educational resources for all classes.",
    keywords: "school library, digital library, past papers, books, GHSS Ghallanai library",
    breadcrumbs: () => [baseBreadcrumb, { name: "Library", path: "/library" }],
    jsonLd: () => librarySchema,
  },
  {
    pattern: "/contact",
    title: "Contact GHSS Ghallanai — Address, Phone & Email | District Mohmand",
    description:
      "Contact Government Higher Secondary School Ghallanai, District Mohmand, KPK. Find our address, phone number, email, WhatsApp and location map. Reach out for admissions, queries and feedback.",
    keywords: "contact GHSS Ghallanai, school address, school phone, school email, Mohmand school contact, WhatsApp school",
    breadcrumbs: () => [baseBreadcrumb, { name: "Contact", path: "/contact" }],
    // ✅ ContactPage schema — boosts rich results for contact queries
    jsonLd: () => ({
      "@context": "https://schema.org",
      "@type": "ContactPage",
      name: "Contact GHSS Ghallanai",
      url: `${SITE_URL}/contact`,
      about: { "@id": `${SITE_URL}#organization` },
      mainEntity: {
        "@type": "EducationalOrganization",
        name: "Government Higher Secondary School Ghallanai",
        url: SITE_URL,
        address: {
          "@type": "PostalAddress",
          addressLocality: "Ghallanai",
          addressRegion: "Khyber Pakhtunkhwa",
          addressCountry: "PK",
        },
        areaServed: "District Mohmand, KPK, Pakistan",
      },
    }),
  },

  {
    pattern: "/roll-no-slip",
    title: "Roll No. Slip — GHSS Ghallanai | Exam Roll Numbers & Admit Card",
    description:
      "Find your exam roll number and download your admit card (Roll No. Slip) for Government Higher Secondary School Ghallanai, District Mohmand, KPK.",
    keywords: "roll no slip, exam roll number, admit card, GHSS Ghallanai roll number, exam admit card Pakistan",
    breadcrumbs: () => [baseBreadcrumb, { name: "Roll No. Slip", path: "/roll-no-slip" }],
  },
  {
    pattern: "/admission",
    title: "Admissions Open — GHSS Ghallanai | Apply Online District Mohmand",
    description:
      "Admissions Open at Government Higher Secondary School Ghallanai, District Mohmand, KPK. Apply online for 1st Year (fresh) and 1st Year & 2nd Year (migration). Eligibility, fee structure, required documents and online admission form.",
    keywords:
      "GHSS Ghallanai admission, admissions open, school admission Mohmand, KPK school admission, 1st Year admission, 2nd Year admission, FSc admission, intermediate admission Mohmand, BISEP migration, apply online school Pakistan, Ghallanai school admission",
    breadcrumbs: () => [baseBreadcrumb, { name: "Admissions", path: "/admission" }],
    // ✅ Rich schema stack for /admission — maximises Google visibility:
    //   1. FAQPage (rich Q&A result) — updated to emphasise "Admissions Open"
    //      so the SERP snippet reinforces the open status even when the admin
    //      has temporarily paused live form submissions.
    //   2. EducationalOccupationalProgram — explicitly tells Google this page
    //      is about an admission / enrollment program (eligible for the
    //      "Programs" rich result).
    //   3. EducationalOrganization anchor (reused) — links the page back to
    //      the school's main schema identity.
    jsonLd: () => [
      admissionFAQSchema,
      {
        "@context": "https://schema.org",
        "@type": "EducationalOccupationalProgram",
        name: "GHSS Ghallanai Admissions",
        description:
          "Admissions Open at Government Higher Secondary School Ghallanai for 1st Year and 2nd Year (HSSC) — fresh admissions and migration cases via the BISE Peshawar migration process.",
        url: `${SITE_URL}/admission`,
        provider: {
          "@type": "HighSchool",
          "@id": `${SITE_URL}#organization`,
          name: "Government Higher Secondary School Ghallanai",
        },
        educationalProgramMode: "Onsite",
        educationalCredentialAwarded: "Higher Secondary School Certificate (HSSC)",
        applicationDeadline: undefined,
        timeToComplete: "P2Y",
        offers: {
          "@type": "Offer",
          category: "Free education (Government school)",
          price: "0",
          priceCurrency: "PKR",
          availability: "https://schema.org/InStock",
        },
      },
    ],
  },
  {
    pattern: "/faq",
    title: "FAQ — Frequently Asked Questions | GHSS Ghallanai",
    description:
      "Frequently asked questions about GHSS Ghallanai: admission procedure and documents, application tracking, results and grading, BISE Peshawar board exams, library, contact details and how to install the website as an app.",
    keywords:
      "GHSS Ghallanai FAQ, school admission questions, how to apply GHSS Ghallanai, admission documents, result check roll number, BISE Peshawar result, school contact Mohmand, GHSS Ghallanai help",
    breadcrumbs: () => [baseBreadcrumb, { name: "FAQ", path: "/faq" }],
    // ✅ Full FAQPage rich-result schema — built from the SAME canonical
    // dataset (src/data/faqData.mjs) the AI feed and crawler HTML use. One source,
    // zero drift: if a Q&A is edited there, this schema updates too.
    jsonLd: () => buildFaqJsonLd(),
  },
  // ── Private / noindex pages ──
  { pattern: "/auth/signin",         title: "Sign In — Student, Teacher & Admin Login",    description: "Sign in to your GHSS Ghallanai account.",            noIndex: true },
  { pattern: "/auth/forgot-password",title: "Forgot Password — Recover Your Account",     description: "Recover access to your GHSS Ghallanai account.",     noIndex: true },
  { pattern: "/auth/reset-password", title: "Reset Password — Set a New Password",        description: "Set a new password for your GHSS Ghallanai account.", noIndex: true },
  { pattern: "/admin",               title: "Admin Dashboard — School Management",         description: "Administrative console for GHSS Ghallanai.",          noIndex: true },
      {
    pattern: "/search",
    title: "Search — GHSS Ghallanai",
    description: "Search across notices, teachers and notes at Government Higher Secondary School Ghallanai.",
    noIndex: true,  // ← ADDED: prevents thin-content search page from being indexed
    breadcrumbs: () => [baseBreadcrumb, { name: "Search", path: "/search" }],
  },
  
  {
    pattern: "/notices/:id",
    title: "School Notice — GHSS Ghallanai",
    description: "Read the full school notice from Government Higher Secondary School Ghallanai.",
    type: "article",
    breadcrumbs: () => [baseBreadcrumb, { name: "Notices", path: "/notices" }],
  },
];

const NOT_FOUND: RouteSEO = {
  pattern: "*",
  title: "Page Not Found (404)",
  description: "The page you are looking for could not be found. Return to GHSS Ghallanai home page.",
  noIndex: true,
};

const RouteSEOInjector = () => {
  const location = useLocation();
  const path = location.pathname;

  let matched: RouteSEO | null = null;
  let matchedParams: Record<string, string | undefined> = {};
  for (const r of ROUTES) {
    const m = matchPath({ path: r.pattern, end: true }, path);
    if (m) {
      matched = r;
      matchedParams = m.params as Record<string, string | undefined>;
      break;
    }
  }
  if (!matched) matched = NOT_FOUND;

  const titleOut = matched.title;

  const breadcrumbs = matched.breadcrumbs ? matched.breadcrumbs(matchedParams) : undefined;
  const extraJsonLd = matched.jsonLd ? matched.jsonLd(matchedParams, path) : undefined;

  const webPage = {
    "@context": "https://schema.org",
    "@type": matched.type === "article" ? "Article" : "WebPage",
    name: titleOut,
    description: matched.description,
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    isPartOf: { "@id": `${SITE_URL}#website` },
    ...(matched.type === "article"
      ? {
          headline: titleOut,
          publisher: { "@id": `${SITE_URL}#organization` },
        }
      : {}),
  };

  const jsonLd: Record<string, any>[] = [webPage];
  if (extraJsonLd) {
    if (Array.isArray(extraJsonLd)) jsonLd.push(...extraJsonLd);
    else jsonLd.push(extraJsonLd);
  }

  return (
    <SEO
      title={titleOut}
      description={matched.description}
      keywords={matched.keywords}
      path={path}
      type={matched.type || "website"}
      noIndex={matched.noIndex}
      breadcrumbs={breadcrumbs}
      jsonLd={jsonLd}
      hasUrdu={matched.hasUrdu}
    />
  );
};

export default RouteSEOInjector;
                                         
