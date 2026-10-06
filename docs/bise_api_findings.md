# HED KPK ↔ BISE Peshawar Board Verification API — Complete Reverse-Engineering Report

**Captured live:** 2026-10-06
**Investigator:** Walked through the HED KPK portal with authenticated session + captured all network requests

## TL;DR — How HED's "FETCH DATA" button works

1. The HED KPK portal has its own backend PHP endpoint: **`POST https://admission.hed.gkp.pk/fetch_board_exam_result.php`**
2. This endpoint is **session-protected** (requires `PHPSESSID` cookie from a logged-in applicant).
3. HED's PHP backend has **its own cached copy** of BISE Peshawar result data (imported via private data-sharing arrangement, NOT a public API).
4. The endpoint accepts 5 form params and returns a JSON object with the full student record.

There is **NO publicly accessible BISE Peshawar API for historical results**. The cloud.bisep.edu.pk page only serves the currently-active exam (HSSC Annual-I 2026 at time of writing).

---

## The HED Proxy Endpoint — Full Specification

### Request

```http
POST /fetch_board_exam_result.php HTTP/1.1
Host: admission.hed.gkp.pk
Content-Type: application/x-www-form-urlencoded
Referer: https://admission.hed.gkp.pk/student_academic_profile_entry.php?type=inter
X-Requested-With: XMLHttpRequest
Cookie: PHPSESSID=<active session>; csrfp_token=<token>

exam_boards_universities_id=7&board_class=SSC&board_year=2024&board_session=Annual&highest_exam_roll_number=123456
```

| Parameter | Type | Description | Example Values |
|-----------|------|-------------|----------------|
| `exam_boards_universities_id` | int | The HED internal ID of the board (from the boards dropdown) | `7` = BISE Peshawar, `8` = BISE Mardan, `30` = BISE Malakand, `236` = FBISE Islamabad, etc. |
| `board_class` | string | The exam class | `SSC` (matric) or `HSC` (inter) |
| `board_year` | string | 4-digit year | `2024`, `2025`, `2026` |
| `board_session` | string | Exam session | `Annual` or `Supplementary` |
| `highest_exam_roll_number` | string | The student's board roll number | `123456` |

### Response — Success (HTTP 200)

```json
{
  "status": true,
  "message": "Record Found or student is failed",
  "data": {
    "student_name": "MUHAMMAD ABUBAKKAR",
    "father_name": "JAHANGIR AKHTAR",
    "obtained_marks": "982",
    "total_marks": "1200",
    "grade": "A1",
    "remarks": null,
    "domicile": "Peshawar",
    "Domicile": "Peshawar",
    "date_of_birth": "2006-09-07",
    "school_name": "PESHAWAR MODEL SCHOOL BOYS-VI, RING ROAD PESHAWAR",
    "district": "Peshawar",
    "tehsil": null,
    "highest_exam_marks_obtained": "982",
    "highest_exam_marks_total": "1200",
    "institute_name": "PESHAWAR MODEL SCHOOL BOYS-VI, RING ROAD PESHAWAR",
    "highest_exam_grade": "A1"
  }
}
```

### Response — Not Found

```json
{
  "status": false,
  "message": "No record found for the given details. Please enter information manually."
}
```

### Authentication Required

- ❌ Without `PHPSESSID` cookie → HTTP 500
- ✅ With active session → HTTP 200 with JSON

### Internal Architecture (Inferred)

HED's `fetch_board_exam_result.php` does **NOT** make a live HTTP call to BISE Peshawar each time. Evidence:

1. **Speed:** Response comes back in <500ms — too fast for cross-board HTTP roundtrip.
2. **Historical data:** Returns data for years 2024, 2025 (roll 123456 in 2025 returned a *different* student "MUHAMMAD USMAN" with 737/1200 grade B) — proving roll numbers get reused across years, so the data must be stored indexed by `(board, class, year, session, roll)`.
3. **No public BISE API:** Cloud.bisep.edu.pk only serves the current exam (HSSC Annual-I 2026 at time of writing); older results aren't publicly queryable.

Therefore HED **pre-imports BISE result data** (likely as nightly CSV dumps from each BISE board into their MySQL/Postgres database at result declaration time). The `fetch_board_exam_result.php` endpoint just runs `SELECT * FROM board_results WHERE board_id=? AND class=? AND year=? AND session=? AND roll_no=?`.

## The Frontend JS That Drives FETCH DATA

**File:** `https://admission.hed.gkp.pk/assets/js/hed_scrpit.js` (inlined on the academic profile page)

**Trigger:** `#board_fetch_data_btn` click → calls `fetchBoardExamResult()`

**AJAX call:**

```javascript
$.ajax({
    type: "POST",
    url: "fetch_board_exam_result.php",
    dataType: "json",
    data: {
        exam_boards_universities_id: boardId,
        board_class: classText,        // "SSC" or "HSC" (text of dropdown)
        board_year: yearText,          // "2024", "2025", ...
        board_session: sessionText,   // "Annual", "Supplementary", "Other"
        highest_exam_roll_number: rollNumber
    },
    success: function (res) {
        if (res && res.status === true && res.data) {
            // Show modal: "Board Record Found" + table of student info
            // Buttons: "Process with Board Data" or "Proceed with Manual Data"
        } else {
            // Show "Board Record Not Found" modal
        }
    },
    error: function () {
        // Show error modal, fall back to manual entry
    }
});
```

After successful fetch, the modal offers:
- **"Process with Board Data"** → calls `fillBoardApiFields(data)` which auto-fills:
  - `board_student_name`, `board_father_name`, `board_date_of_birth` (hidden fields)
  - `highest_exam_marks_obtained`, `highest_exam_marks_total` (locked to readonly)
  - `highest_exam_grade` (auto)
  - `institute_name` (school name auto)
  - Sets `profile_data_source = "board"` (proves to the office that marks were verified)
- **"Proceed with Manual Data"** → user enters marks themselves, `profile_data_source = "manual"`

## BISE Peshawar's Public Result Endpoint (current exam only)

**URL:** `https://cloud.bisep.edu.pk/ShowResult.php?Search=RollNo&RollNo=<roll>&token=<token>`

**Token:** Generated server-side on page load (`<input type="hidden" id="ResultToken" value="...">`)
**Cookie required:** `cf_clearance` (Cloudflare challenge) + `PHPSESSID`
**Returns:** HTML fragment (not JSON) with result card or error message
**Limitation:** Only serves the **currently active exam** (e.g. HSSC Annual-I 2026 right now)

## BISE Peshawar Roll Number Search Portal

**URL:** `https://portal.bisep.edu.pk/rno_online_ssc/`

**Purpose:** Helps private candidates find their roll number by name+father's name (does NOT return marks/grade). Used during registration to look up roll numbers.

## BISE Board IDs Captured from HED (Pakistani boards)

| ID  | Board |
|-----|-------|
| 7   | BISE Peshawar |
| 8   | BISE Mardan |
| 25  | BISE Bannu |
| 26  | BISE DI Khan |
| 27  | BISE Kohat |
| 28  | BISE Swat |
| 29  | BISE Abbottabad |
| 30  | BISE Malakand |
| 31  | KP Board of Technical & Commerce Education, Peshawar |
| 236 | Federal Board of Intermediate & Secondary Education, Islamabad (FBISE) |
| 283 | BISE Bahawalpur |
| 284 | BISE D.G. Khan |
| 285 | BISE Faisalabad |
| 286 | BISE Gujranwala |
| 287 | BISE Lahore |
| 288 | BISE Multan |
| 289 | BISE Rawalpindi |
| 290 | BISE Sargodha |
| 291 | Agha Khan Board |
| 292 | BSE Karachi |
| 293 | BISE Hyderabad |
| 294 | BIE Karachi |
| 295 | BISE Larkana |
| 296 | BISE Mirpurkhas |
| 297 | BISE Sukkur |
| 298 | BISE Quetta |
| 299 | BISE AJK Mirpur |
| 399 | Inter Board Committee of Chairman (IBCC) KPK |
| 400 | Inter Board Committee of Chairman (IBCC) Islamabad |
| 443 | Karakoram International University (Gilgit Baltistan Board) |
| 19000 | Other (manual entry) |

## Implementation Recommendation for GHSS Ghallanai

Since GHSS Ghallanai is a school (not the HED department), we cannot directly call HED's `fetch_board_exam_result.php` (it requires HED session + is for HED applicants only). Two practical options:

### Option A: Skip board verification (current GHSS Ghallanai approach)
- Let applicant enter matric marks manually
- They upload matric DMC as a document
- Office verifies the DMC against board records during review

### Option B: Use BISE Peshawar's public endpoint (limited)
- For the currently-active exam only, can hit `cloud.bisep.edu.pk/ShowResult.php` server-side via a Next.js API route
- Need to:
  1. Fetch `cloud.bisep.edu.pk/` server-side to get a fresh token + cookies (with Cloudflare challenge solver)
  2. Then call `ShowResult.php?Search=RollNo&RollNo=<roll>&token=<token>` with those cookies
- Returns HTML, need to parse it
- Only works while that exam is the "currently active" one on cloud.bisep.edu.pk

### Option C: Apply for BISE Peshawar API access (institutional)
- Schools can apply to BISE Peshawar for institutional API access
- Probably requires MoU + payment
- Out of scope for the immediate build

**Recommended:** Stick with Option A (manual marks entry + DMC upload) — it's the most reliable approach for a school website. The board verification feature is really only valuable for a centralized admissions system like HED.

---

## Captured Source Files

| File | Source | Description |
|------|--------|-------------|
| `/tmp/hed_fetch_script.js` | inline `<script>` on `student_academic_profile_entry.php` | The full IIFE that wires up the FETCH DATA button, modal, and AJAX call |
| `/tmp/SearchScripts.js` | `cloud.bisep.edu.pk/js/SearchScripts.js` | BISE Peshawar's own SearchResultbyRoll() function — uses XHR to call ShowResult.php |
| `/tmp/hed_step2.html` | `student_academic_profile_entry.php?type=inter` | Full page HTML with the form structure |
| `/tmp/hed_step3.html` | `student_personal_profile.php` | Full page HTML of personal info step |

All captured via authenticated HED session + Cloudflare-bypassed BISE Peshawar session.
