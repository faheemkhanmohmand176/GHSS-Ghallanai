/**
 * ABOUT CONTENT — Master Plan §6.2.
 * Timeline, principal's message, vision/mission, faculty directory.
 * SAMPLE content: replace with verified records via Supabase or this file.
 */

export const TIMELINE = [
  {
    year: "Foundation",
    title: "A school for Ghallanai",
    body: "The Government High School opens its doors in the administrative headquarters of Mohmand, serving the surrounding valleys with secondary education. (SAMPLE entry — confirm the foundation year with office records.)",
    milestone: true,
  },
  {
    year: "Upgradation",
    title: "Raised to Higher Secondary",
    body: "The school is upgraded to Higher Secondary level, adding first-year and second-year classes under the BISE intermediate system with ICS, Pre-Medical, Pre-Engineering and Arts streams. (SAMPLE entry.)",
    milestone: true,
  },
  {
    year: "Expansion",
    title: "Science laboratories and computer lab",
    body: "Dedicated physics, chemistry and biology laboratories and a computer laboratory are established, bringing practical science and computing to the district's students. (SAMPLE entry.)",
    milestone: false,
  },
  {
    year: "Merged districts era",
    title: "A new chapter",
    body: "With Mohmand's merger into Khyber Pakhtunkhwa, the school enters a period of renewed investment in facilities, faculty and now — a digital campus serving families across the district. (SAMPLE entry.)",
    milestone: true,
  },
  {
    year: "2026",
    title: "The Digital Campus programme",
    body: "GHSS Ghallanai launches its website, PWA and online admissions — placing the school among the most digitally capable government institutions in the merged districts.",
    milestone: true,
  },
] as const;

export const PRINCIPAL_MESSAGE = {
  name: "Principal",
  title: "Principal, GHSS Ghallanai",
  tenure: "SAMPLE — fill from office records",
  message: [
    "Assalam-o-Alaikum. On behalf of the students, teachers and staff of Government Higher Secondary School Ghallanai, I welcome you to our school and to this website.",
    "For the young people of Mohmand District, these two years of intermediate education decide the direction of an entire life. Our duty is plain: classrooms that teach with discipline and care, laboratories where science is practised rather than memorised, a computer laboratory where the district's next engineers write their first program, and a faculty that knows every serious student by name.",
    "This website carries that same duty online. Families can now check admissions, fees and results from a phone in their hand, in English and in Urdu, without standing in a queue or waiting for office hours. That is how a public institution should serve its people in this century.",
    "I invite you to visit us in Ghallanai, to meet our teachers, and to see the standard of work our students produce. Your trust is the foundation on which this school is built.",
  ],
  messageUrdu:
    "السلام علیکم۔ محکمہ تعلیم کے تحت قائم حکومتی ہائر سیکنڈری سکول غلانئی میں آپ کو خوش آمدید۔ محسن ضلع کے نوجوانوں کے لیے انٹرمیڈیٹ کے یہ دو سال پوری زندگی کا رخ طے کر دیتے ہیں۔ ہمارا فرض واضح ہے: نظم و ضبط اور شفقت سے پڑھانے والے کمرے جماعت، سائنس کی عملی لیبارٹریاں، اور ایسے اساتذہ جو ہر سنجیدہ طالب علم کو نام سے جانتے ہوں۔ یہ ویب سائٹ وہی فرض آن لائن ادا کرتی ہے — گھر بیٹھے موبائل فون سے داخلے، فیس اور نتائج کی معلومات، اردو اور انگریزی میں۔ کسی قطار میں لگنے یا آفس کے اوقات کا انتظار نہیں۔",
} as const;

export const VISION_MISSION = {
  vision:
    "To be the institution Mohmand District trusts completely for the two years that decide its children's futures — measured not by our words but by our students' results, character, and the paths they walk after they leave us.",
  mission:
    "To deliver disciplined, practical, and caring intermediate education across our four streams; to keep every process of the school — admissions, results, and communication — transparent to every family; and to send every graduate out prepared for university, for earning, and for serving this community.",
  values: [
    { title: "Discipline", body: "Structured days, monitored attendance, and teachers who hold the line kindly." },
    { title: "Transparency", body: "Published merit lists, verifiable results, fees stated plainly, no back doors." },
    { title: "Care", body: "Small interventions early: counselling, scholarships, and a faculty that notices." },
    { title: "Service", body: "Education that ends not in a certificate but in usefulness to this district." },
  ],
} as const;

export interface FacultyMember {
  id: string;
  name: string;
  designation: string;
  qualification: string;
  subjects: string[];
  department: string;
  years: number;
}

/** SAMPLE faculty — replace via Supabase faculty table or this file */
export const FACULTY: FacultyMember[] = [
  { id: "f01", name: "Muhammad Yousaf Khan", designation: "Senior Teacher (Physics)", qualification: "M.Sc Physics, B.Ed", subjects: ["Physics"], department: "Science", years: 18 },
  { id: "f02", name: "Rehmat Ali", designation: "Senior Teacher (Mathematics)", qualification: "M.Sc Mathematics, B.Ed", subjects: ["Mathematics"], department: "Science", years: 15 },
  { id: "f03", name: "Dr. Nasir Mahmood", designation: "Teacher (Chemistry)", qualification: "M.Phil Chemistry", subjects: ["Chemistry"], department: "Science", years: 9 },
  { id: "f04", name: "Sardar Ahmad", designation: "Teacher (Biology)", qualification: "M.Sc Zoology, B.Ed", subjects: ["Biology"], department: "Science", years: 12 },
  { id: "f05", name: "Taj Muhammad", designation: "Senior Teacher (Computer Science)", qualification: "M.Sc Computer Science", subjects: ["Computer Science"], department: "Computing", years: 8 },
  { id: "f06", name: "Ihsanullah Khan", designation: "Teacher (English)", qualification: "M.A English, B.Ed", subjects: ["English"], department: "Humanities", years: 11 },
  { id: "f07", name: "Abdul Wahab", designation: "Teacher (Urdu)", qualification: "M.A Urdu, B.Ed", subjects: ["Urdu"], department: "Humanities", years: 14 },
  { id: "f08", name: "Fazal Rahman", designation: "Teacher (Islamiyat / Pak Studies)", qualification: "M.A Islamic Studies, B.Ed", subjects: ["Islamiyat", "Pak Studies"], department: "Humanities", years: 10 },
  { id: "f09", name: "Hazrat Bilal", designation: "Teacher (Civics / History)", qualification: "M.A Political Science", subjects: ["Civics", "History"], department: "Humanities", years: 7 },
  { id: "f10", name: "Zar Bibi", designation: "Teacher (Economics)", qualification: "M.A Economics, B.Ed", subjects: ["Economics"], department: "Humanities", years: 6 },
  { id: "f11", name: "Gul Zaman", designation: "Teacher (Statistics)", qualification: "M.Sc Statistics", subjects: ["Statistics", "Mathematics"], department: "Science", years: 5 },
  { id: "f12", name: "Saifur Rehman", designation: "Teacher (Pashto / Education)", qualification: "M.A Pashto", subjects: ["Pashto", "Education"], department: "Humanities", years: 13 },
];

export const FACILITIES = [
  { title: "Classrooms", body: "Spacious, well-ventilated classrooms for all four streams across first and second year.", icon: "school" },
  { title: "Science Laboratories", body: "Dedicated physics, chemistry and biology laboratories supporting the full board practical syllabus.", icon: "flask" },
  { title: "Computer Laboratory", body: "A working computer laboratory for ICS practicals — programming, databases and office productivity.", icon: "monitor" },
  { title: "Library", body: "A reference and lending library with course texts, past papers and Urdu and English titles.", icon: "book" },
  { title: "Grounds", body: "An assembly ground and space for sports — cricket, volleyball and athletics on the annual calendar.", icon: "trees" },
  { title: "Exam Branch", body: "The school's records office handling board registration, admissions and result documentation.", icon: "file" },
] as const;
