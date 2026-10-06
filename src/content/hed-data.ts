/**
 * HED-ALIGNED DATA — captured from the live HED KPK OCAS portal
 * (admission.hed.gkp.pk) on 2026-10-06. These mirror the dropdown options
 * used by the HED admission form so applicants see familiar fields.
 *
 * Used by:
 *   - src/components/site/apply-form.tsx (5-step apply form)
 *   - src/components/site/registration-form.tsx (account creation)
 *   - src/components/site/tracking-lookup.tsx (status lookup)
 */

// ---------------------------------------------------------------------------
// PROVINCES — matches HED province_id values
// ---------------------------------------------------------------------------
export const PROVINCES = [
  { value: "1", label: "Khyber Pakhtunkhwa" },
  { value: "2", label: "Punjab" },
  { value: "3", label: "Sindh" },
  { value: "4", label: "Balochistan" },
  { value: "6", label: "Islamabad (Capital Area)" },
  { value: "7", label: "Gilgit & Baltistan" },
  { value: "8", label: "Azad Jammu And Kashmir" },
] as const;

// ---------------------------------------------------------------------------
// MATRIC BOARDS — matches HED exam_boards_universities_id list (subset relevant
// to KPK + Federal). Each board belongs to a province; the form filters the
// board dropdown by selected province (HED behaviour).
// ---------------------------------------------------------------------------
export const BOARDS_BY_PROVINCE: Record<string, { value: string; label: string }[]> = {
  "1": [ // Khyber Pakhtunkhwa
    { value: "BISE Abbottabad", label: "BISE Abbottabad" },
    { value: "BISE Bannu", label: "BISE Bannu" },
    { value: "BISE DI Khan", label: "BISE D.I. Khan" },
    { value: "BISE Kohat", label: "BISE Kohat" },
    { value: "BISE Malakand", label: "BISE Malakand" },
    { value: "BISE Mardan", label: "BISE Mardan" },
    { value: "BISE Peshawar", label: "BISE Peshawar" },
    { value: "BISE Swat", label: "BISE Swat" },
    { value: "IBCC KPK", label: "Inter Board Committee of Chairman (IBCC) KPK" },
    { value: "KP Board Technical", label: "KP Board of Technical & Commerce Education, Peshawar" },
  ],
  "2": [ // Punjab
    { value: "BISE Bahawalpur", label: "BISE Bahawalpur" },
    { value: "BISE D.G. Khan", label: "BISE D.G. Khan" },
    { value: "BISE Faisalabad", label: "BISE Faisalabad" },
    { value: "BISE Gujranwala", label: "BISE Gujranwala" },
    { value: "BISE Lahore", label: "BISE Lahore" },
    { value: "BISE Multan", label: "BISE Multan" },
    { value: "BISE Rawalpindi", label: "BISE Rawalpindi" },
    { value: "BISE Sargodha", label: "BISE Sargodha" },
  ],
  "3": [ // Sindh
    { value: "BISE Hyderabad", label: "BISE Hyderabad" },
    { value: "BISE Karachi", label: "BISE Karachi" },
    { value: "BISE Larkana", label: "BISE Larkana" },
    { value: "BISE Mirpurkhas", label: "BISE Mirpurkhas" },
    { value: "BISE Sukkur", label: "BISE Sukkur" },
    { value: "BSE Karachi", label: "BSE Karachi" },
  ],
  "4": [ // Balochistan
    { value: "BISE Quetta", label: "BISE Quetta" },
  ],
  "6": [ // Islamabad
    { value: "FBISE", label: "Federal Board of Intermediate & Secondary Education, Islamabad" },
    { value: "IBCC Islamabad", label: "Inter Board Committee of Chairman (IBCC) Islamabad" },
  ],
  "7": [ // Gilgit & Baltistan
    { value: "KIU", label: "Karakoram International University (Gilgit Baltistan Board)" },
  ],
  "8": [ // AJK
    { value: "BISE AJK Mirpur", label: "BISE AJK Mirpur" },
  ],
};

// ---------------------------------------------------------------------------
// KPK DISTRICTS — matches HED institute_district / domicile_district list
// (KPK has 36 districts; the form populates this when KPK is selected)
// ---------------------------------------------------------------------------
export const KPK_DISTRICTS = [
  { value: "Abbottabad", label: "Abbottabad" },
  { value: "Bajaur", label: "Bajaur" },
  { value: "Bannu", label: "Bannu" },
  { value: "Bar Swat", label: "Bar Swat" },
  { value: "Battagram", label: "Battagram" },
  { value: "Buner", label: "Buner" },
  { value: "Charsadda", label: "Charsadda" },
  { value: "Dera Ismail Khan", label: "Dera Ismail Khan" },
  { value: "Dir Lower", label: "Dir Lower" },
  { value: "Dir Upper", label: "Dir Upper" },
  { value: "Hangu", label: "Hangu" },
  { value: "Haripur", label: "Haripur" },
  { value: "Karak", label: "Karak" },
  { value: "Khyber", label: "Khyber" },
  { value: "Kohat", label: "Kohat" },
  { value: "Kohistan Lower", label: "Kohistan Lower" },
  { value: "Kohistan Upper", label: "Kohistan Upper" },
  { value: "Kolai Palas", label: "Kolai Palas" },
  { value: "Kurram", label: "Kurram" },
  { value: "Lakki Marwat", label: "Lakki Marwat" },
  { value: "Lower Chitral", label: "Lower Chitral" },
  { value: "Malakand", label: "Malakand" },
  { value: "Mansehra", label: "Mansehra" },
  { value: "Mardan", label: "Mardan" },
  { value: "Mohmand", label: "Mohmand" },
  { value: "North Waziristan", label: "North Waziristan" },
  { value: "Nowshera", label: "Nowshera" },
  { value: "Orakzai", label: "Orakzai" },
  { value: "Peshawar", label: "Peshawar" },
  { value: "Shangla", label: "Shangla" },
  { value: "South Waziristan", label: "South Waziristan" },
  { value: "Swabi", label: "Swabi" },
  { value: "Swat", label: "Swat" },
  { value: "Tank", label: "Tank" },
  { value: "Torghar", label: "Torghar" },
  { value: "Upper Chitral", label: "Upper Chitral" },
] as const;

// Other provinces: simplified district list (top major districts each)
export const PUNJAB_DISTRICTS = [
  "Bahawalpur", "D.G. Khan", "Faisalabad", "Gujranwala", "Lahore", "Multan",
  "Rawalpindi", "Sargodha", "Sialkot", "Gujrat", "Jhelum", "Sheikhupura",
  "Kasur", "Okara", "Sahiwal", "Vehari", "Khanewal", "Bahawalnagar",
] as const;

export const SINDH_DISTRICTS = [
  "Karachi", "Hyderabad", "Larkana", "Mirpurkhas", "Sukkur", "Dadu", "Thatta",
  "Badin", "Tharparkar", "Khairpur", "Naushahro Feroze", "Nawabshah", "Jacobabad",
  "Shikarpur", "Ghotki", "Kashmore", "Matiari", "Tando Allahyar", "Tando Muhammad Khan",
] as const;

export const BALOCHISTAN_DISTRICTS = [
  "Quetta", "Gwadar", "Turbat", "Khuzdar", "Sibi", "Zhob", "Loralai", "Chaman",
  "Pishin", "Killa Abdullah", "Killa Saifullah", "Mastung", "Kalat", "Kharan",
  "Nushki", "Washuk", "Panjgur", "Awaran", "Kech", "Lasbela", "Hub",
] as const;

export const ISLAMABAD_SECTORS = [
  "Sector G-6", "Sector G-7", "Sector G-8", "Sector G-9", "Sector G-10", "Sector G-11",
  "Sector F-6", "Sector F-7", "Sector F-8", "Sector F-10", "Sector F-11", "Sector I-8",
  "Sector I-9", "Sector I-10", "Sector H-8", "Sector H-9", "Sector H-11", "Sector H-12",
  "Bhara Kahu", "Tarnol", "Sangjani", "Nilore", "Sihala", "Tarlai",
] as const;

export const AJK_DISTRICTS = [
  "Muzaffarabad", "Mirpur", "Kotli", "Bagh", "Rawalakot", "Poonch", "Bhimber",
  "Haveli", "Neelum", "Hattian", "Sudhanoti", "Abbaspur",
] as const;

export const GILGIT_BALTISTAN_DISTRICTS = [
  "Gilgit", "Skardu", "Hunza", "Ghizer", "Ganche", "Shigar", "Kharmang",
  "Astore", "Diamer", "Nagar", "Roundu", "Darel", "Tangir", "Yasin", "Gupis",
] as const;

export function getDistrictsForProvince(provinceValue: string): readonly string[] {
  switch (provinceValue) {
    case "1": return KPK_DISTRICTS.map(d => d.value);
    case "2": return PUNJAB_DISTRICTS;
    case "3": return SINDH_DISTRICTS;
    case "4": return BALOCHISTAN_DISTRICTS;
    case "6": return ISLAMABAD_SECTORS;
    case "7": return GILGIT_BALTISTAN_DISTRICTS;
    case "8": return AJK_DISTRICTS;
    default: return [];
  }
}

// ---------------------------------------------------------------------------
// TEHSILS — populated based on district. Captured from HED for Peshawar; other
// KPK districts follow the standard BISE district → tehsil mapping.
// ---------------------------------------------------------------------------
export const TEHSILS_BY_DISTRICT: Record<string, string[]> = {
  "Peshawar": ["Peshawar", "Badhaber", "Chamkani"],
  "Mardan": ["Mardan", "Takht Bhai", "Katlang"],
  "Charsadda": ["Charsadda", "Tangi", "Shabqadar"],
  "Nowshera": ["Nowshera", "Pabbi", "Jahangira"],
  "Swat": ["Mingora", "Bar Swat", "Kabal", "Mattta"],
  "Abbottabad": ["Abbottabad", "Havelian", "Lora"],
  "Haripur": ["Haripur", "Ghazi", "Khalabat"],
  "Mansehra": ["Mansehra", "Balakot", "Oghi", "Baffa"],
  "Bannu": ["Bannu", "Domel"],
  "Lakki Marwat": ["Lakki Marwat", "Naurang"],
  "Kohat": ["Kohat", "Lachi", "Tanda"],
  "Karak": ["Karak", "Takht-e-Nasrati"],
  "Dera Ismail Khan": ["Dera Ismail Khan", "Daraban", "Paharpur"],
  "Tank": ["Tank", "Jatoi"],
  "Buner": ["Buner", "Chagharzai"],
  "Swabi": ["Swabi", "Lahor", "Topi", "Razar"],
  "Dir Lower": ["Timergara", "Balambat", "Adenzai"],
  "Dir Upper": ["Dir", "Wari", "Kalkot"],
  "Malakand": ["Malakand", "Dargai"],
  "Shangla": ["Alpuri", "Bisham", "Puran", "Chakesar"],
  "Battagram": ["Battagram", "Allai", "Pattan"],
  "Kohistan Lower": ["Dassu", "Pattan", "Kandia"],
  "Kohistan Upper": ["Dassu", "Pattan", "Seo"],
  "Bajaur": ["Khar", "Nawagai", "Mamund", "Charmang"],
  "Mohmand": ["Ghallanai", "Ekka Ghund", "Yekka Ghund", "Lakaro"],
  "Khyber": ["Bara", "Jamrud", "Landi Kotal"],
  "Kurram": ["Parachinar", "Sadda", "Alizai"],
  "Orakzai": ["Kalaya", "Dabori", "Stori Khel"],
  "North Waziristan": ["Miranshah", "Razmak", "Spinwam"],
  "South Waziristan": ["Wana", "Makeen", "Ladha"],
  "Lower Chitral": ["Chitral", "Drosh"],
  "Upper Chitral": ["Mastuj", "Booni", "Torkhow"],
  "Kolai Palas": ["Kolai", "Palas"],
  "Torghar": ["Judba", "Madda"],
  "Bar Swat": ["Madyan", "Bahrain", "Kalam"],
};

export function getTehsilsForDistrict(district: string): string[] {
  return TEHSILS_BY_DISTRICT[district] ?? [];
}

// ---------------------------------------------------------------------------
// UNION COUNCILS — captured from HED for Peshawar tehsil (the only tehsil
// with a full UC list in the live capture). Other tehsils fall back to
// a generic "Not Applicable / Rural / Urban" set.
// ---------------------------------------------------------------------------
export const UNION_COUNCILS_PESHAWAR: string[] = [
  "Abaseen/Nawaz Abad", "Abdara", "Abdara Road", "Abu Bakar Siddique-1",
  "Abu Bakar Siddique-2", "Abu Bakar Siddique-3", "Abu Bakar Siddique-4",
  "Achar-1", "Achar-2", "Achini Payan", "Afghan Colony", "Afridi Abad",
  "Afridi Garhi", "Akhunabad-1", "Akhunabad-2", "Amin Colony", "Arbaban",
  "Asia-1", "Asia-2", "Babu Garhi-1", "Babu Garhi-2", "Bahader Kalley",
  "Basti Pawaka", "Behari Colony", "Beri Bagh", "Bhana Mari", "Charanda-1",
  "Charanda-2", "Charkhana-1", "Charkhana-2", "Chowk Nasir Khan", "Danish Abad",
  "Daud Zai", "Dhaki Nalbandi", "Dheri Baghbanan", "Dhora", "Din Bahar",
  "Eidgah Colony", "Garhi Qamar Din-1", "Garhi Qamar Din-2", "Garhi Rajkol-1",
  "Garhi Rajkol-2", "Ghanta Ghar", "Gharib Abad Shaheen Town", "Gharib Abad-1",
  "Gharib Abad-2", "Gharib Abad/Thor Baba-1", "Gharib Abad/Thor Baba-2",
  "Gharib Abad/Thor Baba-3", "Ghazali", "Gorghatri", "Gul Abad", "Gul Bahar No. 2",
  "Gul Bahar No. IV-1", "Gul Bahar No. IV-2", "Gulbahar No. 3", "Gulberg-1",
  "Gulberg-2", "Hassan Garhi", "Hazar Khwani", "Hussain Abad", "Imran Abad",
  "Industrial Estate", "Kandi Hasan Zai", "Khan Mast Colony", "Kishwar Abad",
  "Kotla Mohsin Khan", "Lala Zar-1", "Lala Zar-2", "Landi Arbab-1", "Landi Arbab-2",
  "Malakander", "Mandozai", "Marozai Deh Bahader", "Miskeen Abad", "Mohmand Abad",
  "Mughal Zai-1", "Mughal Zai-2", "Muhallah Kander", "Municipal Corporation Colony-1",
  "Municipal Corporation Colony-2", "Murshid Abad", "Muslim Abad", "Nauthia Jadeed-1",
  "Nauthia Jadeed-2", "Nauthia Qadeem-1", "Nauthia Qadeem-2", "Nawab Abad",
  "New Kakshal Wazir Abad", "Nodeh Bala-1", "Nodeh Bala-2", "Nodeh Payan",
  "Pahari Pura-1", "Pahari Pura-2", "Palosi Atozai", "Palosi Maghdarzai",
  "Palsoi Talarzai", "Pir Gulab Shah", "Qadir Abad", "Qaid Abad/Hameed Abad",
  "Rahat Abad", "Rahim Abad/Sheikh Abad-2", "Rameezai", "Rasheed Garhi-1",
  "Rasheed Garhi-3", "Regi Badi Zai", "Regi Lalma", "Regi Lalma-1", "Regi Lalma-2",
  "Regi Ruki Zai", "Regi Ufta Zai", "Regi Yousaf Zai", "Sabz Pir/Shah Masoom",
  "Sadozai-1", "Sadozai-2", "Saeed Abad/Faqir Abad", "Samdu Garhi",
  "Sardar Gul Colony", "Shagi Hindkian-1", "Shagi Hindkian-2", "Shah Baz Town",
  "Shaheen Muslim Town-1", "Shaheen Muslim Town-2", "Shaheen Town",
  "Sharif Abad/Rasheed Garhi-2", "Sheikh Abad-1", "Sheikh Ameer Abad",
  "Sikander Town/Gulbahar No. 1", "Tatara", "Wali Abad", "Wapda House",
  "Ward No.1 (Shami)", "Ward No.2 (Dabgari Garden)", "Ward No.3 (Saddar)",
  "Ward No.4 (Mall Road)", "Ward No.5 (Khyber)", "Yousaf Abad", "Zargar Abad-1",
  "Zargar Abad-2",
];

export function getUnionCouncilsForTehsil(district: string, tehsil: string): string[] {
  if (district === "Peshawar" && tehsil === "Peshawar") return UNION_COUNCILS_PESHAWAR;
  return ["Not Applicable", "Other"];
}

// ---------------------------------------------------------------------------
// EXAM SESSIONS, PASSING YEARS, STUDY GROUPS
// ---------------------------------------------------------------------------
export const EXAM_SESSIONS = [
  { value: "annual", label: "Annual" },
  { value: "supplementary", label: "Supplementary" },
  { value: "other", label: "Other" },
] as const;

export const PASSING_YEARS = [
  "2026", "2025", "2024", "2023", "2022", "2021", "2020", "2019", "2018",
  "2017", "2016", "2015", "2014", "2013", "2012", "2011", "2010", "2009",
  "2008", "2007", "2006", "2005", "2004", "2003", "2002", "2001", "2000",
] as const;

export const MATRIC_STUDY_GROUPS = [
  { value: "3", label: "Science (Biology, Chemistry, Physics, Maths)" },
  { value: "4", label: "Arts" },
  { value: "34", label: "Science (Computer Science, Chemistry, Physics, Maths)" },
] as const;

// ---------------------------------------------------------------------------
// RELIGIONS, GENDERS, BLOOD GROUPS — HED-aligned
// ---------------------------------------------------------------------------
export const RELIGIONS = [
  { value: "islam", label: "Islam" },
  { value: "christianity", label: "Christianity" },
  { value: "hinduism", label: "Hinduism" },
  { value: "sikhism", label: "Sikhism" },
  { value: "other", label: "Other" },
] as const;

export const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
] as const;

export const BLOOD_GROUPS = [
  "Nil", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-",
] as const;

// ---------------------------------------------------------------------------
// PROGRAMME OPTIONS — for 1st & 2nd year admission at GHSS Ghallanai
// (mirrors the four Intermediate programmes from HED)
// ---------------------------------------------------------------------------
export const PROGRAMME_OPTIONS = [
  {
    value: "ics",
    label: "ICS — Intermediate in Computer Science",
    min: 50,
    needs: "maths",
    hafiz: 0,
  },
  {
    value: "pre-medical",
    label: "F.Sc Pre-Medical",
    min: 60,
    needs: "science",
    hafiz: 0,
  },
  {
    value: "pre-engineering",
    label: "F.Sc Pre-Engineering",
    min: 60,
    needs: "maths",
    hafiz: 0,
  },
  {
    value: "arts",
    label: "FA — Humanities (Arts)",
    min: 33,
    needs: "any",
    hafiz: 0,
  },
] as const;

// ---------------------------------------------------------------------------
// SHIFTS — Morning / Evening
// ---------------------------------------------------------------------------
export const SHIFTS = [
  { value: "morning", label: "Morning" },
  { value: "evening", label: "Evening" },
] as const;

// ---------------------------------------------------------------------------
// DOCUMENT FIELDS — per admission type, HED-aligned
// ---------------------------------------------------------------------------
export const DOC_FIELDS_FIRST_YEAR = [
  { id: "photo", label: "Passport-size photograph (recent, plain background)", required: true },
  { id: "bform", label: "B-form (CRC) or CNIC scan", required: true },
  { id: "matric_card", label: "Matric result card / DMC", required: true },
  { id: "domicile", label: "Domicile certificate (own/father)", required: true },
  { id: "character_certificate", label: "Character certificate from last school", required: true },
  { id: "father_cnic", label: "Father / Guardian CNIC scan", required: true },
  { id: "concession_proof", label: "Concession / scholarship proof (if claiming)", required: false },
] as const;

export const DOC_FIELDS_SECOND_YEAR = [
  ...DOC_FIELDS_FIRST_YEAR,
  { id: "first_year_dmc", label: "1st-year (Part-I) detail mark certificate (DMC)", required: true },
  { id: "first_year_registration", label: "Board registration certificate (1st year)", required: true },
  { id: "affidavit", label: "Affidavit on Rs.50 stamp paper (migration undertaking)", required: true },
] as const;

// ---------------------------------------------------------------------------
// APPLICATION STATUS FLOW — HED-aligned (5 stages + rejected)
// ---------------------------------------------------------------------------
export const STATUS_FLOW = [
  "received",
  "review",
  "shortlisted",
  "offered",
  "admitted",
] as const;

export const STATUS_LABELS: Record<string, string> = {
  received: "Received",
  review: "Under Review",
  shortlisted: "Shortlisted",
  offered: "Offer Issued",
  admitted: "Admitted",
  rejected: "Rejected",
};

// ---------------------------------------------------------------------------
// APPLICATION NUMBER FORMAT — GHSS-<year>-<4-digit sequence>
// Matches HED's pattern of <short-prefix>-<year>-<sequence>
// ---------------------------------------------------------------------------
export const APPLICATION_NO_REGEX = /^GHSS-\d{4}-\d{4,8}$/;
