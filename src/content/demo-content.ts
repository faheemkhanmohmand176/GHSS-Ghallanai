/**
 * DEMO CONTENT — static fallbacks for every new homepage/admin section.
 * When Supabase is configured, live rows replace these (src/lib/data.ts);
 * otherwise the site still runs perfectly from a fresh unzip.
 */

export interface TeacherRow {
  id: string;
  full_name: string;
  subject: string;
  qualification: string | null;
  experience: string | null;
  phone: string | null;
  email: string | null;
  bio: string | null;
  photo_url: string | null;
  display_order: number;
  is_active: boolean;
}

export const DEMO_TEACHERS: TeacherRow[] = [
  { id: "t1", full_name: "Mr. Abdullah Khan", subject: "Physics", qualification: "M.Sc Physics, University of Peshawar", experience: "14 years", phone: null, email: null, bio: "Leads the Pre-Engineering physics programme and the science fair committee.", photo_url: null, display_order: 1, is_active: true },
  { id: "t2", full_name: "Mrs. Saira Bibi", subject: "Biology", qualification: "M.Sc Zoology", experience: "11 years", phone: null, email: null, bio: "Pre-Medical stream lead; manages the biology lab and dissection practicals.", photo_url: null, display_order: 2, is_active: true },
  { id: "t3", full_name: "Mr. Ihsanullah", subject: "Computer Science", qualification: "MS Computer Science", experience: "7 years", phone: null, email: null, bio: "Teaches ICS programming, databases and runs the computer lab.", photo_url: null, display_order: 3, is_active: true },
  { id: "t4", full_name: "Mr. Farooq Shah", subject: "Mathematics", qualification: "M.Sc Mathematics", experience: "16 years", phone: null, email: null, bio: "Calculus and statistics across both years; head of the testing cell.", photo_url: null, display_order: 4, is_active: true },
  { id: "t5", full_name: "Mrs. Naseem Begum", subject: "English", qualification: "M.A English Literature", experience: "12 years", phone: null, email: null, bio: "Language and literature; coordinates the debating society.", photo_url: null, display_order: 5, is_active: true },
  { id: "t6", full_name: "Mr. Zahir Shah", subject: "Civics & Economics", qualification: "M.A Political Science", experience: "9 years", phone: null, email: null, bio: "Arts stream lead for the humanities group.", photo_url: null, display_order: 6, is_active: true },
];

export interface AchievementRow {
  id: string;
  title: string;
  description: string | null;
  student_name: string | null;
  class_label: string | null;
  year: number | null;
  category: string;
  image_url: string | null;
}

export const DEMO_ACHIEVEMENTS: AchievementRow[] = [
  { id: "a1", title: "Board position — Pre-Medical", description: "A student of the 2026 session secured first position in the BISE annual examination for the whole district.", student_name: "SAMPLE Student A", class_label: "2nd Year — Pre-Medical", year: 2026, category: "Academic", image_url: null },
  { id: "a2", title: "Inter-district cricket champions", description: "The school eleven lifted the Mohmand District trophy after an unbeaten season.", student_name: null, class_label: null, year: 2026, category: "Sports", image_url: null },
  { id: "a3", title: "Science fair gold medal", description: "A renewable-energy physics project from the ICS stream took the district science fair gold medal.", student_name: "SAMPLE Student C", class_label: "1st Year — ICS", year: 2026, category: "Science", image_url: null },
];

export interface EventRow {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string | null;
  is_published: boolean;
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

export const DEMO_EVENTS: EventRow[] = [
  { id: "e1", title: "First-term send-up exams begin", description: "Send-up examination schedule for all 1st-year classes.", event_type: "exam", start_date: daysFromNow(14), end_date: daysFromNow(21), is_published: true },
  { id: "e2", title: "Parent-teacher meeting", description: "Mid-term progress discussion with guardians of both years.", event_type: "ptm", start_date: daysFromNow(25), end_date: null, is_published: true },
  { id: "e3", title: "Annual sports gala", description: "Two-day inter-programme sports festival on the main ground.", event_type: "sports", start_date: daysFromNow(40), end_date: daysFromNow(41), is_published: true },
  { id: "e4", title: "Board practicals window", description: "BISE practical examinations for science programmes.", event_type: "exam", start_date: daysFromNow(60), end_date: daysFromNow(75), is_published: true },
];

export interface GalleryAlbum {
  id: string;
  title: string;
  description: string | null;
  cover_url: string | null;
}

export interface GalleryPhoto {
  id: string;
  album_id: string;
  photo_url: string;
  caption: string | null;
  media_type: "image" | "video";
}

export const DEMO_ALBUMS: GalleryAlbum[] = [
  { id: "g1", title: "Annual Day 2026", description: "Highlights from the annual day ceremony and prize distribution.", cover_url: null },
  { id: "g2", title: "Science Fair", description: "Student projects from the district science fair.", cover_url: null },
  { id: "g3", title: "Campus Life", description: "Everyday moments around the Ghallanai campus.", cover_url: null },
];

export const DEMO_PHOTOS: GalleryPhoto[] = [];

export interface LibraryFileRow {
  id: string;
  title: string;
  description: string | null;
  category: string;
  class_label: string;
  subject: string | null;
  file_url: string;
  file_type: string;
  file_size: string | null;
  cover_url: string | null;
  download_count: number;
}

export const DEMO_LIBRARY: LibraryFileRow[] = [
  { id: "l1", title: "Physics past papers — BISE 2025", description: "Compiled board past papers with marking schemes for both years.", category: "Past Papers", class_label: "2nd Year — Pre-Engineering", subject: "Physics", file_url: "https://example.com/physics-past-papers", file_type: "LINK", file_size: null, cover_url: null, download_count: 214 },
  { id: "l2", title: "Computer Science notes — Chapters 1–5", description: "Class notes covering programming fundamentals and databases.", category: "Notes", class_label: "1st Year — ICS", subject: "Computer Science", file_url: "https://example.com/cs-notes", file_type: "LINK", file_size: null, cover_url: null, download_count: 341 },
  { id: "l3", title: "Admission form 2026-27", description: "Printable admission form for the current session.", category: "Admission", class_label: "All", subject: null, file_url: "https://example.com/admission-form", file_type: "LINK", file_size: null, cover_url: null, download_count: 587 },
  { id: "l4", title: "Biology practical notebook guide", description: "How to maintain the practical copy for board examination.", category: "Notes", class_label: "1st Year — Pre-Medical", subject: "Biology", file_url: "https://example.com/bio-practical", file_type: "LINK", file_size: null, cover_url: null, download_count: 129 },
];

export interface SchoolSettingsRow {
  id: number;
  school_name: string;
  tagline: string;
  description: string | null;
  about_text: string | null;
  emis_code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  established_year: number | null;
  total_students: number | null;
  total_teachers: number | null;
  pass_percentage: number | null;
  board_results: string | null;
  logo_url: string | null;
  banner_url: string | null;
  location_lat: number | null;
  location_lng: number | null;
  principal_name: string | null;
  principal_message: string | null;
  principal_photo_url: string | null;
  admission_open: boolean;
  admission_session: string;
  admission_deadline: string | null;
  admission_banner: string | null;
}

export const DEMO_SETTINGS: SchoolSettingsRow = {
  id: 1,
  school_name: "Government Higher Secondary School Ghallanai",
  tagline: "Knowledge, Character, Service",
  description:
    "The district's government higher secondary school — two decisive years across ICS, Pre-Medical, Pre-Engineering and Arts, with published results and merit lists.",
  about_text: null,
  emis_code: "SAMPLE-EMIS",
  address: "Ghallanai, Mohmand District, Khyber Pakhtunkhwa, Pakistan",
  phone: "+92-XXX-XXXXXXX",
  email: "info@ghssghallanai.edu.pk",
  established_year: 2005,
  total_students: 640,
  total_teachers: 28,
  pass_percentage: 92.5,
  board_results: "A+",
  logo_url: null,
  banner_url: null,
  location_lat: 34.5269,
  location_lng: 71.4567,
  principal_name: "Mr. SAMPLE Principal",
  principal_message:
    "Every student who walks through our gates carries the expectations of a family and a district. Our task is simple to say and serious to do: teach well, test fairly, and publish what we achieve.",
  principal_photo_url: null,
  admission_open: true,
  admission_session: "2026-27",
  admission_deadline: "2026-11-15",
  admission_banner: "Admissions open for the 2026-27 session — apply online.",
};

/** Homepage subjects marquee (programme subjects across the four streams). */
export const MARQUEE_SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology", "Computer Science",
  "English", "Urdu", "Islamiyat", "Pakistan Studies", "Civics",
  "Economics", "Statistics", "History", "Physical Education", "Arabic",
];

/** Thought of the Day — 25 quotes, deterministic day-of-year rotation. */
export interface DailyQuote {
  text: string;
  author: string;
  category: "motivational" | "islamic" | "educational";
}

export const DAILY_QUOTES: DailyQuote[] = [
  { text: "The beautiful thing about learning is that no one can take it away from you.", author: "B.B. King", category: "educational" },
  { text: "Education is the most powerful weapon which you can use to change the world.", author: "Nelson Mandela", category: "educational" },
  { text: "Seeking knowledge is obligatory upon every Muslim.", author: "Prophet Muhammad ﷺ", category: "islamic" },
  { text: "The best among you are those who learn the Qur'an and teach it.", author: "Prophet Muhammad ﷺ", category: "islamic" },
  { text: "Whoever treads a path seeking knowledge, Allah will make easy for him the path to Paradise.", author: "Hadith — Muslim", category: "islamic" },
  { text: "Success is the sum of small efforts repeated day in and day out.", author: "Robert Collier", category: "motivational" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke", category: "motivational" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes", category: "motivational" },
  { text: "Learning never exhausts the mind.", author: "Leonardo da Vinci", category: "educational" },
  { text: "The roots of education are bitter, but the fruit is sweet.", author: "Aristotle", category: "educational" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin", category: "educational" },
  { text: "Genius is one percent inspiration and ninety-nine percent perspiration.", author: "Thomas Edison", category: "motivational" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela", category: "motivational" },
  { text: "Don't watch the clock; do what it does — keep going.", author: "Sam Levenson", category: "motivational" },
  { text: "The future belongs to those who prepare for it today.", author: "Malcolm X", category: "motivational" },
  { text: "A room without books is like a body without a soul.", author: "Cicero", category: "educational" },
  { text: "Knowledge is the light of the heart.", author: "Arabic proverb", category: "islamic" },
  { text: "He who has a thousand friends has not a friend to spare.", author: "Ralph Waldo Emerson", category: "educational" },
  { text: "The pen is mightier than the sword.", author: "Edward Bulwer-Lytton", category: "educational" },
  { text: "Patience is the key to relief.", author: "Arabic proverb", category: "islamic" },
  { text: "Strive for progress, not perfection.", author: "Unknown", category: "motivational" },
  { text: "You miss one hundred percent of the shots you don't take.", author: "Wayne Gretzky", category: "motivational" },
  { text: "Reading is to the mind what exercise is to the body.", author: "Joseph Addison", category: "educational" },
  { text: "The mind is not a vessel to be filled but a fire to be kindled.", author: "Plutarch", category: "educational" },
  { text: "Actions are judged by intentions.", author: "Hadith — Bukhari", category: "islamic" },
];

export function getTodayQuote(): DailyQuote {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const dayOfYear = Math.floor((Date.now() - start.getTime()) / 86_400_000);
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

/** Sample fee vouchers for demo mode. */
export interface VoucherRow {
  id: string;
  voucher_number: string;
  student_name: string;
  roll_no: string | null;
  class_label: string;
  month: number;
  year: number;
  fee_period: string;
  fee_items: { label: string; fee_type: string; amount: number; is_optional?: boolean }[];
  total_amount: number;
  paid_amount: number;
  late_fee: number;
  due_date: string;
  status: string;
  bank_details: Record<string, unknown>;
  notes: string | null;
}

export const DEMO_VOUCHERS: VoucherRow[] = [
  {
    id: "v1", voucher_number: "VCH-202610-A1B2", student_name: "SAMPLE Student A", roll_no: "PM-21",
    class_label: "1st Year — Pre-Medical", month: 10, year: 2026, fee_period: "monthly",
    fee_items: [{ label: "Monthly tuition", fee_type: "tuition", amount: 350 }],
    total_amount: 350, paid_amount: 350, late_fee: 0, due_date: daysFromNow(-5), status: "paid",
    bank_details: {}, notes: null,
  },
  {
    id: "v2", voucher_number: "VCH-202610-C3D4", student_name: "SAMPLE Student C", roll_no: "ICS-14",
    class_label: "1st Year — ICS", month: 10, year: 2026, fee_period: "monthly",
    fee_items: [{ label: "Monthly tuition", fee_type: "tuition", amount: 350 }],
    total_amount: 350, paid_amount: 150, late_fee: 0, due_date: daysFromNow(9), status: "partial",
    bank_details: {}, notes: "Paid Rs 150 at the office counter.",
  },
  {
    id: "v3", voucher_number: "VCH-202609-E5F6", student_name: "SAMPLE Student E", roll_no: "ART-07",
    class_label: "2nd Year — Arts", month: 9, year: 2026, fee_period: "monthly",
    fee_items: [{ label: "Monthly tuition", fee_type: "tuition", amount: 300 }],
    total_amount: 300, paid_amount: 0, late_fee: 50, due_date: daysFromNow(-20), status: "overdue",
    bank_details: {}, notes: null,
  },
];

export interface FeeStructureRow {
  id: string;
  class_label: string;
  fee_type: string;
  label: string;
  amount: number;
  is_optional: boolean;
  is_recurring: boolean;
  frequency: string;
  is_active: boolean;
  payment_methods: unknown[];
}

export const DEMO_FEE_STRUCTURES: FeeStructureRow[] = [
  { id: "f1", class_label: "1st Year — ICS", fee_type: "tuition", label: "Monthly tuition", amount: 350, is_optional: false, is_recurring: true, frequency: "monthly", is_active: true, payment_methods: [] },
  { id: "f2", class_label: "1st Year — ICS", fee_type: "lab", label: "Computer lab (annual)", amount: 1500, is_optional: false, is_recurring: true, frequency: "annual", is_active: true, payment_methods: [] },
  { id: "f3", class_label: "1st Year — Pre-Medical", fee_type: "tuition", label: "Monthly tuition", amount: 350, is_optional: false, is_recurring: true, frequency: "monthly", is_active: true, payment_methods: [] },
  { id: "f4", class_label: "1st Year — Pre-Medical", fee_type: "lab", label: "Biology lab (annual)", amount: 1200, is_optional: false, is_recurring: true, frequency: "annual", is_active: true, payment_methods: [] },
  { id: "f5", class_label: "1st Year — Pre-Engineering", fee_type: "tuition", label: "Monthly tuition", amount: 350, is_optional: false, is_recurring: true, frequency: "monthly", is_active: true, payment_methods: [] },
  { id: "f6", class_label: "1st Year — Arts", fee_type: "tuition", label: "Monthly tuition", amount: 300, is_optional: false, is_recurring: true, frequency: "monthly", is_active: true, payment_methods: [] },
];
