// ─────────────────────────────────────────────────────────────────────────────
// scripts/seo-page-content.mjs — Build-time crawler-readable page content
//
// PURPOSE
// ───────
// Every public page of the site is a client-rendered React component. When the
// Chromium prerender step cannot run (browser unavailable on a CI builder, or
// a route fails to render), AI/search crawlers would otherwise receive the
// bare 3.3 KB SPA shell — which contains ~60 characters of readable text and
// is exactly the "discoverable but unreadable" problem reported with ChatGPT
// and friends.
//
// This module is the guaranteed floor: for EVERY public route it carries real,
// accurate, crawler-readable HTML (headings, paragraphs, lists, internal
// links) plus per-route <title>/meta description/JSON-LD. The prerender
// pipeline injects this content into the built shell and writes it to
// dist/<route>/index.html whenever (and only whenever) the Chromium render did
// not produce a full page for that route.
//
// FACTS: all school facts below mirror api/llms.js (phone, email, principal,
// BISE Peshawar affiliation, 1st Year and 2nd Year …) so crawlers never read
// conflicting information. When something about the school changes, update it
// in api/llms.js AND here.
//
// The React app replaces this static block the moment it mounts, so human
// visitors always see the live interactive site.
// ─────────────────────────────────────────────────────────────────────────────

import { FAQ_ITEMS, FAQ_CATEGORIES } from "../src/data/faqData.mjs";

export const SITE_URL = "https://ghssghallanai.dpdns.org";
export const SITE_NAME = "GHSS Ghallanai";
export const SITE_LONG_NAME = "Government Higher Secondary School Ghallanai, District Mohmand";

const SCHOOL_FACTS = [
  "Full name: Government Higher Secondary School Ghallanai (GHSS Ghallanai)",
  "Location: Ghallanai, District Mohmand, Khyber Pakhtunkhwa (KPK), Pakistan",
  "Principal: (set by the school office)",
  "Classes offered: 1st Year and 2nd Year (HSSC — classes 11 and 12)",
  "Board affiliation: BISE Peshawar — 1st Year and 2nd Year sit board examinations",
  "Phone: (set by the school office)",
  "Email: (set by the school office)",
];

// Main public navigation — appended to every fallback page as internal links
// so crawlers can discover every section from any single page.
// ── Navbar links ────────────────────────────────────────────────────────────
// SHARED: the canonical list of public routes lives in scripts/site-routes.mjs
// and is imported (not copied) here. The same list drives the middleware's
// 404 decisions, the sitemap generator (api/seo.js) and the live renderer
// (api/render.js). Four private copies of "which URLs exist" is how the route
// lists drifted apart and turned every unknown URL into a 200 + homepage.
//
// Re-exported from here so existing importers keep working unchanged.
export { NAV_LINKS } from "./site-routes.mjs";
import { NAV_LINKS } from "./site-routes.mjs";

// ── Per-route content ────────────────────────────────────────────────────────
// blocks: h2 = section heading, p = paragraph, ul = bullet list,
//         links = [label, href] rendered as a list (e.g. latest notices).
const PAGES = {
  "/": {
    title: "GHSS Ghallanai — Government Higher Secondary School, District Mohmand KPK",
    description:
      "Official website of Government Higher Secondary School (GHSS) Ghallanai, District Mohmand, KPK, Pakistan. Online admission applications, exam results by roll number, notices, free past papers, and teacher directory for 1st Year and 2nd Year.",
    h1: "Government Higher Secondary School Ghallanai — District Mohmand, KPK",
    blocks: [
      {
        p: [
          "Government Higher Secondary School (GHSS) Ghallanai is a government higher secondary school in Ghallanai, District Mohmand, Khyber Pakhtunkhwa, Pakistan. The school offers 1st Year and 2nd Year (HSSC — classes 11 and 12) and is affiliated with BISE Peshawar, the Board of Intermediate and Secondary Education Peshawar, whose examinations our 1st Year and 2nd Year students sit every year.",
          "This official website is the school's digital front door. Students and parents can apply for admission online, search exam results by roll number, read official notices, download free past papers, browse the teacher directory and view photos of school events. The site also works as a Progressive Web App (PWA), so it can be installed on a phone and used offline.",
        ],
      },
      // Filled at build time with the REAL numbers from school_settings —
      // AI tools must read actual statistics, never a "0+" placeholder.
      { h2: "School at a glance", __stats: true },
      {
        h2: "What you can do on this website",
        ul: [
          "Apply online for admission to 1st Year and 2nd Year and track your application status by reference number, B-Form number or contact number",
          "Search school exam results by roll number (1st/2nd semester for 1st Year and 2nd Year)",
          "Search BISE Peshawar board results (HSSC 1st Year/2nd Year) live from the official board portal",
          "View the official Merit List — top position holders of each class and school-wide rankings with pass statistics",
          "Find, download and share your exam Roll No. Slip with its QR code and the exam date sheet",
          "Read official notices — holidays, exam schedules, fee deadlines and parent-teacher meetings",
          "Browse the teaching staff directory",
        ],
      },
      { h2: "Latest notices", links: { source: "notices", empty: "Open the Notices page for the latest official notices." } },
    ],
  },

  "/about": {
    title: "About Us — GHSS Ghallanai, District Mohmand",
    description:
      "About Government Higher Secondary School Ghallanai, District Mohmand, KPK: principal set by the school office, 1st Year and 2nd Year (HSSC), affiliated with BISE Peshawar. Our mission, vision and values.",
    h1: "About GHSS Ghallanai",
    blocks: [
      {
        p: [
          "Government Higher Secondary School Ghallanai is a public higher secondary school serving Ghallanai and the surrounding villages of District Mohmand, Khyber Pakhtunkhwa, Pakistan. The school operates under the Elementary & Secondary Education Department of Khyber Pakhtunkhwa. It educates students in 1st Year and 2nd Year (HSSC — classes 11 and 12), preparing them for the Higher Secondary School Certificate examinations conducted by BISE Peshawar.",
          "The school serves a rural tribal district, and its mission is to give every child of the area access to qualified teachers, a proper science education and modern learning tools — free of cost, as provided by the Government of Khyber Pakhtunkhwa. Students receive free textbooks under the provincial free textbook scheme, and the school building houses science facilities, a library corner and a playground for sports and assemblies.",
        ],
      },
      {
        h2: "Mission",
        p: [
          "Our mission is to provide quality, accessible and free education to the children of Ghallanai and nearby areas of District Mohmand; to build strong foundations in mathematics, science, languages and computer literacy; and to prepare students to pass their board examinations with confidence and continue on to colleges and universities across Pakistan.",
        ],
      },
      {
        h2: "Vision",
        p: [
          "Our vision is an educated Mohmand: a generation of students from this region who can compete with students anywhere in Pakistan, who respect knowledge and teachers, and who return to serve their community as doctors, engineers, teachers, officers and skilled professionals.",
        ],
      },
      {
        h2: "School facts",
        ul: SCHOOL_FACTS,
      },
      // Real numbers from school_settings, injected at build time.
      { h2: "School at a glance", __stats: true },
    ],
  },

  "/contact": {
    title: "Contact Us — GHSS Ghallanai, District Mohmand",
    description:
      "Contact Government Higher Secondary School Ghallanai: phone and email set by the school office, Ghallanai, District Mohmand, Khyber Pakhtunkhwa, Pakistan. Contact form, WhatsApp and location map.",
    h1: "Contact GHSS Ghallanai",
    blocks: [
      {
        p: [
          "Parents, guardians and students are welcome to contact the school for admission queries, result verification, notices or any other matter. During working days the school office is open in the morning shift; a contact form and WhatsApp option are also available on this page for written queries, and an embedded map shows the school location in Ghallanai, District Mohmand.",
        ],
      },
      {
        h2: "Contact details",
        ul: [
          "School: Government Higher Secondary School Ghallanai",
          "Address: Ghallanai, District Mohmand, Khyber Pakhtunkhwa, Pakistan",
          "Phone: (set by the school office)",
          "Email: (set by the school office)",
          "Principal: (set by the school office)",
          "Facebook page: https://www.facebook.com/share/1EERTSk1W7/",
        ],
      },
      {
        p: [
          "For admission questions, please first check the Admission page — it explains eligibility, required documents and the online application process, and lets you track an already-submitted application. For exam dates and holidays, see the Notices page, which is updated by the school administration throughout the year.",
        ],
      },
    ],
  },

  "/admission": {
    title: "Admission — GHSS Ghallanai (1st Year and 2nd Year)",
    description:
      "Apply online for Intermediate admission at GHSS Ghallanai, District Mohmand — 1st Year and 2nd Year. Create an account, complete your profiles, submit your application, pay the processing fee online (Easypaisa / wallet) and track your application by Tracking ID.",
    h1: "Intermediate Admissions — Apply Online",
    blocks: [
      {
        p: [
          "Admission to 1st Year and 2nd Year (Intermediate: Arts, Pre-Medical, Pre-Engineering and ICS) at Government Higher Secondary School Ghallanai follows a fully online process. All applications are submitted online — no manual or postal forms are accepted. For each different category (quota) or program, a separate application must be submitted, with an Rs 100 processing fee per application payable at any JazzCash shop or through the JazzCash App.",
        ],
      },
      {
        h2: "How to apply",
        ul: [
          "Create your account with CNIC/Form-B (13 digits), mobile number and a password",
          "Complete your Personal Information profile (name, father's name, date of birth, domicile district, tehsil, union council, parents' details)",
          "Complete your Matric (SSC) profile — board, session, passing year, study group, roll number and marks (grade is computed automatically)",
          "Submit a New Admission Request — select the program and category of admission (quota) and agree to the declaration",
          "Confirm your application and pay the processing fee online (Easypaisa / wallet) — you receive a payment reference with a deadline",
          "Track your application any time with your Tracking ID (for example NOV2026…)",
          "Print your application form and visit the college with all original documents to complete your admission",
        ],
      },
      {
        h2: "Categories of admission (quotas)",
        ul: [
          "Open Merit — for applicants whose domicile/union council is outside District Mohmand",
          "Local Quota — for applicants domiciled in District Mohmand (also considered in Open Merit)",
          "Sports — a sports participation certificate is required",
          "College Employees — for children of college employees (payslip required)",
          "Special Person — nature of disability is required",
        ],
      },
      {
        h2: "Track application",
        ul: [
          "Enter the Tracking ID you received when you submitted your application",
          "The tracker shows your program, payment status, application date and status timeline",
          "No login is required — the tracker is public",
        ],
      },
      // Filled at build time (prerender-lib.mjs) with the ACTUAL admin-uploaded
      // admission files (category "Admission" in the library) — direct download
      // URLs, so even a static snapshot points AI tools at the real forms.
      {
        h2: "Downloadable admission documents",
        links: {
          source: "admission-files",
          empty: "The admission prospectus, fee structure, transfer letter and rules are generated directly on the Admission page — open it in a browser and use the download buttons.",
        },
      },
    ],
  },

  "/notices": {
    title: "Notices — GHSS Ghallanai, District Mohmand",
    description:
      "Official notices of Government Higher Secondary School Ghallanai — holidays, exam schedules and date sheets, fee deadlines, parent-teacher meetings and urgent announcements for students and parents.",
    h1: "Official Notices",
    blocks: [
      {
        p: [
          "This page lists the official notices of Government Higher Secondary School Ghallanai, District Mohmand. The school administration publishes exam schedules and date sheets, holiday announcements, fee deadlines, parent-teacher meeting dates and other urgent information here. Each notice shows its publication date and category, and urgent notices are highlighted at the top. Open any notice to read the full details.",
        ],
      },
      { h2: "Recent notices", links: { source: "notices", empty: "All current notices are listed on this page." } },
    ],
  },

  "/teachers": {
    title: "Teachers — Staff Directory | GHSS Ghallanai",
    description:
      "Teaching staff of Government Higher Secondary School Ghallanai, District Mohmand — subject teachers for 1st Year and 2nd Year with qualifications, and the principal .",
    h1: "Our Teachers",
    blocks: [
      {
        p: [
          "Government Higher Secondary School Ghallanai is staffed by qualified subject teachers appointed through the Khyber Pakhtunkhwa Elementary & Secondary Education Department. The staff directory on this page lists the teaching staff with their subjects and qualifications. Teachers cover Mathematics, Physics, Chemistry, Biology, English, Urdu, Islamiat, Pakistan Studies and Computer Science for 1st Year and 2nd Year.",
        ],
      },
    ],
  },

  "/library": {
    title: "Library — Downloads & Past Papers | GHSS Ghallanai",
    description:
      "Digital library of GHSS Ghallanai — free downloadable study materials, books, notes, past papers and forms for 1st Year and 2nd Year, organised by category (Past Papers, Books, Notes, Assignments, Admission) and class.",
    h1: "School Library",
    blocks: [
      {
        p: [
          "The digital library page hosts the study resources of Government Higher Secondary School Ghallanai: downloadable books, past papers and helping materials for 1st Year and 2nd Year, organised by category and class. Students preparing for school exams and BISE Peshawar board examinations can download the materials free of cost and read them offline after installing the site as an app.",
          "The library is organised by category — Past Papers, Books, Notes, Assignments, Admission and Other — and can be filtered by class and searched by title. Every item shows its category and class, and downloads are counted so the school can see which materials students use most. Library items are added by the school administration throughout the year.",
        ],
      },
      { h2: "Latest library items", links: { source: "library", empty: "Library items will be listed here as soon as the school administration adds them." } },
      {
        h2: "What you can find in the library",
        ul: [
          "Past Papers — BISE Peshawar style question papers and school exam papers for exam preparation",
          "Books — reference books and reading material in PDF or link form",
          "Assignments and worksheets for practice",
          "Admission-related forms and documents",
        ],
      },
    ],
  },



  // /results — was MISSING from this map until Nov 2026. Consequence: the
  // static fallback (and with it the whole crawler guarantee) silently
  // skipped the school's HIGHEST-PRIORITY SEO page — the sitemap even marks
  // it priority 1.0/daily ("primary landing page for our highest-intent
  // keywords", api/seo.js). Title/description mirror RouteSEOInjector.tsx
  // and the body mirrors ResultsSeoContent.tsx so the prerendered page, the
  // live renderer and the React app all tell Google the same story.
  "/results": {
    title: "BISE Peshawar Result — HSSC Result, BISEP Result, Peshawar Board Result | GHSS Ghallanai",
    description:
      "Check BISE Peshawar Result by roll number — HSSC Result (1st Year & 2nd Year), BISEP Result, Peshawar Board Result, Annual-I & Annual-II exams. Fast, free, mobile-friendly BISE Peshawar board result lookup powered by GHSS Ghallanai.",
    h1: "Exam Results",
    blocks: [
      {
        p: [
          "The Results page of Government Higher Secondary School Ghallanai lets students check examination results by roll number. It covers both the school's own 1st/2nd semester results for 1st Year and 2nd Year, and the BISE Peshawar board (BISEP) HSSC results, which are fetched live from the board's official portal at cloud.bisep.edu.pk through a cached proxy and displayed in a clean, mobile-friendly result card.",
          "Searching is simple: type your roll number into the Roll No field and tap Search Result. The result card shows the student's name, father's name, total marks, obtained marks, grade, remarks and the subject-wise theory and practical marks. Results can be saved as a shareable marks card, and the page also shows a live countdown while a BISE Peshawar announcement is pending.",
        ],
      },
      {
        h2: "How to check a result",
        ul: [
          "Find your roll number on your roll number slip (or ask the school office)",
          "Type the roll number into the Roll No field — digits only, no spaces or dashes",
          "Tap Search Result — your result is fetched from the official source and displayed instantly",
          "Review your marks, grade and subject-wise breakdown, then screenshot or share your marks card",
          "Collect the original Detailed Marks Certificate (DMC) from your school or the board office",
        ],
      },
      {
        h2: "BISE Peshawar result types on this page",
        ul: [
          "HSSC Annual-I Result (1st Year / Class 11) — Pre-Medical, Pre-Engineering, ICS and Humanities groups",
          "HSSC Annual-II Result (2nd Year / Class 12 / Intermediate)",
          "HSSC Supplementary Result — the second-chance exam for students who failed a subject",
        ],
      },
      {
        h2: "BISE Peshawar grading system",
        ul: [
          "A-1 (A-One): 80% and above",
          "A: 70% to 79%",
          "B: 60% to 69%",
          "C: 50% to 59%",
          "D: 40% to 49%",
          "E: 33% to 39%",
          "F (Fail): below 33%",
        ],
      },
      {
        p: [
          "The HSSC-II (2nd Year) result is typically declared in the last week of July or the first week of August, and the HSSC-I (1st Year) result in August or September. To pass a subject, a student needs at least 33% in theory and practical separately. Once the board announces a result, it is searchable on this page immediately.",
        ],
      },
    ],
  },

  "/merit-list": {
    title: "Merit List — Toppers & Position Holders | GHSS Ghallanai",
    description:
      "Official merit list of GHSS Ghallanai — top position holders of each class and school-wide exam rankings with marks, percentages, grades and pass statistics, published by the school office.",
    h1: "Merit List",
    blocks: [
      {
        p: [
          "The Merit List page shows the official examination rankings of Government Higher Secondary School Ghallanai as published by the school office. Each list covers one exam — 1st or 2nd semester for 1st Year and 2nd Year, or a school-wide list — and shows every listed student's position, name, class, obtained marks, percentage and grade, together with summary statistics such as the total number of students, the passing count, the highest percentage and the average. When the school schedules a merit list in advance, the page shows a live countdown and the rankings appear automatically the moment it reaches zero. A published merit list can also be shared directly from the page as a merit card.",
        ],
      },
    ],
  },

  "/roll-no-slip": {
    title: "Roll No. Slip — Exam Admit Card Finder | GHSS Ghallanai",
    description:
      "Exam roll number slips of GHSS Ghallanai — students pick their class and type their full name to view, download (PDF with QR code) or share their own slip, with the exam date sheet and exam-day instructions.",
    h1: "Roll No. Slip",
    blocks: [
      {
        p: [
          "Exam roll number slips are released on this page by the school administration. While a release is scheduled, a live countdown shows exactly when the slips appear, and the page flips automatically the moment the countdown reaches zero. Once live, a student picks their class (1st Year or 2nd Year) and types their full name — only their own slip appears, keeping every other student's slip private. Each slip is an exact replica of the office copy: the school header, the student's information with exam roll number and QR code, the class's exam date sheet and the nine exam-day instructions, and it can be downloaded as a PDF identical to the printed version or shared. Students must bring the slip to every paper — no slip, no entry to the examination hall.",
        ],
      },
    ],
  },


  "/faq": {
    title: "FAQ — Frequently Asked Questions | GHSS Ghallanai",
    description:
      "Frequently asked questions about GHSS Ghallanai: admission procedure and documents, application tracking, results and grading, BISE Peshawar board exams, library, contact details and how to install the website as an app.",
    h1: "Frequently Asked Questions",
    blocks: FAQ_CATEGORIES.map((category) => ({
      h2: category,
      // Q&A articles are rendered by the build-time filler below (faqHtml)
      // and by api/render.js live — all from the same canonical dataset.
      __faqCategory: category,
    })),
  },
};

// ── Universal "School at a glance" statistics block ──────────────────────────
// Every public page carries the real, admin-maintained numbers (students,
// teachers, pass rate) so AI tools quote correct statistics from ANY page
// they read — not only from / and /about, which previously were the only
// pages with a stats slot. The `<ul data-ghss-stats></ul>` placeholder is
// filled with real values in BOTH delivery paths:
//   • build time — prerender-lib.mjs (static fallback pages), and
//   • on request — api/render.js (live-rendered crawler HTML).
// Pages that already declare their own __stats block ("/" and "/about") are
// left untouched.
for (const [route, page] of Object.entries(PAGES)) {
  if (!Array.isArray(page.blocks)) continue;
  if (page.blocks.some((b) => b && b.__stats)) continue;
  // Insert after the leading intro paragraph(s) and before the first
  // dynamic/FAQ list so the page reads: intro → facts → lists.
  const firstListIdx = page.blocks.findIndex((b) => b && (b.links || b.__faqCategory));
  const insertAt = firstListIdx === -1 ? page.blocks.length : firstListIdx;
  page.blocks.splice(insertAt, 0, { h2: "School at a glance", __stats: true });
}

// ── HTML builders ────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildContentHtml(route) {
  const page = PAGES[route];
  const parts = [];

  for (const block of page.blocks) {
    if (block.__stats) {
      // "School at a glance" — filled with real numbers from school_settings
      // by the prerender pipeline (see prerender-lib.mjs). The empty-state
      // line is removed when real stats are injected.
      if (block.h2) parts.push(`<h2>${escapeHtml(block.h2)}</h2>`);
      parts.push(`<ul data-ghss-stats></ul>`);
      parts.push(
        `<p data-ghss-stats-empty>Exact enrolment and staff numbers are maintained by the school administration.</p>`
      );
      continue;
    }
    if (block.__faqCategory) {
      // FAQ page — render every canonical Q&A of this category (src/data/faqData.mjs).
      if (block.h2) parts.push(`<h2>${escapeHtml(block.h2)}</h2>`);
      const items = FAQ_ITEMS.filter((it) => it.category === block.__faqCategory);
      for (const it of items) {
        parts.push(
          `<article><h3>${escapeHtml(it.question)}</h3><p>${escapeHtml(it.answer)}</p></article>`
        );
      }
      continue;
    }
    if (block.h2) parts.push(`<h2>${escapeHtml(block.h2)}</h2>`);
    if (block.p) for (const para of block.p) parts.push(`<p>${escapeHtml(para)}</p>`);
    if (block.ul)
      parts.push(
        `<ul>${block.ul.map((li) => `<li>${escapeHtml(li)}</li>`).join("")}</ul>`
      );
    if (block.links) {
      // Dynamic lists (latest notices) are filled by the prerender lib
      // at build time; here we only render the container marker.
      const src = block.links.source;
      parts.push(`<ul data-ghss-list="${src}"></ul>`);
      parts.push(`<p data-ghss-empty="${src}">${escapeHtml(block.links.empty || "")}</p>`);
      if (block.links.nav) {
        parts.push(
          `<ul>${NAV_LINKS.filter(([label, href]) => href !== route)
            .map(([label, href]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`)
            .join("")}</ul>`
        );
      }
    }
  }

  // Every fallback page ends with the full public navigation.
  parts.push(`<h2>Website sections</h2>`);
  parts.push(
    `<ul>${NAV_LINKS.filter(([label, href]) => href !== route)
      .map(([label, href]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`)
      .join("")}</ul>`
  );
  parts.push(
    `<p>Contact: Government Higher Secondary School Ghallanai, District Mohmand, KPK, Pakistan. Machine-readable facts for AI tools: ${SITE_URL}/llms.txt and ${SITE_URL}/api/ai-data</p>`
  );

  return parts.join("\n      ");
}

export function getPageMeta(route) {
  return PAGES[route] || null;
}

// Same @id values as src/components/seo/SiteSchema.tsx and api/render.js so
// that whichever layer a crawler happens to see (React-hydrated page,
// live-rendered crawler HTML, or this build-time static fallback), the
// entities merge into ONE schema.org graph instead of three conflicting
// ones. This fallback only ships on routes where the Chromium prerender
// phase could not produce a full render — it is the guaranteed floor, not
// a duplicate of the React graph.
export function buildJsonLd(route) {
  const page = PAGES[route];
  if (!page) return "";
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["EducationalOrganization", "HighSchool"],
        "@id": `${SITE_URL}#organization`,
        name: SITE_LONG_NAME,
        alternateName: SITE_NAME,
        url: SITE_URL,
        address: {
          "@type": "PostalAddress",
          streetAddress: "Ghallanai",
          addressLocality: "Ghallanai",
          addressRegion: "Khyber Pakhtunkhwa",
          addressCountry: "PK",
        },
        areaServed: {
          "@type": "AdministrativeArea",
          name: "District Mohmand, Khyber Pakhtunkhwa, Pakistan",
        },
        sameAs: ["https://www.facebook.com/share/1EERTSk1W7/"],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}#website`,
        name: SITE_LONG_NAME,
        url: SITE_URL,
        publisher: { "@id": `${SITE_URL}#organization` },
      },
      {
        "@type": "WebPage",
        name: page.title,
        description: page.description,
        url: `${SITE_URL}${route === "/" ? "/" : route}`,
        isPartOf: { "@id": `${SITE_URL}#website` },
      },
    ],
  };
  if (route === "/faq") {
    graph["@graph"].push({
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: { "@type": "Answer", text: item.answer },
      })),
    });
  }
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}

// ── Notice-detail fallback pages (/notices/<id>) ─────────────────────────────
// The sitemap (api/seo.js, DETAIL_PAGE_LIMIT = 200) advertises notice-detail
// URLs, but the Chromium prerender phase renders only the newest 20 — and
// ZERO on builders where a browser cannot launch (Vercel's build image lacks
// Chromium's system libraries). Every sitemap notice URL without a file then
// serves the SPA shell → duplicate/soft-404 → not indexed. The static
// fallback therefore also writes notice-detail pages from build-time data.
// Title/description/h1 formats mirror api/render.js and NoticeDetail.tsx so
// every delivery layer (React app, live renderer, static fallback) shows the
// SAME <title> for the same URL — no conflicting signals for Google.

export function getNoticeDetailMeta(notice) {
  const plain = String(notice.content || "")
    .replace(/\s+/g, " ")
    .trim();
  const clipped = plain ? plain.slice(0, 155) + (plain.length > 155 ? "…" : "") : "";
  return {
    title: `${notice.title} — Notice | GHSS Ghallanai`,
    description:
      clipped ||
      "Official notice from Government Higher Secondary School Ghallanai, District Mohmand, KPK, Pakistan.",
    h1: notice.title,
  };
}

function prettyNoticeDate(iso) {
  const d = iso ? new Date(iso) : null;
  return d && !isNaN(d.getTime())
    ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "";
}

export function buildNoticeContentHtml(notice) {
  const parts = [];

  const metaBits = [];
  const date = prettyNoticeDate(notice.created_at);
  if (date) metaBits.push(escapeHtml(date));
  if (notice.category) metaBits.push(escapeHtml(notice.category));
  if (notice.is_urgent) metaBits.push("<strong>URGENT</strong>");
  if (metaBits.length) parts.push(`<p>${metaBits.join(" · ")}</p>`);

  const body = String(notice.content || "").trim();
  if (body) {
    parts.push(
      body
        .slice(0, 4000)
        .split(/\n{2,}|\n/)
        .filter((p) => p.trim())
        .map((p) => `<p>${escapeHtml(p.trim())}</p>`)
        .join("\n")
    );
  } else {
    parts.push(
      `<p>Open the notice on the website for the full text, or contact the school office.</p>`
    );
  }
  parts.push(`<p><a href="/notices">← All notices</a></p>`);

  // Standard footer — identical to every static fallback page.
  parts.push(`<h2>Website sections</h2>`);
  parts.push(
    `<ul>${NAV_LINKS.map(([label, href]) => `<li><a href="${href}">${escapeHtml(label)}</a></li>`).join("")}</ul>`
  );
  parts.push(
    `<p>Contact: Government Higher Secondary School Ghallanai, District Mohmand, KPK, Pakistan. Machine-readable facts for AI tools: ${SITE_URL}/llms.txt and ${SITE_URL}/api/ai-data</p>`
  );
  return parts.join("\n      ");
}

// Article + Breadcrumb JSON-LD — same node shapes as api/render.js so all
// delivery layers merge into ONE schema.org graph.
export function buildNoticeDetailJsonLd(notice, route) {
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["EducationalOrganization", "HighSchool"],
        "@id": `${SITE_URL}#organization`,
        name: SITE_LONG_NAME,
        alternateName: SITE_NAME,
        url: SITE_URL,
        address: {
          "@type": "PostalAddress",
          streetAddress: "Ghallanai",
          addressLocality: "Ghallanai",
          addressRegion: "Khyber Pakhtunkhwa",
          addressCountry: "PK",
        },
        areaServed: {
          "@type": "AdministrativeArea",
          name: "District Mohmand, Khyber Pakhtunkhwa, Pakistan",
        },
        sameAs: ["https://www.facebook.com/share/1EERTSk1W7/"],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}#website`,
        name: SITE_LONG_NAME,
        url: SITE_URL,
        publisher: { "@id": `${SITE_URL}#organization` },
      },
      {
        "@type": "Article",
        headline: notice.title,
        ...(notice.created_at ? { datePublished: notice.created_at } : {}),
        author: { "@type": "Organization", name: SITE_NAME },
        publisher: { "@type": "Organization", name: SITE_NAME },
        mainEntityOfPage: `${SITE_URL}${route}`,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Notices", item: `${SITE_URL}/notices` },
          { "@type": "ListItem", position: 3, name: notice.title, item: `${SITE_URL}${route}` },
        ],
      },
    ],
  };
  return JSON.stringify(graph).replace(/</g, "\\u003c");
}

/**
 * Build the complete fallback HTML for one route by taking the BUILT shell
 * (dist/index.html, which already references the hashed CSS + JS bundles)
 * and injecting per-route SEO tags plus the visible static content block
 * inside #root. The React app replaces the block when it mounts.
 *
 * `noticeDetail` (optional): a notice row { id, title, content, category,
 * is_urgent, created_at } — when present, the page is built from the notice
 * itself instead of the static PAGES map (used for /notices/<id> fallbacks).
 */
export function buildFallbackHtml(shellHtml, route, listFiller, noticeDetail = null) {
  const page = noticeDetail ? getNoticeDetailMeta(noticeDetail) : PAGES[route];
  if (!page || !shellHtml) return null;

  const canonical = `${SITE_URL}${route === "/" ? "/" : route}`;
  let html = noticeDetail ? buildNoticeContentHtml(noticeDetail) : buildContentHtml(route);
  if (listFiller) html = listFiller(html);

  const jsonLd = noticeDetail ? buildNoticeDetailJsonLd(noticeDetail, route) : buildJsonLd(route);
  const seoHead = `
    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <link rel="canonical" href="${canonical}" />
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
    <meta property="og:type" content="${noticeDetail ? "article" : "website"}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:title" content="${escapeHtml(page.title)}" />
    <meta property="og:description" content="${escapeHtml(page.description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${SITE_URL}/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.title)}" />
    <meta name="twitter:description" content="${escapeHtml(page.description)}" />
    <script type="application/ld+json">${jsonLd}</script>`;

  const staticBlock = `
      <div class="ghss-seo-static" style="max-width:860px;margin:0 auto;padding:32px 20px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#0f172a;background:#ffffff;line-height:1.75">
        <h1 style="font-size:1.7em;line-height:1.25;margin:0 0 18px">${escapeHtml(page.h1)}</h1>
      ${html}
      </div>
      <!-- Static crawler-readable content injected at build time. The React app
           replaces this block with the live interactive page on mount. -->`;

  let out = shellHtml;

  // ── ROOT-CAUSE FIX (Nov 2026): robust #root injection ────────────────────
  // The previous code injected with out.replace(/<div id="root"><\/div>/, …),
  // which requires an EMPTY root div. The real shell ships a <noscript> block
  // (plus comments) inside #root, so the pattern NEVER matched, this function
  // returned null for EVERY route, and the "guaranteed" static fallback
  // silently wrote ZERO pages. On builders where Chromium cannot launch
  // (Vercel), the deployment then contained only the SPA shell: every
  // vercel.json route rewrite fell through to the catch-all /index.html and
  // Google received byte-identical homepage HTML for every URL — a soft-404
  // storm that kept ALL pages out of the index for 10+ days (Search Console
  // "quota exceeded" on every Request Indexing attempt).
  //
  // The injection now targets the OPENING #root tag whatever it contains.

  // 1) Drop the shell's generic head tags FIRST — seoHead (injected below)
  //    carries the per-route versions, and leaving both would give crawlers
  //    two conflicting descriptions / og: sets / robots directives, plus a
  //    SECOND schema.org graph whose @ids differ by a trailing slash
  //    ("…org/#organization" vs "…org#organization") — two organization
  //    entities instead of one. Removal must happen BEFORE injection, or it
  //    would strip seoHead's own tags.
  //    Patterns are attribute-order-agnostic (/gi, [^>]*) so they ALSO clean
  //    Helmet-injected tags (data-rh="true" variants) in the corner case
  //    where the "shell" is actually a partially-rendered Chromium page
  //    (some routes rendered, others fell back).
  out = out
    .replace(/<meta\s+name=(["'])description\1[^>]*>/gi, "")
    .replace(/<meta\s+property=(["'])og:(?:title|description|url|type|site_name|image)\1[^>]*>/gi, "")
    .replace(/<meta\s+name=(["'])twitter:(?:card|title|description|image)\1[^>]*>/gi, "")
    .replace(/<meta\s+name=(["'])robots\1[^>]*>/gi, "")
    .replace(/<link\b[^>]*\brel=(["'])canonical\1[^>]*>/gi, "")
    .replace(/<script\b[^>]*type=(["'])application\/ld\+json\1[^>]*>[\s\S]*?<\/script>/gi, "");

  // 2) Per-route head. Replacer FUNCTIONS are mandatory here: a plain string
  //    replacement would interpret $-sequences ($&, $', $`, $$) inside the
  //    JSON-LD/content and silently corrupt the page.
  if (/<title>[\s\S]*?<\/title>/.test(out)) {
    out = out.replace(/<title>[\s\S]*?<\/title>/, () => seoHead);
  } else if (/<head\b[^>]*>/i.test(out)) {
    // Shell without a <title> — inject right after <head> instead.
    out = out.replace(/<head\b[^>]*>/i, (m) => `${m}${seoHead}`);
  } else {
    return null; // no <head> and no <title> — not a usable shell
  }

  // 3) Inject the static block inside #root, BEFORE the existing <noscript>
  //    (kept for no-JS browsers). React replaces all #root children on
  //    mount, so real visitors still get the live interactive page.
  const rootOpenRe = /<div\b[^>]*\bid=(?:"root"|'root'|root)[^>]*>/i;
  if (!rootOpenRe.test(out)) return null; // shell without #root — give up
  out = out.replace(rootOpenRe, (m) => `${m}${staticBlock}`);

  if (!out.includes('rel="canonical"') || !out.includes("ghss-seo-static")) return null; // injection failed
  return out;
}
