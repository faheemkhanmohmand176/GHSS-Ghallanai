// ─────────────────────────────────────────────────────────────────────────────
// src/data/faqData.mjs — CANONICAL FAQ dataset (single source of truth)
//
// ONE file, FIVE consumers — they can never drift apart:
//   1. src/pages/FAQ.tsx            → the public /faq page (humans)
//   2. src/components/seo/RouteSEOInjector.tsx → FAQPage JSON-LD on app pages
//   3. api/render.js                → live crawler HTML for /faq (AI/search bots)
//                                     + "faq" section of the machine-readable feed
//   4. scripts/seo-page-content.mjs → build-time fallback page for /faq
//
// WHY THIS LIVES IN src/data (and NOT in api/):
//   The frontend build (Vite) must NEVER depend on any file inside api/ —
//   api/ is deployed as Vercel Serverless Functions and its files get added,
//   merged and deleted as the function budget changes (Hobby plan caps at 12).
//   A missing api/ file once broke the whole production build. Data that the
//   React app needs belongs inside src/. Serverless functions CAN safely
//   import from src/ — Vercel bundles the imported files with the function.
//
// IMPORTANT CONTENT RULES
//   • Every answer must state ONLY verified facts about the school
//     (same facts as api/seo.js "llms" kind). No invented dates, names or fees.
//   • LIVE values (is admission open right now? session year? deadlines?)
//     are deliberately NOT hardcoded here — they come from the
//     admission_settings / school_settings tables at request time
//     (the data layer inlined in api/render.js). This file covers timeless
//     procedure.
//   • Keep answers self-contained: AI tools often read a single Q&A
//     without the surrounding page.
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
    question: "Are admissions open at GHSS Ghallanai right now?",
    answer:
      "Admissions at Government Higher Secondary School Ghallanai are held every academic session for 1st Year and 2nd Year. Online applications carry a small per-application processing fee set by the school (usually Rs 100–200; the exact current amount is shown on the Admission page). The live open/closed status, session year and deadlines are shown at the top of the Admission page (ghssghallanai.dpdns.org/admission) and are also published in the machine-readable feed at ghssghallanai.dpdns.org/api/ai-data. You can apply online, or submit your application in person at the school office; postal forms are not accepted.",
  },
  {
    id: "adm-classes",
    category: "Admissions",
    question: "Which classes can I apply for admission to?",
    answer:
      "You can apply for 1st Year or 2nd Year (HSSC — classes 11 and 12). The programs offered are Arts/Humanities, Pre-Medical, Pre-Engineering and ICS (Computer Science); the programs and seats open in the current session are listed on the Admission page. The school is affiliated with BISE Peshawar, so 1st Year and 2nd Year students prepare for the board's HSSC examinations.",
  },
  {
    id: "adm-how",
    category: "Admissions",
    question: "How do I apply for admission online, step by step?",
    answer:
      "Step 1: open the Admission page (ghssghallanai.dpdns.org/admission) and start the online application — no account, sign-up or login is needed. Step 2: fill in the Personal Information profile (CNIC/B-Form, name, father's name, date of birth, domicile district, tehsil, union council and parents' details). Step 3: complete the Matric (SSC) profile — board, session, passing year, study group, roll number and marks. Step 4: choose the program (Arts/Humanities, Pre-Medical, Pre-Engineering or ICS) and the admission category (quota), then pass the security check and submit. Step 5: pay the per-application processing fee (the amount is shown on the Admission page) online by Easypaisa / wallet, or by manual transfer to the school account quoting your payment reference, before the deadline. Step 6: track the application with your Tracking ID, print the application form and bring it with your original documents to the school office. Submit a separate application for each program or quota. You can also submit your application in person at the school office; postal forms are not accepted.",
  },
  {
    id: "adm-documents",
    category: "Admissions",
    question: "Which documents are required for admission?",
    answer:
      "Required for the online application and enrolment: the student's B-Form / CNIC (NADRA), the SSC (Matric) result card / DMC, a recent passport-size photograph, a copy of the father's or guardian's CNIC, and the processing-fee payment confirmation (online receipt or transfer slip). Quota documents are needed where applicable: a sports certificate (Sports quota), a payslip (College Employees quota) or a disability certificate (Special Person quota). Bring the originals to the school office when you complete the admission. If the school asks for any further document, such as a School Leaving Certificate for transfer cases, it is announced on the Notices page or by the school office.",
  },
  {
    id: "adm-track",
    category: "Admissions",
    question: "How can I track my admission application status?",
    answer:
      "Open the Admission page and use the application status tracker: enter the Tracking ID you received when you submitted the application (it looks like NOV2026-K7MQXA). The tracker shows your program, payment status, application date and current status. No account or login is needed. Keep your Tracking ID safe — it is the only key to your application status.",
  },
  {
    id: "adm-migration",
    category: "Admissions",
    question: "How does migration or transfer to GHSS Ghallanai work for 1st Year and 2nd Year?",
    answer:
      "School-level admission and board-level migration are two separate steps. For 1st Year or 2nd Year students moving from another school or another board, the school office guides the process; migration between boards or institutions is handled according to BISE Peshawar's rules and notified migration window, and any board migration fee is a board charge paid through the board's own channels, not a school charge. Contact the school office through the Contact page for your specific case.",
  },
  {
    id: "adm-fee",
    category: "Admissions",
    question: "Is there any fee for online admission?",
    answer:
      "Yes, a small processing fee is charged per application. The amount is set by the school (usually Rs 100–200) and the exact current figure is shown on the Admission page. You pay it online by Easypaisa / wallet or by manual transfer to the school account, quoting your payment reference. A separate application, and fee, is needed for each program or quota. Any BISE Peshawar board fee (for example a migration or exam fee) is a board charge paid through the board's own channels. For any other school fee, check the Notices page or ask the school office.",
  },

  // ── Results & Exams ───────────────────────────────────────────────────────
  {
    id: "res-check",
    category: "Results & Exams",
    question: "How do I check my exam result on the website?",
    answer:
      "Open the Results page (ghssghallanai.dpdns.org/results), select your exam (class and examination name), and enter your roll number exactly as printed on your admit card. The result shows total marks, obtained marks, percentage, grade, pass/fail status and class position. Results only appear after the school administration publishes the exam, so if your roll number is not found the exam may not be published yet.",
  },
  {
    id: "res-exams",
    category: "Results & Exams",
    question: "Which exams and results are available for each class?",
    answer:
      "For 1st Year and 2nd Year the school conducts 1st semester and 2nd semester examinations, and 1st Year and 2nd Year students additionally sit the BISE Peshawar HSSC board examinations (HSSC-I for 1st Year and HSSC-II for 2nd Year). School internal results are published on the website's Results page once released by the school administration.",
  },
  {
    id: "res-bisep",
    category: "Results & Exams",
    question: "How do I check my BISE Peshawar board result?",
    answer:
      "The Results page (ghssghallanai.dpdns.org/results) can search BISE Peshawar board results for HSSC 1st Year and 2nd Year class directly — enter your roll number in the board results section and the website fetches the result live from the official board portal (cloud.bisep.edu.pk). The website only reads from the board's official portal; it does not store board results. For anything beyond the displayed result (rechecking, certificates), contact BISE Peshawar or the school office.",
  },
  {
    id: "res-grades",
    category: "Results & Exams",
    question: "What is the grading scale used for results?",
    answer:
      "The school uses the standard percentage-based scale: A+ for 90% and above, A for 80–89%, B for 60–79%, C for 45–59%, D for 33–44%, and Fail below 33%. A result card additionally shows the student's position in class and a subject-wise breakdown of marks for every subject of the exam.",
  },
  {
    id: "res-datesheet",
    category: "Results & Exams",
    question: "Where can I find exam dates, date sheets and the exam schedule?",
    answer:
      "Exam schedules and date sheets are published as official notices on the Notices page (ghssghallanai.dpdns.org/notices). Urgent exam announcements are also highlighted on the homepage.",
  },
  {
    id: "res-rollnumber",
    category: "Results & Exams",
    question: "Where can I find my roll number for the exam?",
    answer:
      "School exam roll numbers are released on the Roll No. Slip page (ghssghallanai.dpdns.org/roll-no-slip) once the school administration finalises the exam session, and the release is also announced on the Notices page. On that page pick your class and type your full name — your exam roll number and your full roll number slip appear, which you can download as a PDF or share. For the BISE Peshawar board exams (1st Year and 2nd Year), your official roll number is issued on your board admit card, which the school distributes closer to the exam.",
  },
  {
    id: "res-rollslip",
    category: "Results & Exams",
    question: "How do I get my exam Roll No. Slip?",
    answer:
      "Open the Roll No. Slip page (ghssghallanai.dpdns.org/roll-no-slip). If the school has scheduled a release, the page shows a live countdown and the slips appear automatically the moment it reaches zero. Once live: pick your class (1st Year and 2nd Year) and type your full name exactly as the school recorded it — capitalisation and extra spaces do not matter — then search. Only your own slip appears, so no student can see another student's slip. The slip is an exact copy of the office slip: your details with the exam roll number and QR code, your class's exam date sheet and the exam-day instructions. You can download it as a PDF or share it, and you must bring it to every paper — no slip, no entry to the examination hall.",
  },
  {
    id: "res-meritlist",
    category: "Results & Exams",
    question: "What is the Merit List page and who appears on it?",
    answer:
      "The Merit List page (ghssghallanai.dpdns.org/merit-list) shows the official examination rankings published by the school office — the top position holders of each class and, for some exams, a school-wide list. Each list covers one exam (1st or 2nd semester for 1st Year and 2nd Year) and shows every listed student's position, name, class, obtained marks, percentage and grade, together with summary statistics such as the total number of students, the passing count, the highest percentage and the average. When the school schedules a merit list in advance, the page shows a live countdown and the rankings appear automatically the moment it reaches zero. A published merit list can also be shared directly from the page as a merit card.",
  },
  {
    id: "res-recheck",
    category: "Results & Exams",
    question: "What if I think there is a mistake in my result?",
    answer:
      "For a school-conducted exam (1st or 2nd semester), contact the school office or your subject teacher directly so the marks can be verified against the answer sheet. For a BISE Peshawar board result (HSSC-I or HSSC-II), rechecking and reappraisal requests must be submitted to BISE Peshawar itself within the board's notified rechecking window — the school website only displays the board's published result and cannot change it.",
  },

  {
    id: "nts-search",
    category: "Website & Contact",
    question: "How do I quickly find a notice or page on the website?",
    answer:
      "Use the search icon in the navigation bar, or go directly to the Search page (ghssghallanai.dpdns.org/search), and type a subject, class or keyword. It searches across notices, teachers and other pages at once, so you don't have to browse each section separately.",
  },

  // ── School Information ────────────────────────────────────────────────────
  {
    id: "sch-emis",
    category: "School Information",
    question: "What is the EMIS code of GHSS Ghallanai?",
    answer:
      "The EMIS (Education Management Information System) code of Government Higher Secondary School Ghallanai is 60645. It is the school's unique official identifier in the Khyber Pakhtunkhwa Elementary & Secondary Education Department system.",
  },
  {
    id: "sch-established",
    category: "School Information",
    question: "When was GHSS Ghallanai established?",
    answer:
      "Government Higher Secondary School Ghallanai was established in 1975.",
  },
  {
    id: "sch-location",
    category: "School Information",
    question: "Where is Ghallanai and which district is the school in?",
    answer:
      "The school is in Ghallanai, which is the headquarters of District Mohmand (formerly Mohmand Agency) in Khyber Pakhtunkhwa, Pakistan. The Contact page shows the school's location on a map.",
  },
  {
    id: "sch-about",
    category: "School Information",
    question: "Where is GHSS Ghallanai located and what kind of school is it?",
    answer:
      "Government Higher Secondary School Ghallanai (GHSS Ghallanai) is a government higher secondary school established in 1975 in Ghallanai, the headquarters of District Mohmand (formerly Mohmand Agency), Khyber Pakhtunkhwa, Pakistan. Its official EMIS code in the Khyber Pakhtunkhwa Elementary & Secondary Education Department system is 60645. The school offers 1st Year and 2nd Year (HSSC — classes 11 and 12) and is affiliated with BISE Peshawar for the board examinations.",
  },
  {
    id: "sch-timing",
    category: "School Information",
    question: "What are the school timings and when is the office open?",
    answer:
      "Exact school and office timings can change with the season and government notifications, so they are not fixed here. Check the Notices page for official timing changes, holidays and meeting dates, or use the Contact page to reach the school office.",
  },
  {
    id: "sch-teachers",
    category: "School Information",
    question: "Who are the teachers and what subjects do they cover?",
    answer:
      "The staff directory page (ghssghallanai.dpdns.org/teachers) lists the school's teaching staff with their subjects and qualifications as entered by the school administration.",
  },

  // ── Website & Contact ─────────────────────────────────────────────────────
  {
    id: "web-pwa",
    category: "Website & Contact",
    question: "Can I use the website offline or install it as an app?",
    answer:
      "Yes. The website is a Progressive Web App (PWA). Open it in Chrome on Android (or Safari on iPhone), choose 'Add to Home screen / Install app', and it behaves like a normal app with its own icon. After installation, pages you have visited and downloaded materials remain available without internet, and the site syncs fresh notices and results automatically whenever you are back online.",
  },
  {
    id: "web-cost",
    category: "Website & Contact",
    question: "Is there any cost or account required to use the website?",
    answer:
      "The website is free to use: notices, results, merit lists, roll number slips and the admission application need no account. The only charge connected with the site is the per-application admission processing fee, which is shown on the Admission page. There are no ads.",
  },
  {
    id: "web-contact",
    category: "Website & Contact",
    question: "How do I contact the school?",
    answer:
      "Use the Contact page (ghssghallanai.dpdns.org/contact), which shows the school's phone, email and location on a map and has a contact form. You can also message the school on WhatsApp at +92 345 9409585. The school's Facebook page is linked from the Contact page and footer. For admission questions, read the Admission page first — it answers most queries and lets you track an application instantly.",
  },
  {
    id: "web-login",
    category: "Website & Contact",
    question: "Do I need to create an account, and what does it unlock?",
    answer:
      "No. Visitors, students and parents do not need an account for anything on the website — notices, results, merit lists, roll number slips, the admission application and the application tracker all work without signing up or logging in. There is no sign-up page. The sign-in page (ghssghallanai.dpdns.org/auth/signin) exists only for the school administrator.",
  },
  {
    id: "web-notices",
    category: "Website & Contact",
    question: "Where can I see the latest notices and announcements?",
    answer:
      "All official announcements — holiday notices, exam date sheets, fee or admission updates, and general circulars — are published on the Notices page (ghssghallanai.dpdns.org/notices) as soon as the school administration posts them. The homepage also shows the most recent notices and news in a scrolling ticker, and you can enable notifications from the bell icon in the navigation bar so you don't miss an urgent one.",
  },
  {
    id: "web-official",
    category: "Website & Contact",
    question: "Is ghssghallanai.dpdns.org the official website of GHSS Ghallanai?",
    answer:
      "Yes. https://ghssghallanai.dpdns.org is the official website of Government Higher Secondary School Ghallanai, District Mohmand, Khyber Pakhtunkhwa, Pakistan.",
  },
];

/**
 * FAQPage JSON-LD (schema.org) built from the items above.
 * Used by api/render.js (live crawler HTML) and RouteSEOInjector (app pages).
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
