// ─────────────────────────────────────────────────────────────────────────────
// src/data/faqData.mjs — CANONICAL FAQ dataset (single source of truth)
//
// ONE file, consumers that can never drift apart:
//   1. src/pages/FAQ.tsx                        → the public /faq page
//   2. src/components/seo/RouteSEOInjector.tsx  → FAQPage JSON-LD
//   3. api/render.js                            → crawler HTML + AI data feed
//   4. scripts/seo-page-content.mjs             → build-time fallback page
//   5. api/ai-chat.ts                           → procedures for the AI assistant
//   6. src/components/shared/CommandPalette.tsx → FAQ search results
//
// v3 (2026-11) — rewritten to match the CURRENT website:
//   • duplicates merged (one answer per topic; no repeated school facts)
//   • admission: five real categories, merit lists, tracking, Safepay payment
//   • results: Exam Roll No OR Class + Class Roll No, semester naming
//   • search answer now describes the new Search / command palette
//
// CONTENT RULES
//   • Only verified facts. No invented dates, names or fees.
//   • LIVE values (admission open/closed, session, deadline, exact fee, result
//     schedule) are NOT hardcoded — they are shown on the pages and injected
//     live into the AI assistant. This file covers timeless procedure.
//   • Keep every answer self-contained (AI tools read single Q&As).
// ─────────────────────────────────────────────────────────────────────────────

export const FAQ_CATEGORIES = [
"Admissions",
"Results & Exams",
"School Information",
"Website & Contact",
];

export const FAQ_ITEMS = [
// ── Admissions ────────────────────────────────────────────────────────────
{
id: "adm-open",
category: "Admissions",
question: "Are admissions open right now, and what is the last date?",
answer:
"Admissions for 1st Year and 2nd Year (HSSC) are held every academic session. Whether online admission is open, the session year, the opening date and the last date are always shown live at the top of the Admission page (ghssghallanai.dpdns.org/admission) — the website closes the application automatically after the last date, and the deadline is final. The same status appears on the homepage and in the search box (Ctrl+K or the search icon).",
},
{
id: "adm-programs",
category: "Admissions",
question: "Which classes and programs can I apply for?",
answer:
"You can apply for 1st Year or 2nd Year (HSSC — classes 11 and 12). Four programs are offered: Pre-Medical, Pre-Engineering, ICS (Computer Sciences) and Arts/Humanities. The programs and the number of seats open in the current session are listed in the “Programs & Seats” table on the Admission page. The school is affiliated with BISE Peshawar for the board examinations.",
},
{
id: "adm-how",
category: "Admissions",
question: "How do I apply online, step by step?",
answer:
"Step 1: open the Admission page and tap “Apply Online” (while admission is open). Step 2: fill in the Personal Information profile — name, father's name, CNIC/B-Form, date of birth, domicile district, tehsil, union council, mailing address and parents' details. Enter your mobile number carefully: it cannot be changed later and is used for fee payment and SMS alerts. Step 3: complete the Matric (SSC) profile — board, session, passing year, study group, roll number and marks. Step 4: submit a new admission request by choosing the program and the admission category, then confirm the declaration. Step 5: pay the processing fee before the deadline. Step 6: track your application with your Tracking ID, print the application form and bring it with your original documents to the school office. Fields marked * are mandatory and false information cancels the application. You may also submit your application in person at the school office; postal forms are not accepted.",
},
{
id: "adm-categories",
category: "Admissions",
question: "What are the admission categories (quotas) and which one should I choose?",
answer:
"There are five categories: Open Merit, Local Quota, Sports, College Employees and Special Person. Applicants who are local — domicile of the local area (District Mohmand) or a parent/spouse posted as a government servant in the district — must apply on Local Quota; Open Merit is for non-local applicants, and Local Quota is also counted in Open Merit. Only one application is allowed per category in the same program, and a separate application is needed for each category or program. Applicants who are overage need an age relaxation certificate and are not eligible for the Sports category.",
},
{
id: "adm-documents",
category: "Admissions",
question: "Which documents do I need for admission?",
answer:
"Keep these ready: the student's B-Form/CNIC (NADRA), the SSC (Matric) result card/DMC, a recent passport-size photograph, a copy of the father's or guardian's CNIC, and the fee payment confirmation. Category documents are needed where applicable: a sports certificate (Sports), a payslip or proof of employment (College Employees), a disability certificate (Special Person) and an age relaxation certificate for overage applicants. Bring the originals to the school office to complete the admission. Any extra requirement is announced on the Notices page.",
},
{
id: "adm-fee",
category: "Admissions",
question: "Is there a fee for the online admission application, and how do I pay it?",
answer:
"Yes. Each application carries a small processing fee set by the school; the exact current amount is shown on the Admission page and in the application. You can pay online through Safepay using Easypaisa, JazzCash or another wallet — the payment is confirmed automatically — or by manual transfer to the school's account shown on the payment screen, quoting your payment reference. Pay before the deadline. A separate application, and fee, applies for each program or category. Any BISE Peshawar board fee is a board charge paid through the board's own channels.",
},
{
id: "adm-track",
category: "Admissions",
question: "How can I track my admission application?",
answer:
"Open the Admission page and use “Track Application”: enter the Tracking ID you received when you submitted (it looks like NOV2026-K7MQXA). It shows your program, category, payment status and current stage. No account or login is needed, so keep your Tracking ID safe — it is the only key to your application status.",
},
{
id: "adm-meritlist",
category: "Admissions",
question: "Where can I see the admission merit list?",
answer:
"Published admission merit lists appear on the Admission page under “Merit Lists”, one card per program and category. Open a card with “View Merit List” to see positions, names, marks and percentages, and search for your name or Tracking ID. The card also shows the admission start and last dates, and indicates whether an applicant is listed or not listed. Lists appear only after the school office publishes them; this is separate from the exam Merit List page.",
},
{
id: "adm-migration",
category: "Admissions",
question: "How does migration or transfer from another school or board work?",
answer:
"School admission and board migration are separate steps. For students moving from another school or board, the school office guides the process; board migration follows BISE Peshawar's rules and notified window, and any board migration fee is paid through the board's own channels. Contact the school office through the Contact page with your case.",
},

// ── Results & Exams ───────────────────────────────────────────────────────
{
id: "res-check",
category: "Results & Exams",
question: "How do I check my school exam result?",
answer:
"Open the Results page (ghssghallanai.dpdns.org/results), then search with your Exam Roll No — or, where the page offers it, with your Class and Class Roll No. The result card shows total and obtained marks, percentage, grade, pass/fail status and class position, and you can download the Report Card / DMC or share it. Results appear only after the school administration publishes them, so if nothing is found the exam may not be published yet; when a release is scheduled the page shows a live countdown.",
},
{
id: "res-exams",
category: "Results & Exams",
question: "Which exams does the school conduct?",
answer:
"1st Year and 2nd Year students sit the school's 1st Semester and 2nd Semester examinations, and also the BISE Peshawar HSSC board examinations (HSSC-I for 1st Year and HSSC-II for 2nd Year). School results are published on the Results page once released by the administration.",
},
{
id: "res-bisep",
category: "Results & Exams",
question: "How do I check my BISE Peshawar board result?",
answer:
"Use the BISE Peshawar section on the Results page: enter your board roll number and the website fetches the result live from the board's official portal (cloud.bisep.edu.pk). The website only reads the board's published result and does not store or change it. For rechecking or certificates, contact BISE Peshawar or the school office.",
},
{
id: "res-grades",
category: "Results & Exams",
question: "What is the grading scale for school results?",
answer:
"School results use a percentage scale: A+ for 90% and above, A for 80–89%, B for 60–79%, C for 45–59%, D for 33–44%, and Fail below 33%. A result card also shows the class position and a subject-wise breakdown of marks.",
},
{
id: "res-rollslip",
category: "Results & Exams",
question: "How do I get my exam roll number and Roll No. Slip?",
answer:
"Open the Roll No. Slip page (ghssghallanai.dpdns.org/roll-no-slip). If a release is scheduled, the page shows a live countdown and the slips appear automatically when it reaches zero. Then choose your class (1st Year or 2nd Year), type your full name as the school recorded it — capitalisation and extra spaces do not matter — and search. Only your own slip is shown. It carries your exam roll number and QR code, your class's date sheet and the exam-day instructions; download it as a PDF or share it, and bring it to every paper. For BISE Peshawar board exams, your official roll number is on the board admit card issued by the school.",
},
{
id: "res-datesheet",
category: "Results & Exams",
question: "Where do I find the exam date sheet?",
answer:
"Exam schedules and date sheets are published as official notices on the Notices page (ghssghallanai.dpdns.org/notices), and your class's date sheet is also printed on your Roll No. Slip once slips are released.",
},
{
id: "res-meritlist",
category: "Results & Exams",
question: "What is the Merit List page?",
answer:
"The Merit List page (ghssghallanai.dpdns.org/merit-list) shows the official exam rankings published by the school — top position holders per class and, for some exams, a school-wide list — with each student's position, name, class, marks, percentage and grade plus class statistics. When a list is scheduled, a live countdown shows and the rankings appear automatically at zero. A published list can be shared as a merit card. Admission merit lists are different and live on the Admission page.",
},
{
id: "res-recheck",
category: "Results & Exams",
question: "What if I find a mistake in my result?",
answer:
"For a school exam, contact the school office or your subject teacher so the marks can be verified against the answer sheet. For a BISE Peshawar result, rechecking requests must be submitted to the board within its notified window — the website only displays the board's result and cannot change it.",
},

// ── School Information ────────────────────────────────────────────────────
{
id: "sch-about",
category: "School Information",
question: "About GHSS Ghallanai: where is it, when was it established and what is its EMIS code?",
answer:
"Government Higher Secondary School (GHSS) Ghallanai was established in 1975 in Ghallanai, the headquarters of District Mohmand (formerly Mohmand Agency), Khyber Pakhtunkhwa, Pakistan. Its EMIS code in the KP Elementary & Secondary Education Department system is 60645. It offers 1st Year and 2nd Year (HSSC) and is affiliated with BISE Peshawar. The Contact page shows the location on a map, and ghssghallanai.dpdns.org is the school's official website.",
},
{
id: "sch-timing",
category: "School Information",
question: "What are the school timings and office hours?",
answer:
"Timings change with the season and government notifications, so they are not fixed here. Official timing changes, holidays and meeting dates are published on the Notices page; for the office, use the Contact page.",
},
{
id: "sch-teachers",
category: "School Information",
question: "Who are the teachers and what do they teach?",
answer:
"The Teachers page (ghssghallanai.dpdns.org/teachers) lists the active teaching staff with their subjects and qualifications as entered by the school administration. You can also find a teacher by name or subject from the search box.",
},

// ── Website & Contact ─────────────────────────────────────────────────────
{
id: "web-search",
category: "Website & Contact",
question: "How do I quickly find a page, notice, teacher or answer?",
answer:
"Tap the search icon in the navigation bar (or press Ctrl+K, or “/” on a keyboard). The search box shows quick actions — Apply for Admission with its live status, Track Application, Roll No. Slip, Results, Merit List, call or WhatsApp the school — and as you type it finds pages, FAQ answers, notices and teachers. The mic button supports voice search on supported browsers, and the Search page covers the whole site.",
},
{
id: "web-notices",
category: "Website & Contact",
question: "Where can I see the latest notices and announcements?",
answer:
"All official announcements — holidays, date sheets, admission and fee updates, circulars — are posted on the Notices page (ghssghallanai.dpdns.org/notices) as soon as the administration publishes them. The homepage also shows recent notices and news in a ticker, and you can allow notifications when the site offers them so you do not miss an urgent notice.",
},
{
id: "web-account",
category: "Website & Contact",
question: "Is the website free, and do I need an account?",
answer:
"The website is free and has no ads. Visitors, students and parents need no account for anything — notices, results, merit lists, roll number slips, the admission application and the tracker all work without signing up. The only charge is the per-application admission processing fee. The sign-in page is for the school administrator only.",
},
{
id: "web-contact",
category: "Website & Contact",
question: "How do I contact the school?",
answer:
"Use the Contact page (ghssghallanai.dpdns.org/contact): it shows the school's phone, email and map and has a message form. You can also message the school on WhatsApp at +92 345 9409585, and the school's Facebook page is linked from the Contact page and footer. For admission questions, read the Admission page and its FAQs first — they answer most queries.",
},
{
id: "web-pwa",
category: "Website & Contact",
question: "Can I install the website as an app or use it offline?",
answer:
"Yes. It is a Progressive Web App: in Chrome on Android (or Safari on iPhone) choose “Add to Home screen / Install app” and it opens like a normal app with its own icon. Pages you have visited stay available without internet, and notices and results refresh automatically when you are back online.",
},
];

/**

· FAQPage JSON-LD (schema.org) built from the items above.
· Used by api/render.js (live crawler HTML) and RouteSEOInjector (app pages).
  */
  export function buildFaqJsonLd() {
  return {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
  "@type": "Question",
  name: item.question,
  acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
  };
  }
