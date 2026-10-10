/**
 * PROGRAMME DATA — Master Plan §6.3.
 * Four streams on one identical microsite template.
 * Subject tables follow the BISE intermediate scheme of studies.
 */

export type ProgrammeSlug = "ics" | "pre-medical" | "pre-engineering" | "arts";

export interface SubjectRow {
  subject: string;
  year: 1 | 2;
  marks: string;
  note?: string;
}

export interface Programme {
  slug: ProgrammeSlug;
  name: string;
  shortName: string;
  promise: string;
  icon: "code" | "flask" | "gear" | "quill";
  overview: string[];
  subjects: SubjectRow[];
  eligibility: { requirement: string; detail: string }[];
  careers: { field: string; paths: string }[];
  assessment: string[];
  facilities: { title: string; body: string }[];
  accentWord: string;
}

export const PROGRAMMES: Programme[] = [
  {
    slug: "ics",
    name: "ICS — Intermediate in Computer Science",
    shortName: "ICS",
    promise: "Read, write and think in code — the stream that builds Pakistan's digital future.",
    icon: "code",
    accentWord: "Computing",
    overview: [
      "The ICS programme pairs a rigorous mathematics and science foundation with two years of dedicated computer science study. Students learn to program in C++ and Python, understand how computers work from the logic gate upward, and finish with the database and problem-solving habits that university computer-science departments expect on day one.",
      "The stream suits the student who enjoyed mathematics in matric, is curious about how software shapes the world, and wants a direct bridge into BS Computer Science, BS Software Engineering, BS Information Technology, and BS Data Science programmes across Pakistan's universities.",
      "Our computer laboratory keeps one machine per student for practical sessions, and the programme's assessment includes regular lab work so that certificates reflect real skill, not only theory.",
    ],
    subjects: [
      { subject: "Computer Science", year: 1, marks: "75 + 25 practical", note: "Core" },
      { subject: "Mathematics", year: 1, marks: "100", note: "Combination I" },
      { subject: "Physics", year: 1, marks: "85 + 15 practical", note: "Combination I" },
      { subject: "Statistics / Economics", year: 1, marks: "100", note: "Combination II alternative" },
      { subject: "English", year: 1, marks: "100", note: "Compulsory" },
      { subject: "Urdu", year: 1, marks: "100", note: "Compulsory" },
      { subject: "Islamiyat", year: 1, marks: "50", note: "Compulsory" },
      { subject: "Computer Science", year: 2, marks: "75 + 25 practical", note: "Core" },
      { subject: "Mathematics", year: 2, marks: "100" },
      { subject: "Physics", year: 2, marks: "85 + 15 practical" },
      { subject: "English", year: 2, marks: "100", note: "Compulsory" },
      { subject: "Pak Studies", year: 2, marks: "50", note: "Compulsory" },
    ],
    eligibility: [
      { requirement: "Matric pass", detail: "Science group or General Science group with Mathematics" },
      { requirement: "Minimum marks", detail: "At least 50% aggregate in matric for a strong foundation (guidance, not a hard bar — see admissions eligibility page)" },
      { requirement: "Required subject", detail: "Mathematics in matric" },
    ],
    careers: [
      { field: "University programmes", paths: "BS Computer Science, BS Software Engineering, BS IT, BS Data Science, BS Cybersecurity" },
      { field: "Professions", paths: "Software engineer, data analyst, systems administrator, mobile developer, IT officer in government service" },
      { field: "Competitive edge", paths: "Programming portfolio built in two years; direct eligibility for NTS/university computing aptitude tests" },
    ],
    assessment: [
      "BISE annual examinations at the end of each year with theory and practical papers in Computer Science.",
      "Internal monthly tests and a send-up examination that mirror the board pattern.",
      "Practical laboratory file maintained across the year and defended in the board practical exam.",
    ],
    facilities: [
      { title: "Computer Laboratory", body: "One machine per student in practical sessions, C++ and Python toolchains installed, supervised by the computer science faculty." },
      { title: "Programming languages taught", body: "C++ (first year, board syllabus), Python (first and second year, industry practice), plus database fundamentals with SQL." },
    ],
  },
  {
    slug: "pre-medical",
    name: "F.Sc Pre-Medical",
    shortName: "Pre-Medical",
    promise: "Biology, chemistry and physics — the two years that open the gate to medicine.",
    icon: "flask",
    accentWord: "Medicine",
    overview: [
      "The Pre-Medical stream is the classic route to the healing professions. Across two years students complete the full intermediate biology, chemistry and physics sequence at the depth the board requires, supported by laboratory practicals in all three sciences.",
      "The programme is demanding by design: medical and dental colleges select through MDCAT, and the intermediate percentage plus MDCAT performance together decide admissions. Our teachers structure monthly tests, MDCAT-style question practice, and guided revision so that students sit the board examination already fluent in the MCQ format.",
      "Students who complete Pre-Medical also qualify for allied health sciences, pharmacy, DVM, and biotechnology programmes, keeping many doors open beyond the single goal of MBBS.",
    ],
    subjects: [
      { subject: "Biology", year: 1, marks: "85 + 15 practical", note: "Core" },
      { subject: "Chemistry", year: 1, marks: "85 + 15 practical", note: "Core" },
      { subject: "Physics", year: 1, marks: "85 + 15 practical", note: "Core" },
      { subject: "English", year: 1, marks: "100", note: "Compulsory" },
      { subject: "Urdu", year: 1, marks: "100", note: "Compulsory" },
      { subject: "Islamiyat", year: 1, marks: "50", note: "Compulsory" },
      { subject: "Biology", year: 2, marks: "85 + 15 practical" },
      { subject: "Chemistry", year: 2, marks: "85 + 15 practical" },
      { subject: "Physics", year: 2, marks: "85 + 15 practical" },
      { subject: "English", year: 2, marks: "100", note: "Compulsory" },
      { subject: "Pak Studies", year: 2, marks: "50", note: "Compulsory" },
    ],
    eligibility: [
      { requirement: "Matric pass", detail: "Science group (biology) strongly preferred" },
      { requirement: "Minimum marks", detail: "At least 60% in matric science subjects is the practical comfort zone for the stream" },
      { requirement: "Required subjects", detail: "Biology, Chemistry, and Mathematics or Additional subject in matric — per board rules" },
    ],
    careers: [
      { field: "University programmes", paths: "MBBS, BDS, DVM, Pharm-D, BS Nursing, DPT, BS Biotechnology, BS Medical Lab Technology" },
      { field: "Professions", paths: "Doctor, dentist, pharmacist, veterinarian, physiotherapist, lab scientist, public-health officer" },
      { field: "Entrance examination", paths: "MDCAT (Pakistan Medical & Dental Council) — preparation guidance runs alongside the second year" },
    ],
    assessment: [
      "BISE annual examinations with theory and practical papers in all three sciences.",
      "Monthly internal tests plus MDCAT-format MCQ practice in the second year.",
      "Supervised practicals in the biology and chemistry laboratories with lab-file assessment.",
    ],
    facilities: [
      { title: "Biology & Chemistry Laboratory", body: "A working science laboratory for the board practical syllabus: microscopy, dissection, titration and preparation practicals under teacher supervision." },
      { title: "MDCAT guidance", body: "Second-year MDCAT orientation sessions, past-paper practice and counselling on medical-college admissions run by the science faculty." },
    ],
  },
  {
    slug: "pre-engineering",
    name: "F.Sc Pre-Engineering",
    shortName: "Pre-Engineering",
    promise: "Physics, chemistry and mathematics at full depth — built for the engineers of tomorrow.",
    icon: "gear",
    accentWord: "Engineering",
    overview: [
      "Pre-Engineering develops the physicist's and mathematician's toolkit: two full years of intermediate mathematics — calculus, vectors, complex numbers — alongside chemistry and physics with practicals. It is the door to every engineering discipline the country's universities offer.",
      "Selection into engineering universities runs through ECAT and the intermediate percentage; our second-year schedule therefore includes ECAT-format mathematics and physics practice, so the entrance examination feels like revision rather than a surprise.",
      "The stream equally prepares students for BS programmes in pure sciences, computer science (with mathematics), architecture, and aviation-related fields, making it one of the most versatile choices after matric.",
    ],
    subjects: [
      { subject: "Mathematics", year: 1, marks: "100", note: "Core" },
      { subject: "Physics", year: 1, marks: "85 + 15 practical", note: "Core" },
      { subject: "Chemistry", year: 1, marks: "85 + 15 practical", note: "Core" },
      { subject: "English", year: 1, marks: "100", note: "Compulsory" },
      { subject: "Urdu", year: 1, marks: "100", note: "Compulsory" },
      { subject: "Islamiyat", year: 1, marks: "50", note: "Compulsory" },
      { subject: "Mathematics", year: 2, marks: "100" },
      { subject: "Physics", year: 2, marks: "85 + 15 practical" },
      { subject: "Chemistry", year: 2, marks: "85 + 15 practical" },
      { subject: "English", year: 2, marks: "100", note: "Compulsory" },
      { subject: "Pak Studies", year: 2, marks: "50", note: "Compulsory" },
    ],
    eligibility: [
      { requirement: "Matric pass", detail: "Science group with Mathematics" },
      { requirement: "Minimum marks", detail: "At least 60% in matric mathematics and science for a comfortable start" },
      { requirement: "Required subject", detail: "Mathematics in matric is compulsory for this stream" },
    ],
    careers: [
      { field: "University programmes", paths: "BE/BS in Civil, Mechanical, Electrical, Mechatronics, Chemical, Computer, and Mining Engineering; BS Physics; BS Mathematics; Architecture" },
      { field: "Professions", paths: "Engineer (all disciplines), architect, data scientist, avionics officer, technical officer in the armed forces" },
      { field: "Entrance examination", paths: "ECAT / university entrance tests — mathematics and physics MCQ practice in second year" },
    ],
    assessment: [
      "BISE annual examinations with theory and practical papers in physics and chemistry.",
      "Internal monthly tests with emphasis on mathematics problem-solving speed.",
      "ECAT orientation and past-paper practice in the second year.",
    ],
    facilities: [
      { title: "Physics Laboratory", body: "Board-practical equipment for mechanics, electricity and optics experiments, with lab-file assessment." },
      { title: "Mathematics club", body: "A weekly problem-solving circle for ECAT and olympiad-style mathematics, mentored by senior faculty." },
    ],
  },
  {
    slug: "arts",
    name: "FA — Faculty of Arts (Humanities)",
    shortName: "Arts (FA)",
    promise: "The versatile stream into law, civil service, education, media and public life.",
    icon: "quill",
    accentWord: "Humanities",
    overview: [
      "The Humanities stream carries the future lawyers, civil servants, teachers, journalists and leaders of the district. Its strength is breadth: alongside compulsory English and Urdu, students combine three elective subjects that shape the degree programmes and competitive examinations they will later attempt.",
      "We state plainly what the research confirmed: calling this stream 'easy' is a mistake. CSS and PMS examinations — the country's toughest — examine precisely the subjects the FA student studies: civics, history, economics and the social fabric of Pakistan. The district needs its best minds in these fields as much as in medicine or engineering.",
      "The elective combinations are chosen with the admission counsellor at enrolment, matching each student's target career: law, civil service, education, media, or business.",
    ],
    subjects: [
      { subject: "English", year: 1, marks: "100", note: "Compulsory" },
      { subject: "Urdu", year: 1, marks: "100", note: "Compulsory" },
      { subject: "Islamiyat", year: 1, marks: "50", note: "Compulsory" },
      { subject: "Civics / Economics", year: 1, marks: "100", note: "Elective (choose 3)" },
      { subject: "History / Education", year: 1, marks: "100", note: "Elective" },
      { subject: "Islamic Studies (Elective) / Pashto", year: 1, marks: "100", note: "Elective" },
      { subject: "English", year: 2, marks: "100", note: "Compulsory" },
      { subject: "Pak Studies", year: 2, marks: "50", note: "Compulsory" },
      { subject: "Elective subjects (continue)", year: 2, marks: "100 each", note: "Same three electives" },
    ],
    eligibility: [
      { requirement: "Matric pass", detail: "Any group — science or humanities" },
      { requirement: "Minimum marks", detail: "Passing matric; no additional bar — the stream welcomes every serious student" },
      { requirement: "Elective counselling", detail: "Three electives chosen with the counsellor at admission to match the target career" },
    ],
    careers: [
      { field: "University programmes", paths: "LLB (law), BS Political Science, BS Economics, BS International Relations, BS Education, BS Journalism & Mass Communication, BBA" },
      { field: "Professions", paths: "Lawyer, civil servant (CSS/PMS), teacher, journalist, broadcaster, diplomat, development-sector professional" },
      { field: "Competitive edge", paths: "FA subjects align directly with CSS/PMS syllabi; an early start on the civil-service track" },
    ],
    assessment: [
      "BISE annual examinations in compulsory and elective subjects.",
      "Internal monthly tests with essay-writing practice for compulsory papers.",
      "Second-year orientation sessions on LLB admission and competitive-examination pathways.",
    ],
    facilities: [
      { title: "Elective combinations", body: "Civics, Economics, History, Education, Islamic Studies (Elective) and regional-language options per the board scheme — chosen with counselling at admission." },
      { title: "Debate & writing culture", body: "Essay competitions and classroom debate woven into monthly assessment, building the written voice that law and the civil service demand." },
    ],
  },
];

export function getProgramme(slug: string): Programme | undefined {
  return PROGRAMMES.find((p) => p.slug === slug);
}

/** Home-page statistics band (odometer figures) — SAMPLE values, update each session */
export const SCHOOL_STATS = [
  { label: "Students enrolled", value: 1240, suffix: "+" },
  { label: "Teaching staff", value: 48, suffix: "" },
  { label: "Board positions (2025)", value: 17, suffix: "" },
  { label: "Scholarship holders", value: 310, suffix: "+" },
] as const;
