/**
 * NOTICES & NEWS — Master Plan §6.1 (home bands) and /notices.
 * SAMPLE content; live records come from Supabase when configured.
 */

export type NoticeCategory = "admission" | "exam" | "result" | "general" | "holiday" | "scholarship";

export interface Notice {
  id: string;
  title: string;
  body: string;
  category: NoticeCategory;
  date: string; // ISO
  pinned: boolean;
  // Poll attachments (Babi Khel pattern — admin authored, RPC-voted)
  is_urgent?: boolean;
  is_poll?: boolean;
  poll_options?: { id: string; text: string; votes: number }[];
  poll_closes_at?: string | null;
}

export const NOTICES: Notice[] = [
  {
    id: "n1",
    title: "Admissions open for the 2026-27 session",
    body: "Applications are invited for first-year admission in ICS, Pre-Medical, Pre-Engineering and Arts. Apply online through this website or collect the form from the school office. Last date: 15 November 2026. Merit list will be published on this website.",
    category: "admission",
    date: "2026-10-01",
    pinned: true,
  },
  {
    id: "n2",
    title: "First send-up examination schedule announced",
    body: "The send-up examination for second-year students begins on 20 October 2026. Date sheets are available from the exam branch and on the notice board. Students must carry their roll number slips.",
    category: "exam",
    date: "2026-09-25",
    pinned: false,
  },
  {
    id: "n3",
    title: "BISE registration for first-year students",
    body: "All first-year students must complete board registration formalities at the exam branch before 30 October 2026. Bring B-form, matric result card and two photographs.",
    category: "exam",
    date: "2026-09-20",
    pinned: false,
  },
  {
    id: "n4",
    title: "Merit-based fee concession applications",
    body: "Students who scored 80% or above in matric may apply for the merit fee concession at the office. Deserving families may apply for the need-based concession with the office form.",
    category: "scholarship",
    date: "2026-09-15",
    pinned: false,
  },
  {
    id: "n5",
    title: "Monthly test calendar for October",
    body: "Monthly tests for all classes run from 6-9 October 2026. Test syllabus has been distributed by subject teachers.",
    category: "general",
    date: "2026-09-28",
    pinned: false,
  },
  {
    id: "n6",
    title: "Result day — second year annual result",
    body: "The second-year annual result will be published on this website on result day. Students and parents can check results by roll number on the Results page.",
    category: "result",
    date: "2026-09-01",
    pinned: false,
  },
];

export interface NewsPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  category: "Achievement" | "Academic" | "Guidance" | "Institution";
  date: string;
  readingMinutes: number;
}

export const NEWS: NewsPost[] = [
  {
    id: "w1",
    slug: "toppers-2026-board-results",
    title: "Our students secure 17 board positions in the annual result",
    excerpt: "The 2026 intermediate annual examinations brought the school its strongest board showing yet, led by a first-year Pre-Medical student from Ghallanai bazaar.",
    body: "The 2026 intermediate annual examinations brought the school its strongest board showing yet. Seventeen of our students earned positions in the board's merit rankings, led by a first-year Pre-Medical student from Ghallanai bazaar who secured the second position overall in the district. The faculty attributes the result to the monthly test system and the supervised practical sessions introduced across the science streams. The toppers were honoured at the morning assembly, and the full honour wall is published on the Results page of this website. The exam branch has verified every name and figure on this list before publication.",
    category: "Achievement",
    date: "2026-09-12",
    readingMinutes: 3,
  },
  {
    id: "w2",
    slug: "choosing-your-stream-after-matric",
    title: "After matric: choosing the right stream for the right career",
    excerpt: "A subject-teacher-written guide to matching your matric strengths to ICS, Pre-Medical, Pre-Engineering or Arts — with the careers each stream feeds.",
    body: "Every October, families across Mohmand face the same question: which intermediate stream should our child join? The honest answer is that the stream should follow the career, not the neighbour's advice. Pre-Medical exists for the healing professions and requires matric biology; Pre-Engineering builds toward the ECAT and every engineering discipline and requires strong mathematics; ICS is the direct bridge into computer-science degrees and the software profession; and the Humanities stream — often wrongly called the easy option — is the road to law, the civil service and the media, and its subjects align directly with the CSS examination. Our counselling desk at the admission office walks every family through this decision with the student's matric result in hand. The full guidance guide, written with the subject teachers of each stream, is available at the admissions desk and on each programme page of this website.",
    category: "Guidance",
    date: "2026-09-05",
    readingMinutes: 5,
  },
  {
    id: "w3",
    slug: "computer-lab-upgrade",
    title: "Computer laboratory receives refreshed machines for ICS practicals",
    excerpt: "The ICS practical sessions now run one machine per student, with C++ and Python toolchains installed and maintained through the academic year.",
    body: "The computer laboratory used by ICS students has been refreshed for the new session, ensuring one working machine per student in practical periods. The laboratory runs the C++ toolchain required by the board syllabus alongside Python installations used for the programming circle, and the department maintains the machines through a student-led hardware team — itself a learning exercise. The upgrade keeps the ICS practical stream on schedule and supports the programming practice that distinguishes our computer-science graduates at university.",
    category: "Institution",
    date: "2026-08-20",
    readingMinutes: 2,
  },
  {
    id: "w4",
    slug: "monthly-test-system-results",
    title: "Monthly test system showing measurable gains across all streams",
    excerpt: "Two sessions into the reformed monthly-test calendar, average internal scores are up and board send-up results have strengthened across all four programmes.",
    body: "Two sessions into the reformed monthly-test calendar, the school is seeing measurable gains. Average internal scores across all four programmes have risen against the same terms last year, and the send-up results in science subjects have strengthened in parallel. The system is deliberately simple: every month ends with syllabus-matched tests, every test returns with teacher remarks, and every term triggers a counselling conversation for any student trending downward. Parents can follow the pattern through the student portal once it opens for the session, and the office publishes term summaries on request.",
    category: "Academic",
    date: "2026-08-02",
    readingMinutes: 3,
  },
];

export const TESTIMONIALS = [
  {
    quote: "The teachers here knew my result before I told them, and they knew what to fix. That is the whole difference.",
    name: "SAMPLE Student Name",
    context: "Second-year Pre-Medical · District board position holder",
  },
  {
    quote: "I wrote my first program in the school's computer lab. Now I am in a software engineering degree in Peshawar.",
    name: "SAMPLE Alumnus Name",
    context: "ICS graduate · Class of 2023",
  },
  {
    quote: "We checked the merit list from home on a phone. No queue, no paper, no waiting for the office to open.",
    name: "SAMPLE Parent Name (Ghallanai)",
    context: "Parent · Ghallanai",
  },
  {
    quote: "The monthly test system kept my son working evenly through the year instead of panicking in the last month.",
    name: "SAMPLE Parent Name (Ekka Ghund)",
    context: "Parent · Ekka Ghund",
  },
] as const;

/** Admissions journey dates — SAMPLE; update each session (Master Plan §6.4) */
export const ADMISSION_DATES = [
  { stage: "Applications open", date: "2026-10-01", note: "Online and at the school office" },
  { stage: "Application deadline", date: "2026-11-15", note: "Forms received after this date go to the waiting queue" },
  { stage: "Admission test (where applicable)", date: "2026-11-22", note: "For over-subscribed programmes" },
  { stage: "Interviews", date: "2026-11-25", note: "Candidate with guardian at the school" },
  { stage: "Merit list published", date: "2026-11-30", note: "On this website and the notice board" },
  { stage: "Enrolment week", date: "2026-12-01", note: "Fee deposit, documents, section allotment" },
] as const;

export const ADMISSION_STEPS = [
  { step: 1, title: "Check Eligibility", body: "See the requirements per programme — matric subjects and minimum marks — before you prepare documents.", href: "/admissions/eligibility" },
  { step: 2, title: "Prepare Documents", body: "Photograph, B-form, matric result card, domicile — the full checklist is on the admissions page.", href: "/admissions#documents" },
  { step: 3, title: "Apply Online", body: "Complete the five-step application on this website. Your progress is saved as you go.", href: "/admissions/apply" },
  { step: 4, title: "Track Status", body: "Your application number lets you follow the process: received, reviewed, shortlisted, merit list.", href: "/admissions#tracking" },
] as const;

/** Fee structure — SAMPLE values, verify with the office (Master Plan §6.4, PGC pattern) */
export const FEES = [
  { head: "Admission fee (one time, at enrolment)", amount: "Rs 500" },
  { head: "Tuition (per month)", amount: "Rs 0 — government school" },
  { head: "Board registration (first year, as notified by BISE)", amount: "As per board notification" },
  { head: "Board examination fee (per year, as notified)", amount: "As per board notification" },
  { head: "Laboratory fund (science streams, per session)", amount: "Rs 500" },
  { head: "Sports and co-curricular fund (per session)", amount: "Rs 200" },
] as const;

export const SCHOLARSHIPS = [
  { title: "Merit concession", body: "Free education concessions for students scoring 80%+ in matric, as per the government scheme." },
  { title: "Need-based concession", body: "For deserving families — apply with the office form after enrolment; the principal's office reviews each case personally." },
  { title: "Government scholarship schemes", body: "The office facilitates registration for applicable government and BISE scholarship and laptop schemes each session." },
] as const;

/** Twenty FAQs — Master Plan §6.4 */
export const FAQS = [
  { q: "When do admissions open and close?", a: "For the 2026-27 session, applications open on 1 October 2026 and close on 15 November 2026. Dates for each stage — test, interview, merit list and enrolment — are published on the admissions page." },
  { q: "Which programmes does the school offer?", a: "Four intermediate streams: ICS (Computer Science), F.Sc Pre-Medical, F.Sc Pre-Engineering, and FA Humanities (Arts). Each has its own page under Academics with subjects, eligibility and careers." },
  { q: "How do I apply — online or on paper?", a: "Both. The online application on this website is the fastest route and issues an application number you can track. Paper forms are available at the school office during office hours for families who prefer them." },
  { q: "What documents are required with the application?", a: "Two passport photographs, photocopy of the B-form (or CNIC), matric result card or detail mark certificate, domicile, and any concession or scholarship proof you want considered." },
  { q: "Can I submit documents after the deadline if I apply on time?", a: "The core documents must accompany the application. In genuine cases the office accepts a delayed matric result card — contact the office through WhatsApp before the deadline." },
  { q: "What are the minimum marks for each stream?", a: "Pre-Medical and Pre-Engineering need matric science (with biology / mathematics respectively) and around 60% marks to be comfortable; ICS needs matric mathematics and roughly 50%; Arts needs a matric pass in any group. See the eligibility page for the full table." },
  { q: "Is there an admission test?", a: "Only when a programme is over-subscribed. The test covers matric-level mathematics or relevant science, and the date is published in the admission dates table." },
  { q: "How is the merit list prepared?", a: "From the matric percentage (plus test score where a test was held), ranked against the seat quota of each programme. The list is published on this website and on the school notice board, dated and versioned." },
  { q: "What does it cost to study here?", a: "As a government institution there is no monthly tuition fee. The admission fee is Rs 500, with laboratory and sports funds as detailed on the fee structure page. Board registration and examination fees are charged exactly as the board notifies them." },
  { q: "Are scholarships or concessions available?", a: "Yes — a merit concession for 80%+ matric scorers, need-based concessions for deserving families, and facilitation for government scholarship schemes. Details are on the fee structure page." },
  { q: "Can a student change stream after admission?", a: "Stream change is possible within the first month of the session with the principal's approval, subject to eligibility for the new stream and seat availability." },
  { q: "When do classes start?", a: "First-year classes begin in the enrolment week at the start of December; the exact date is published in the admission dates table and notified through WhatsApp." },
  { q: "How can I check my result?", a: "Open the Results page of this website, enter your roll number, choose the year and programme, and the subject-wise result card appears — printable and shareable. Result day also brings a notice on this website." },
  { q: "Where do I complain or give feedback?", a: "The contact page has a feedback form that reaches the principal's office directly, or message the school's WhatsApp number. Every submission is acknowledged and tracked." },
  { q: "Does the school have laboratories?", a: "Yes — physics, chemistry and biology laboratories for the science practicals, and a computer laboratory for ICS practicals with one machine per student in practical periods." },
  { q: "Is there a library?", a: "Yes, a reference and lending library holding course texts, past papers and Urdu and English titles. Library periods are on the weekly timetable." },
  { q: "What are the school timings?", a: "The school day runs 8:00 AM to 2:00 PM, Monday to Saturday, with the assembly at 8:00 sharp. Office hours for visitors are the same." },
  { q: "Can I install this website as an app?", a: "Yes. Open the site in Chrome on Android and tap the install prompt (or browser menu → Install app). The app works offline for pages you have already visited and notifies you when new notices are published." },
  { q: "How do parents receive announcements?", a: "Through the school's WhatsApp broadcast list, notices on this website, and the notice board. Opt in to WhatsApp alerts by sending your name and student's class to the school number." },
] as const;
