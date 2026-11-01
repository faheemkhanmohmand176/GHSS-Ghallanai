# HED KPK Online Admission — Inter (Intermediate/Diploma) Flow
## 100% Field-Level Capture — GHSS/GCMS Ghallanai, District Mohmand

> **Source**: http://www.admission.hed.gkp.pk (HEMIS CELL, Higher Education, Archives & Libraries Department, Government of Khyber Pakhtunkhwa)
> **College**: Govt. College of Management Sciences Ghallanai Mohmand (college_id **333**, district Mohmand **142**, college_gender **male**, college_type **1** = management/commerce)
> **Capture method**: Full walk-through with a live test account (CNIC 2140210101010) on 01-Nov-2026 — every page, field, option list, AJAX request/response, validation message, swal dialog, table and button captured to HTML/PNG/JSON (evidence pack in working notes, 100+ artifacts).
> **Scope for GHSS Ghallanai site**: Inter (1st/2nd Year) admissions ONLY — no BS/ADP.

---

## 0. THE COMPLETE JOURNEY (as actually walked)

```
PUBLIC SITE
  Home → Colleges → College Profile (programs/seats/merit lists) → Track Application → FAQ
  Register (4-step wizard) ─┐
  Login (CNIC + password + math captcha) ─┤
                            ▼
STUDENT PORTAL (logged in)
  1. Personal Information (profile)          — mandatory before applying
  2. Matric Profile (SSC — manual or Fetch)  — mandatory before Inter application
  3. New Admission Request
       District → College → Level of Studies → Program → Category(Quota)
       → [conditional quota fields] → Declaration → Submit Application
                            ▼
  4. Confirm Admission Request  (full review + Rs 100 fee notice)
       [Go Back]  or  [Submit & Pay Application Processing Fee]
                            ▼
  5. Pay Application Processing Fee
       Applicant Details + Payment Details (Tracking ID, Rs 100)
       [Proceed with Payment] → POST student_pay_application_fee_response.php
                            ▼
  6. Application Form (view/print)
       Processing Fee Status: Pending
       Token: 261101020394613  → pay at any JAZZ CASH / JazzCash App
       Deadline: on or before <submission date + 4 days>
       Tracking ID: NOV2026394612
                            ▼
  7. Dashboard → All Applications table (# | Tracking ID | College | Program |
       Quota | Hafiz e Quran | Fee Submission Deadline | Action: Pay Fee)
                            ▼
  8. PUBLIC Track Application  (no login — Tracking ID only)
       Result table: # | Tracking Id | College | Program | Payment Status | Application Date
       + Application Detail timeline: # | Title | Date | Details
```

---

## 1. ACCOUNT REGISTRATION — `apply_step1.php` (public)

**Wizard step indicator (4 steps):**
`1 Create Account → 2 Board Verification → 3 Personal Information → 4 Academic Information`

### Step 1 — Create Account fields
| Field | Control | Rules |
|---|---|---|
| Nationality * | radio `country_radio_button` | `Pakistani` / `Afghani` |
| CNIC/Form-B * | text `pakistani_card_number` | 13 digits, no dashes, e.g. 0000000000000 (Pakistani) |
| Afghan Card / Passport Number * | text | no dashes (Afghani) |
| Mobile Number * | text `mobile_number` | Format **03451234567**. "Make sure that your mobile number is correct … you will not be able to change your mobile number later. This mobile number will be used for online payment of application fee and all SMS alert regarding your admissions." |
| Password * | password | "Password should be at least 8 characters" |
| Confirm Password * | password | must match |
| Captcha | math `captchaResult` + hidden `firstNumber`/`secondNumber` | "Solve this simple math problem and enter the result. E.g. for 1+3=4, enter 4." (e.g. "3 + 2 =") |

- Form `POST → apply_step1.2.php`; button **Next Step**; "Already have an account Please **Login**"; "Stay Signed in".
- Steps 2/3 pages die() on direct access (sequential enforcement).
- Instructions block (EN + Urdu): CNIC mandatory, new password, re-enter, math answer, click create account; all applications online, no manual/postal forms; deadline binding.

### Login — `student_login.php`
| Field | Control |
|---|---|
| Login ID * | text `login_id` — placeholder "Enter CNIC" |
| Password | password |
| Captcha * | math `captchaResult` + hidden `firstNumber`/`secondNumber` |

---

## 2. STUDENT PORTAL MENU (sidebar, exact labels)

- **New Admission Request** → `student_submit_application.php`
- **All Applications** → `student_dashboard.php`
- **Personal Information** → `student_personal_profile.php`
- **Matric Profile** → `student_academic_profile_entry.php`
- Intermediate Profile → `student_intermediate_profile_entry.php` (BS path only)
- **Alerts** → `student_alerts.php` (table: # | Title | Date | Preview; "No alerts found...." initially)
- ~~Register Complaint / My Complaints~~ (commented out)
- Change Password → `student_change_password.php`
- Logout → `logout.php`

---

## 3. PERSONAL INFORMATION — `student_personal_profile.php`

| Field | Required | Notes |
|---|---|---|
| Name * | ✔ | max 50, "Enter your name" |
| Father Name * | ✔ | max 50 |
| Date of Birth * | ✔ | three selects: Year (2012→1987), Month (January…December), Day (1…30) |
| Email Address | – | email |
| Mobile Number * | ✔ | 11 digits 03XXXXXXXXX (locked from registration) |
| Landline Number | – | max 10 |
| Religion * | ✔ | Islam / Hinduism / Christianity / Sikhism / Other |
| CNIC/Form-B | locked | from account |
| Nationality * | ✔ | Pakistani / Afghani |
| Domicile Province * | ✔ | Khyber Pakhtunkhwa / Punjab / Sindh / Balochistan / Islamabad (capital Area) / Gilgit & Biltestan / Azad Jammu And Kashmir |
| Domicile District * | ✔ | full Pakistan district list (includes **Mohmand**) |
| Tehsil * | ✔ | full tehsil list (Mohmand tehsils incl. **Baizai**) |
| Union Council * | ✔ | district-dependent (Mohmand: 65 UCs — Baizai-1 … Ghallanai … Chamarkand) |
| Gender * | ✔ | radio male / female / other |
| Father CNIC * | ✔ | 13 digits |
| Father Mobile * | ✔ | 03XXXXXXXXX |
| Mother Name * | ✔ | |
| Mother CNIC * | ✔ | 13 digits |
| Applicant Photo | – | image upload |
| Mailing Address | ✔ | textarea |
| Blood Group | – | |
| Hafiz e Quran | – | Yes/No (affects merit marks +20) |
| Buttons | | **Save Personal Profile** (step2_submit) |

Submission captures CNIC formatted `21402-1010101-0` style for display.

---

## 4. MATRIC (SSC) PROFILE — `student_academic_profile_entry.php`

**Step banner**: "Matric Profile" — with two paths:
- **Fetch Data API** (button) → modal asking Board + Roll No → fetches from board record (we tested: "No Record Found" path exists) — **optional**
- **Manual entry** (the path we completed):

| Field | Required | Options / rules |
|---|---|---|
| Highest Exam Passed * | ✔ | SSC (matric) |
| Study Group * | ✔ | Science (Biology, Chemistry, Physics, Maths) / Arts / Science (Computer Sc, Chemistry, Physics, Maths) / General |
| Province * | ✔ | 8 provinces incl. Khyber Pakhtunkhwa |
| Exam Board/University * | ✔ | 32 boards (Agha Khan Board, BIE Karachi, BISE Abbottabad, BISE AJK Mirpur, BISE Bahawalpur, BISE Bannu, BISE D.G.Khan, BISE DI Khan, BISE Faisalabad, BISE Gujranwala, BISE Hyderabad, BISE Kohat, BISE Lahore, … **BISE Peshawar**, …) |
| Exam Session * | ✔ | Annual / Supplementary |
| Passing Year * | ✔ | 2026 → 1999 (28 options) |
| Roll Number * | ✔ | text |
| Marks Obtained * | ✔ | number |
| Total Marks * | ✔ | number (600 for SSC) |
| Grade | auto | computed from percentage: **A+ ≥ 80%** (test 480/600 = 80% → A+) |
| Hafiz e Quran | – | radio Yes/No — if Yes, +20 marks added to percentage calc |
| School Province * | ✔ | 8 provinces |
| School District * | ✔ | district list (Mohmand) |
| School/Institute Name * | ✔ | text (e.g. Govt High School Ghallanai) |
| Save button | | **Save Information** |

**Hafiz formula (verbatim from site JS)**: `percentage = ((obtained + 20) / total) * 100` when hafiz_quran == 1.

**Grade bands used by system**: allowed_grades = ["a", "a+", "a1"] for merit eligibility flags.

---

## 5. APPLICATION FORM — `student_submit_application.php`

### Instructions (verbatim)
- "For each different category (quota), faculty (program) or college, separate application must be submitted."
- "It is important to note that only one application can be submitted against the same category of admission of a same program with in a same college."
- "Fields with * are mandatory."
- "For colleges having morning and evening shifts, candidates with highest merit are offered admission in the Morning Shift. When seats in the Morning Shift are filled, admission in the Additional Shift is offered according to the sanctioned seats on merit."
- "For humanities group subject combinations of one shift may differ from the other shift"
- Urdu: ضلع → کالج → Level of Study → Program → Category کا انتخاب کریں (select district → college → level → program → category)

### Cascade (event-driven, each step resets downstream selects)
1. **District** * — 38 KPK districts; Mohmand = `142`
2. **College** * — filtered AJAX `get_colleged_by_district.php`; for Mohmand: `330` Govt. Degree College Lakarai (type 0), `333` **Govt. College of Management Sciences Ghallanai Mohmand** (type 1, gender male, cycle non_mariturious, shift 0)
3. **Level of Studies** * — AJAX per college; for 333: `1` **Intermediate/Diploma** (non_mariturious, shift 0)
4. **Program** * — AJAX `get_program_by_category.php` (filtered by applicant + gender + cycle); for 333 Inter: `743` **Diploma in Commerce** (allowed_gender both). College also runs "Computer Sciences" (Inter, 100 seats) and BS programs (out of scope).
5. **Category (Quota)** * — AJAX `quota_by_college_type.php`; for 333 Inter: `10` Open Merit, `11` Local Quota, `13` Sports, `14` College Employees, `15` Special Person
6. **Quota criteria / conditional fields** — see §5.2
7. **Subject Group** — only if program defines groups (D.Com: none)
8. **Declaration** * — checkbox "Yes, I agree." + text: "I declare that the information given in support of the application is accurate and complete. I understand that any misrepresentation will result in disqualification of my application for admission."
9. **[Submit Application]** button (hidden until all client checks pass)

### 5.1 All AJAX endpoints (request → response, verbatim captures)
| Endpoint | POST params | Response (for our case) |
|---|---|---|
| `get_colleged_by_district.php` | district_id | `<option>` list of colleges in district |
| `get_program_categories_by_college.php` | college_id | `<option>` levels (Intermediate/Diploma=1) |
| `get_college_uc.php` | college_id | JSON array of 65 UC ids `["2808"…"2872"]` |
| `get_college_gender.php` | program_category_id, college_id | `male` |
| `get_program_by_category.php` | program_category_id, applicant_id, college_id | `<option value='743' allowed_gender='both'>Diploma in Commerce` |
| `quota_by_college_type.php` | program_category_id, district_id, college_id, college_type, nationality | quota `<option>` list |
| `get_cycle_type.php` | college_id, program_category_id | `non_mariturious` |
| `get_age_against_cycle.php` | college_id, program_category_id, applicant_id | `{"y":18,"m":4,"d":20,…}` |
| `get_check_program_eligibility.php` | program_id, applicant_id, program_category_id, college_id | `''` = eligible; "Sorry…" = not |
| `get_subjectgroups_by_program_id.php` | program_id | `''` = no groups |
| `get_quota_subcats_by_quota_id.php` | quota_id, college_id | `nosubquota` |
| `get_cetificates.php` | program_category_id | sports certificate options |
| `get_jurisdictional_items.php` | college_id, item_type='uc' | named UC options |

### 5.2 Quota logic (verbatim behavior)
| Quota | Behavior |
|---|---|
| **Open Merit (10/2)** | If applicant's UC ∈ college UC list → **blocked**: swal **"Your domicile is local; therefore, apply on Local Quota."** + red error + quota select reset. (Verified live — this is why locals MUST use Local Quota.) |
| **Local Quota (11/7, commerce)** | Shows **"Criteria for Local Quota"** select (required): `domicile_of_area` "Having Domicile of the Local Area" (checks UC ∈ college UCs AND domicile district == college district; shows "(Baizai-1)" i.e. the applicant's UC) / `father_serve_area` "Parent / Spouse Posting as Govt. Servant in District" (requires Name of Department + Serving District + payslip attach notice checkbox) |
| **Sports (13/4/19/26/36/47)** | Sports participation certificate required (from `get_cetificates.php` list: School Level 10, College Level 10, District Level 20, Inter District 15, Inter Colleges Level 25, BISE Inter School 25, DHE Regional 25, Regional 25, Provincial 30, Inter-board 30, BISE Level 35, Other National 35…). Age check: Inter ≥19y → "You are overage and not eligible for the sports quota" |
| **College Employees (14/6/20/28/34)** | Parent department (required) + Parent serving district (required) + payslip attach notice (required checkbox) |
| **Special Person (15/5/…)** | Nature of Disability (required: Hearing / Learning / Mental Health / Movement / Vision / Thinking / Other) + disability certificate available checkbox |
| District quota (highest exam passed from college) | Institute district must match college district else "Your Highest exam passed is not from the college you are applying." |

### 5.3 Validation messages (verbatim, live-verified)
- Duplicate: **"Error! You have already applied for this program in this college, please select a different program."** (alert box, form not submitted)
- Local UC + Open Merit: **"Your domicile is local; therefore, apply on Local Quota."**
- Overage (Inter male ≥19y): "You are overage. An age relaxation certificate is required for Inter admission."
- Gender mismatch: "MALE applicants are not eligible for this program"
- Program eligibility fail: "Sorry! you are not eligibile for admission in this program"
- Missing matric profile: "Please Fill your Metric profile before applying to Intermediate Program."
- Local criteria domicile mismatch: "Not eligible for District Local Quota based on your domicile"
- Parent serving district ≠ college district: "Not eligible for District Local Quota based on your Parent/Spouse Service"
- UC not in college list (domicile_of_area): "Applicant Union Council Does not fall in College Union Councils."
- Sports no subcategories: "This College does not have any sports subcategories. Please register your complaint with the concerned college"
- Union councils missing: "Please Assign Union Council to College in order to process admission. please contact with concern college"

---

## 6. CONFIRM PAGE — `student_submit_application_confirm.php`

- Title **"Confirm Admission Request"** + "Almost there! You are about to confirm your application submission. Before you do, please review your application and make sure you have selected correct options. If you are sure that everything is correct, you can click **'Submit & Pay Application Processing Fee'** button to pay application processing fee (**Rs 100**). You can also click 'Go Back' to make any changes. Scroll to the end of this page for submission options."
- Review blocks: College (+district) · Admission Cycle (**"D.Com & F.Sc 3rd Cycle"**) · Study Level · Program · Subject Group · Application Quota (+criteria + UC) · **Shift: Morning** · Note **"Applications submitted on all quotas except AFGHAN shall be considered in Open Merit."** · Username (CNIC) · Date Applied · Personal Information (all fields) · Academic Information (Highest Exam, Session, Board, Year, Group, Roll No, Net Marks "480 / 600 (80%)", Grade A+, Sport Certificate, Hafiz e Quran, School/College Districts, Board Record: Not Verified, School/College, Remarks) · Declaration
- Buttons: **Go Back** (`student_submit_application.php?type=refresh`) · **Submit & Pay Application Processing Fee** (`student_submit_application_act.php?pp=<hash>`) · (Submit & Pay Later — commented out)
- `pp` token is one-time + session-bound (reopening later redirects to the form).

## 7. PAY PAGE — `student_pay_application_fee.php?application_id=…`

- **Applicant Details**: Name, S/O D/O, Address (+District, Tehsil), Mobile #
- **Payment Details**: Tracking ID · Processing Fee Rs. 100/- · Additional Charges Rs. 0/- · Total Rs. 100/-
- Buttons: **Proceed with Payment** (form POST `student_pay_application_fee_response.php`, hidden `application_id`) · **Cancel** (→ dashboard)

## 8. AFTER PROCEED — Application Form view `student_view_application.php`

- **Processing Fee Status: Pending**
- **Token: 261101020394613** — "This token must be paid at any **JAZZ CASH** or through **JAZZ CASH APP** on or before **November 05, 2026**" (deadline = submission + 4 days)
- Username (CNIC) · **Tracking ID: NOV2026394612** · Date Applied
- Full application details (as confirm page) · **Print Application** button
- Token format: 17 digits, date-prefixed (26=2026, 11=Nov, 01=day, then sequence)

## 9. DASHBOARD — All Applications (`student_dashboard.php`)

Table columns (exact): `# | Tracking ID | College | Program | Quota | Hafiz e Quran | Fee Submission Deadline | Action`
Example row: `1 | NOV2026394612 | Govt. College of Management Sciences Ghallanai Mohmand | Diploma in Commerce | Local Quota | No | 05-Nov-2026 11:59 PM Pending | Pay Application Fee`
- **Pay Application Fee** action → pay page. Plus "+ New Admission Request" button.

## 10. PUBLIC TRACK — `application_status.php`

- Single field **Application Tracking Id** + **Search** (GET `?application_id=`) — **no login, no CNIC required**
- Result — "Application Detail": table `# | Tracking Id | College | Program | Payment Status | Application Date`
  e.g. `1 | NOV2026394612 | Govt. College of Management Sciences Ghallanai Mohmand | Diploma in Commerce | Pending | 2026-11-01`
- Status timeline table: `# | Title | Date | Detials` (site's own typo "Detials")
- Unknown ID → no result (silent)

## 11. COLLEGE PROFILE (public) — `college.php?college_id=333`

- Name, **Faculties**, **Programs** table: `Program | Study Level | Program Seats`:
  - BS Commerce — BS 04 Years — 40
  - BS Computer Science — BS 04 Years — 40
  - **Computer Sciences — Intermediate/Diploma — 100**
  - **Diploma In Commerce — Intermediate/Diploma — 120**
- Merit lists per program+quota (Computer Sciences: Open Merit 1 applicant, Local Quota 8/3 applicants — published 15 Oct 2026) with "View Merit List" links
- Contact: 0924290310 / 03469841253 · principal.gcmsghallanai@gmail.com · Facebook "GCMS Ghallanai District Mohmand"
- District college list (Mohmand): Govt. Degree College Lakarai · GCMS Ghallanai

## 12. MOHMAND UNION COUNCILS (college 333 jurisdiction — 65 UCs, exact IDs)
2808 Khewezai · 2809 Baizai-2 · 2810 Baizai-1 · 2811 Khewezai-2 · 2812 Baizai-4 · 2813 Khewezai-1 · 2814 Baizai-3 · 2815 Utmankhel-9 · 2816 Dawezai-2 · 2817 Tarakzai-3 · 2818 Yaka Ghund · 2819 Utmankhel-2 · 2820 Issa Khel-1 · 2821 Laman Utman Khel-3 · 2822 Prang Ghar · 2823 Laman Utman Khel-1 · 2824 Laman Utman Khel-2 · 2825 Utmankhel-4 · 2826 Dawezai-1 · 2827 Issa Khel-4 · 2828 Burhan Khel-2 · 2829 Tamanzi-1 · 2830 Tarakzai-4 · 2831 Tarakzai-2 · 2832 Dawezai-3 · 2833 Burhan Khel-3 · 2834 Burhan Khel-1 · 2835 Tarakzai-5 · 2836 Utmankhel-5 · 2837 Issa Khel-3 · 2838 Utmankhel-1 · 2839 Utmankhel-3 · 2840 Tarakzai-1 · 2841 Tamanzi-2 · 2842 Utmankhel-7 · 2843 Utmankhel-6 · 2844 Burhan Khel-4 · 2845 Issa Khel-2 · 2846 Utmankhel-8 · 2847 Tarakzai-7 · 2848 Tarakzai-6 · 2849 Kamali Halimzai-1 · 2850 Masood-3 · 2851 Qandahari-3 · 2852 Lakarai · 2853 Kamali Halimzai-2 · 2854 Gurbaz · 2855 Qandahari-2 · 2856 Sagi-2 · 2857 Sagi-1 · **2858 Ghallanai** · 2859 Durba Khel-4 · 2860 Durba Khel-5 · 2861 Qandahari-1 · 2862 Sheikh Baba · 2863 Masood-2 · 2864 Masood-1 · 2865 Kuz Kadi-2 · 2866 Bara Kadi Khel-2 · 2867 Kuz Kadi Khel-1 · 2868 Durba Khel-2 · 2869 Durba Khel-1 · 2870 Durba Khel-3 · 2871 Bara Kadi Khel-1 · 2872 Chamarkand

## 13. FAQ (verbatim, faqs.php)
1. **What is Online College Admission System?** — "Online College Admission System is an initiative of Higher Education, Archives & Libraries Department Government of Khyber Pakhtunkhwa. The system facilitates the admission process to government colleges and provide up-to-date information to public."
2. **How can a student apply for admission online?** — "The application process is pretty simple. It involves the following steps: 1. Create your accoutn (if you are a new student) 2. Enter your CNIC/Form B Number, Email Address and Mobile Number and Password (Mobile No is Mandatory as all correspondence will be made through this number) 3. Compete your personal profile 4. Complete your academic profile 5. Submit your application online to any college and any program 6. Show your token No. and Deposite Rs=100 Per application in in concerned college. 7. View your name in merit list. 8. Visit concerned college alongwith all documents to complete your admission."
- User Guide / Admission Rules links return "File not found." (dead on the live site)
- Helpline (from site footer/help): admissionhedkp@gmail.com · 091-9214110

## 14. NUMBERS & FORMATS
- **Tracking ID**: `NOV2026394612` = MON + YYYY + application id (upper-case month abbrev, 4-digit year, raw id)
- **JazzCash Token**: 17 digits starting with date `26 11 01` (YY MM DD) + 8-digit sequence (e.g. `261101020394613`)
- **Processing fee**: Rs 100 per application (Additional Rs 0 → Total Rs 100)
- **Fee deadline**: submission date + 4 days, 11:59 PM
- **Date Applied display**: "November 01, 2026"; dashboard deadline "05-Nov-2026 11:59 PM"
- **Age math**: exact y/m/d diff from DOB (test: {"y":18,"m":4,"d":20})
- **Percentage**: obtained/total ×100, +20 marks if Hafiz e Quran; A+ = ≥80%

## 15. HED-BEHAVIOUR NOTES FOR THE REBUILD
1. One application per (college, program, quota-category) — duplicate blocked with the exact message.
2. Local-UC applicants are FORCED onto Local Quota (Open Merit resets with the exact message). Non-local UC applicants get "non_local_alert" and may use Open Merit.
3. Local Quota criteria "Having Domicile of the Local Area" requires: UC ∈ college UCs AND domicile district == college district → shows applicant's UC name in parentheses.
4. "Parent / Spouse Posting as Govt. Servant in District" requires department name + serving district (== college district else blocked) + payslip notice checkbox.
5. All quotas except AFGHAN are also considered in Open Merit (displayed note).
6. Highest-merit students get Morning shift (displayed "Shift: Morning").
7. Fee = Rs 100/application, payable via JazzCash token at any retailer or app, 4-day deadline; until paid, dashboard shows Pending + Pay Fee action; public track shows Payment Status.
8. Board record shows "Not Verified" when marks entered manually (no board fetch).
9. Registration mobile number is immutable and used for payment + SMS alerts.
10. Math captcha on both register and login (two hidden operands + result input).
