# HED KPK OCAS — Complete Admission Flow Analysis
Captured live from https://admission.hed.gkp.pk on 2026-10-06
Reference college: college_id=332 (Govt. Girls Degree College Ekka Ghund, Mohmand)

## Overview

The HED portal uses a **4-step admission flow** for Intermediate admission,
plus a separate registration step and a tracking page. The flow is driven by
JavaScript with BISE board API integration for student record verification.

## Programmes Offered at College 332

| # | Programme | Study Level |
|---|-----------|-------------|
| 1 | Arts/Humanities | Intermediate |
| 2 | Associate Degree of English | Associate Degree |
| 3 | BS Botany | BS 4 Years |
| 4 | BS Islamiat | BS 4 Years |
| 5 | Computer Sciences (ICS) | Intermediate |
| 6 | Inter-Sciences | Intermediate |
| 7 | Pre-Engineering | Intermediate |
| 8 | Pre-Medical | Intermediate |

For GHSS Ghallanai (a school/college), the four Intermediate programmes we need
are: **Arts, Pre-Medical, Pre-Engineering, ICS** — for both 1st Year (Part-I) and
2nd Year (Part-II transfer).

## Authentication System

### Registration page (`apply_step1.php`)

**Form:** `first_step_from` → POST to `apply_step1.2.php`

**Step indicator:** `1 Create Account → 2 Board Verification → 3 Personal Information → 4 Academic Information`

**Fields:**
- `country_radio_button` (radio, required): `Pakistani` | `Afghani`
- `pakistani_card_number` (text, max 13, no dashes) — shown when Pakistani
- `afghani_card_number` (text) — shown when Afghani
- `mobile_number` (tel, max 11, format `03451234567`) — locked for life
- `password` (password, min 8)
- `conf_password` (password) — confirm

**Validation:** CNIC must be 13 digits without dashes; mobile must start with `03`;
password ≥ 8 chars; passwords must match.

### Login page (`student_login.php`)

**Form:** `student_login_form` → POST to `student_login_act.php`

**Fields:**
- `login_id` (text, required, placeholder "Enter CNIC")
- `password` (password)
- `firstNumber` (hidden) + `secondNumber` (hidden) — captcha operands
- `captchaResult` (text, required) — sum of the two

**CSRF:** Site uses `csrfprotector.js` to inject CSRF tokens into all POSTs.
Login fails with HTTP 500 if attempted via raw curl/Python (no JS).

### Forgotten password

A separate modal allows mobile-number-based reset: enters mobile number →
SMS code → reset password.

## Dashboard (`student_dashboard.php`)

After login the user sees a sidebar menu:
- New Admission Request
- All Applications
- Personal Information
- Matric Profile
- Intermediate Profile
- Alerts
- Change Password
- Logout

A modal popup asks the user to choose an admission type:
- **APPLY FOR INTER ADMISSION** (1st Year / 2nd Year Intermediate)
- APPLY FOR BS ADMISSION
- APPLY FOR ASSOCIATE DEGREE PROGRAM ADMISSION

Clicking "APPLY FOR INTER ADMISSION" → `student_academic_profile_entry.php?type=inter`

## Step 2: Academic Profile Entry (Board Verification)

**URL:** `student_academic_profile_entry.php?type=inter`
**Form:** `the_step_3_form` → POST to `student_academic_profile_entry_act.php`
**Hidden fields:** `form_applicant_id`, `board_student_name`, `board_father_name`,
`board_date_of_birth`, `profile_data_source`, `batman=watching` (honeypot)

### Inputs

| Field | Type | Required | Notes |
|---|---|---|---|
| `highest_exam_passed_id` | select | yes | SSC (matric) or HSC (inter) |
| `passed_studygroup_id` | select | yes | Science (Bio/Chem/Phys/Maths)=3, Arts=4, Science (Computer)=34 |
| `province_id` | select | yes | 7 Pakistan provinces + AJK + GB |
| `exam_boards_universities_id` | select | yes | 30+ BISE boards; filtered by province; pointer-events:none (auto) |
| `highest_exam_session` | select | yes | annual / supplementary / other |
| `highest_exam_passing_year` | select | yes | 2000..2026 |
| `highest_exam_roll_number` | text | yes | maxlength 10, numeric only |
| `highest_exam_marks_obtained` | number | yes | disabled until FETCH DATA; auto-filled by board API |
| `highest_exam_marks_total` | number | yes | disabled until FETCH DATA; auto-filled by board API |
| `highest_exam_grade` | hidden | — | auto-calculated |
| `hafiz_quran` | radio | yes | 0 = No (default), 1 = Yes |
| `institute_province` | select | yes | same 7 provinces |
| `institute_district` | select | yes | populated via JS based on province |
| `institute_name` | text | yes | school/college name |
| `save_information` | submit | — | "Save Information" button |

### Board API Integration

The "FETCH DATA" button triggers a JS call to a BISE board endpoint that
returns the student's record based on (board, session, year, roll number).
The returned data fills:
- `board_student_name`, `board_father_name`, `board_date_of_birth`
- `highest_exam_marks_obtained`, `highest_exam_marks_total`
- `highest_exam_grade` (A1, A, B, C, D, E, F)
- Domicile, school name, district

A modal shows the fetched record and offers:
- "Process with Board Data" (use API data)
- "Proceed with Manual Data" (skip API, enter marks manually)

### Instructions (Urdu, translated)

1. Select last exam passed (Matric/Inter)
2. Select study group (Arts/Science)
3. Select province of last exam
4. Select board name
5. Select exam session (Annual/Supply)
6. Select exam year
7. Enter board roll number
8. Enter obtained marks (auto-filled from API)
9. Enter total marks (auto-filled from API)
10. Percentage auto-calculated
11. Grade auto-calculated
12. Hafiz-e-Quran: yes/no (5% extra marks in some schemes)
13. Select school/college province
14. Select school/college district
15. Enter school/college name

## Step 3: Personal Profile (`student_personal_profile.php`)

**Form:** `second_step_from` → POST to `student_personal_profile_act.php`
**enctype:** `multipart/form-data`

### Inputs (extensive)

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | text | yes | maxlength 50; readonly if filled by board API |
| `father_name` | text | yes | maxlength 50; readonly if filled |
| `year` / `month` / `day` | selects | yes | DOB; year 1987..2012, month 1..12, day 1..31 |
| `email_address` | email | no | optional |
| `mobile_number` | text | yes | 11 digits, format `03459153835` |
| `religion` | select | yes | islam / hinduism / christianity / sikhism / other |
| `cnic_formb` | text | yes | 13 digits, the CNIC used at registration (readonly) |
| `applicant_nationality` | hidden | yes | Pakistani or Afghani (fixed from registration) |
| `applicant_nationality_first` | select | yes | disabled — same as registration nationality |
| `afghani_province` | select | conditional | 35 Afghan provinces; shown only for Afghani nationality |
| `landline_number` | text | no | max 10 digits |
| `domicile_province` | select | yes | 8 options (same 7 + AJK) |
| `domicile_district` | select | yes | 37 options for KPK alone |
| `applicant_mailing_tehsil` | select | yes | populated based on district; e.g. Peshawar → Badhaber, Peshawar City, etc. |
| `applicant_union_council` | select | yes | populated based on tehsil; ~100+ UCs for Peshawar |
| `gender` | radio | yes | male / female / other |
| `applicant_blood_group` | select | yes | A+, A-, B+, B-, AB+, AB-, O+, O-, Nil |
| `father_cnic` | text | yes | 13 digits |
| `father_mobile` | tel | yes | 11 digits, `03459153835` format |
| `mother_name` | text | yes | maxlength 50 |
| `mother_cnic` | text | yes | 13 digits |
| `applicant_photo` | file | yes | passport-size photo upload |
| `mailing_address` | textarea | yes | postal address |
| `step2_2_submit` | hidden | — | form marker |
| `step2_submit` | submit | — | "Save Personal Profile" button |

### Pre-Submission Confirm Dialog

Before saving, JavaScript shows: *"Please make sure you entered correct
information, you will not be able to change it. Click cancel to review."*
Once confirmed, personal info is locked permanently for that account.

### Instructions (Urdu, translated)

1. Enter full name (auto from board)
2. Enter father's name (auto)
3. Enter date of birth (auto)
4. Enter email address
5. Enter mobile number
6. Select religion
7. Enter CNIC number (locked from registration)
8. Select nationality (locked)
9. Enter landline number
10. Select your domicile province
11. Select domicile district
12. Select tehsil
13. Select union council
14. Select gender
15. Select blood group
16. Enter father's CNIC
17. Enter father's mobile number
18. Enter mother's name
19. Enter mother's CNIC
20. Enter mailing address

## Step 4: Academic Information (Programme Selection)

The next step (presumably `student_academic_information.php` or similar) would
let the applicant:
- Select college (already chosen via college_id=332)
- Select programme (Arts / Pre-Medical / Pre-Engineering / ICS / Inter-Sciences)
- Select shift (Morning / Evening)
- Select 1st Year or 2nd Year (Part-II transfer)
- For 2nd Year: provide 1st-year DMC, registration, migration affidavit
- Upload required documents
- Review and final declaration
- Submit → generates application tracking ID

**Note:** I deliberately STOPPED at the personal info confirmation dialog
because saving would lock the test data permanently on the live HED system
for this CNIC. The full Step 4 schema is inferred from:
- The programme list at `programs.php?college_id=332`
- The "All Applications" tracking structure on the dashboard
- The existing GHSS Ghallanai apply-form (which already mirrors HED)

## Tracking Page (`application_status.php`)

**Form:** GET to `application_status.php`

**Fields:**
- `application_id` (text, required) — applicant enters their tracking ID

**Returns:** Application status, programme, college, applicant name, last update
date, current status (received / under review / shortlisted / offered / admitted /
rejected), decision notes.

## Multi-Step Flow Summary (HED Pattern)

```
1. Register (apply_step1.php) → creates account
2. Login (student_login.php) → enters dashboard
3. Choose admission type → APPLY FOR INTER ADMISSION
4. Step 2: Academic Profile Entry (board verification)
   - Select exam/study group/province/board/session/year/roll no
   - FETCH DATA from BISE board API → auto-fill marks + grade + name
   - Or proceed with manual data
   - Select institute province/district/school name
   - Save → moves to Step 3
5. Step 3: Personal Profile
   - Name, father name, DOB (auto from board API)
   - Email, mobile, religion, nationality (locked), CNIC (locked)
   - Domicile province/district/tehsil/union council
   - Gender, blood group, father CNIC/mobile, mother name/CNIC
   - Upload passport photo
   - Mailing address
   - Confirm dialog → Save (locked forever)
6. Step 4: Academic Information / Programme Selection
   - Select programme (Arts / ICS / Pre-Med / Pre-Eng)
   - Select shift (Morning/Evening)
   - Select 1st Year or 2nd Year (Part-II)
   - For 2nd Year: 1st-year DMC + registration + affidavit
   - Upload documents (photo, B-form, matric card, etc.)
   - Declaration
   - Submit → application tracking ID
7. Track Application (application_status.php)
   - Enter tracking ID → see status timeline
```

## Key Validations to Mirror on GHSS Ghallanai

- **CNIC**: 13 digits, no dashes, regex `^\d{13}$`
- **Mobile**: 11 digits starting with `03`, regex `^03\d{9}$`
- **Matric marks**: 0 ≤ obtained ≤ total; typical total 1100 or 1200
- **1st Year marks**: 0 ≤ obtained ≤ total; typical total 550 (Part-I) or 1100 (full)
- **DOB**: ≥ 1987, ≤ 2012 (15-39 age range)
- **Email**: optional but if provided, must be valid format
- **Gender**: required, enum
- **Religion**: required, enum
- **Blood group**: required, enum (8 types + Nil)
- **Photo**: file upload, passport-size
- **Domicile**: required province → district → tehsil → UC cascade
- **Hafiz-e-Quran**: yes/no radio (affects merit in some schemes)
- **Father/Mother CNIC**: 13 digits each
- **Father mobile**: 11 digits starting with 03
- **Final confirm dialog**: "information cannot be changed after submit"

## Key Differences to Add to GHSS Ghallanai

1. **Board API integration** — HED fetches real BISE data. GHSS Ghallanai
   should let students either upload matric DMC OR enter manual marks.
2. **Step 3 personal info lock** — once saved, cannot be changed. GHSS
   Ghallanai should also lock personal info after submit (with a confirm dialog).
3. **Domicile cascade** — province → district → tehsil → union council.
   Currently GHSS has just district. Should add tehsil + UC.
4. **Blood group** field — currently missing from GHSS form.
5. **Mother's name + CNIC** — currently GHSS only has father. Add mother.
6. **Photo upload** as a separate field in personal info (not just documents).
7. **Hafiz-e-Quran** checkbox/radio.
8. **Multiple admission types** (Inter/BS/Associate) — GHSS only needs Inter
   for 1st Year and 2nd Year.

