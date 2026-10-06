-- ============================================================================
-- GHSS GHALANAI — SEED DATA
-- Safe to run repeatedly (idempotent via on conflict do nothing).
-- Replace SAMPLE values with official records through the admin dashboard.
-- ============================================================================

-- Settings: admission window status
insert into public.settings (key, value) values
  ('admission_status', '{"open": true, "label": "Admissions open for the 2026-27 session", "deadline": "2026-11-15"}'::jsonb)
on conflict (key) do nothing;

-- Notices (mirrors src/content/news.ts so the site is identical in demo/live)
insert into public.notices (id, title, body, category, date, pinned, published) values
  ('n1', 'Admissions open for the 2026-27 session',
   'Applications are invited for first-year admission in ICS, Pre-Medical, Pre-Engineering and Arts. Apply online through this website or collect the form from the school office. Last date: 15 November 2026. Merit list will be published on this website.',
   'admission', '2026-10-01', true, true),
  ('n2', 'First send-up examination schedule announced',
   'The send-up examination for second-year students begins on 20 October 2026. Date sheets are available from the exam branch and on the notice board. Students must carry their roll number slips.',
   'exam', '2026-09-25', false, true),
  ('n3', 'BISE registration for first-year students',
   'All first-year students must complete board registration formalities at the exam branch before 30 October 2026. Bring B-form, matric result card and two photographs.',
   'exam', '2026-09-20', false, true),
  ('n4', 'Merit-based fee concession applications',
   'Students who scored 80% or above in matric may apply for the merit fee concession at the office. Deserving families may apply for the need-based concession with the office form.',
   'scholarship', '2026-09-15', false, true),
  ('n5', 'Monthly test calendar for October',
   'Monthly tests for all classes run from 6-9 October 2026. Test syllabus has been distributed by subject teachers.',
   'general', '2026-09-28', false, true),
  ('n6', 'Result day — second year annual result',
   'The second-year annual result will be published on this website on result day. Students and parents can check results by roll number on the Results page.',
   'result', '2026-09-01', false, true)
on conflict do nothing;

-- News posts
insert into public.news_posts (id, slug, title, excerpt, body, category, date, reading_minutes, published) values
  ('w1', 'toppers-2026-board-results', 'Our students secure 17 board positions in the annual result',
   'The 2026 intermediate annual examinations brought the school its strongest board showing yet, led by a first-year Pre-Medical student from Ghallanai bazaar.',
   'The 2026 intermediate annual examinations brought the school its strongest board showing yet. Seventeen of our students earned positions in the board''s merit rankings, led by a first-year Pre-Medical student from Ghallanai bazaar who secured the second position overall in the district. The faculty attributes the result to the monthly test system and the supervised practical sessions introduced across the science streams. The toppers were honoured at the morning assembly, and the full honour wall is published on the Results page of this website. The exam branch has verified every name and figure on this list before publication.',
   'Achievement', '2026-09-12', 3, true),
  ('w2', 'choosing-your-stream-after-matric', 'After matric: choosing the right stream for the right career',
   'A subject-teacher-written guide to matching your matric strengths to ICS, Pre-Medical, Pre-Engineering or Arts — with the careers each stream feeds.',
   'Every October, families across Mohmand face the same question: which intermediate stream should our child join? The honest answer is that the stream should follow the career, not the neighbour''s advice. Pre-Medical exists for the healing professions and requires matric biology; Pre-Engineering builds toward the ECAT and every engineering discipline and requires strong mathematics; ICS is the direct bridge into computer-science degrees and the software profession; and the Humanities stream — often wrongly called the easy option — is the road to law, the civil service and the media, and its subjects align directly with the CSS examination. Our counselling desk at the admission office walks every family through this decision with the student''s matric result in hand. The full guidance guide, written with the subject teachers of each stream, is available at the admissions desk and on each programme page of this website.',
   'Guidance', '2026-09-05', 5, true),
  ('w3', 'computer-lab-upgrade', 'Computer laboratory receives refreshed machines for ICS practicals',
   'The ICS practical sessions now run one machine per student, with C++ and Python toolchains installed and maintained through the academic year.',
   'The computer laboratory used by ICS students has been refreshed for the new session, ensuring one working machine per student in practical periods. The laboratory runs the C++ toolchain required by the board syllabus alongside Python installations used for the programming circle, and the department maintains the machines through a student-led hardware team — itself a learning exercise. The upgrade keeps the ICS practical stream on schedule and supports the programming practice that distinguishes our computer-science graduates at university.',
   'Institution', '2026-08-20', 2, true),
  ('w4', 'monthly-test-system-results', 'Monthly test system showing measurable gains across all streams',
   'Two sessions into the reformed monthly-test calendar, average internal scores are up and board send-up results have strengthened across all four programmes.',
   'Two sessions into the reformed monthly-test calendar, the school is seeing measurable gains. Average internal scores across all four programmes have risen against the same terms last year, and the send-up results in science subjects have strengthened in parallel. The system is deliberately simple: every month ends with syllabus-matched tests, every test returns with teacher remarks, and every term triggers a counselling conversation for any student trending downward. Parents can follow the pattern through the student portal once it opens for the session, and the office publishes term summaries on request.',
   'Academic', '2026-08-02', 3, true)
on conflict (slug) do nothing;

-- Faculty directory
insert into public.faculty (id, name, designation, qualification, subjects, department, years) values
  ('f01', 'Muhammad Yousaf Khan', 'Senior Teacher (Physics)', 'M.Sc Physics, B.Ed', '{Physics}', 'Science', 18),
  ('f02', 'Rehmat Ali', 'Senior Teacher (Mathematics)', 'M.Sc Mathematics, B.Ed', '{Mathematics}', 'Science', 15),
  ('f03', 'Dr. Nasir Mahmood', 'Teacher (Chemistry)', 'M.Phil Chemistry', '{Chemistry}', 'Science', 9),
  ('f04', 'Sardar Ahmad', 'Teacher (Biology)', 'M.Sc Zoology, B.Ed', '{Biology}', 'Science', 12),
  ('f05', 'Taj Muhammad', 'Senior Teacher (Computer Science)', 'M.Sc Computer Science', '{Computer Science}', 'Computing', 8),
  ('f06', 'Ihsanullah Khan', 'Teacher (English)', 'M.A English, B.Ed', '{English}', 'Humanities', 11),
  ('f07', 'Abdul Wahab', 'Teacher (Urdu)', 'M.A Urdu, B.Ed', '{Urdu}', 'Humanities', 14),
  ('f08', 'Fazal Rahman', 'Teacher (Islamiyat / Pak Studies)', 'M.A Islamic Studies, B.Ed', '{Islamiyat,Pak Studies}', 'Humanities', 10),
  ('f09', 'Hazrat Bilal', 'Teacher (Civics / History)', 'M.A Political Science', '{Civics,History}', 'Humanities', 7),
  ('f10', 'Zar Bibi', 'Teacher (Economics)', 'M.A Economics, B.Ed', '{Economics}', 'Humanities', 6),
  ('f11', 'Gul Zaman', 'Teacher (Statistics)', 'M.Sc Statistics', '{Statistics,Mathematics}', 'Science', 5),
  ('f12', 'Saifur Rehman', 'Teacher (Pashto / Education)', 'M.A Pashto', '{Pashto,Education}', 'Humanities', 13)
on conflict (id) do nothing;

-- FAQs
insert into public.faqs (question, answer, sort) values
  ('When do admissions open and close?', 'For the 2026-27 session, applications open on 1 October 2026 and close on 15 November 2026. Dates for each stage — test, interview, merit list and enrolment — are published on the admissions page.', 1),
  ('Which programmes does the school offer?', 'Four intermediate streams: ICS (Computer Science), F.Sc Pre-Medical, F.Sc Pre-Engineering, and FA Humanities (Arts). Each has its own page under Academics with subjects, eligibility and careers.', 2),
  ('How do I apply — online or on paper?', 'Both. The online application on this website is the fastest route and issues an application number you can track. Paper forms are available at the school office during office hours for families who prefer them.', 3),
  ('What documents are required with the application?', 'Two passport photographs, photocopy of the B-form (or CNIC), matric result card or detail mark certificate, domicile, and any concession or scholarship proof you want considered.', 4),
  ('What are the minimum marks for each stream?', 'Pre-Medical and Pre-Engineering need matric science (with biology / mathematics respectively) and around 60% marks to be comfortable; ICS needs matric mathematics and roughly 50%; Arts needs a matric pass in any group. See the eligibility page for the full table.', 5),
  ('Is there an admission test?', 'Only when a programme is over-subscribed. The test covers matric-level mathematics or relevant science, and the date is published in the admission dates table.', 6),
  ('How is the merit list prepared?', 'From the matric percentage (plus test score where a test was held), ranked against the seat quota of each programme. The list is published on this website and on the school notice board, dated and versioned.', 7),
  ('What does it cost to study here?', 'As a government institution there is no monthly tuition fee. The admission fee is Rs 500, with laboratory and sports funds as detailed on the fee structure page. Board registration and examination fees are charged exactly as the board notifies them.', 8),
  ('Are scholarships or concessions available?', 'Yes — a merit concession for 80%+ matric scorers, need-based concessions for deserving families, and facilitation for government scholarship schemes. Details are on the fee structure page.', 9),
  ('Can a student change stream after admission?', 'Stream change is possible within the first month of the session with the principal''s approval, subject to eligibility for the new stream and seat availability.', 10),
  ('When do classes start?', 'First-year classes begin in the enrolment week at the start of December; the exact date is published in the admission dates table and notified through WhatsApp.', 11),
  ('How can I check my result?', 'Open the Results page of this website, enter your roll number, choose the year and programme, and the subject-wise result card appears — printable and shareable. Result day also brings a notice on this website.', 12),
  ('Where do I complain or give feedback?', 'The contact page has a feedback form that reaches the principal''s office directly, or message the school''s WhatsApp number. Every submission is acknowledged and tracked.', 13),
  ('Does the school have laboratories?', 'Yes — physics, chemistry and biology laboratories for the science practicals, and a computer laboratory for ICS practicals with one machine per student in practical periods.', 14),
  ('Is there a library?', 'Yes, a reference and lending library holding course texts, past papers and Urdu and English titles. Library periods are on the weekly timetable.', 15),
  ('What are the school timings?', 'The school day runs 8:00 AM to 2:00 PM, Monday to Saturday, with the assembly at 8:00 sharp. Office hours for visitors are the same.', 16),
  ('Is Urdu content available on this website?', 'Yes. Key pages — home, admissions, fees, results and contact — are available in Urdu with proper Nastaliq typography at /ur on this website.', 17),
  ('Can I install this website as an app?', 'Yes. Open the site in Chrome on Android and tap the install prompt (or browser menu → Install app). The app works offline for pages you have already visited and notifies you when new notices are published.', 18),
  ('How do parents receive announcements?', 'Through the school''s WhatsApp broadcast list, notices on this website, and the notice board. Opt in to WhatsApp alerts by sending your name and student''s class to the school number.', 19),
  ('Can I submit documents after the deadline if I apply on time?', 'The core documents must accompany the application. In genuine cases the office accepts a delayed matric result card — contact the office through WhatsApp before the deadline.', 20)
on conflict do nothing;

-- Board results (SAMPLE — arrives via the supervised import pipeline in production)
insert into public.board_results (roll_no, year, programme, student_name, father_name, subjects_json, total, obtained, percentage, grade, position, published) values
  ('GH-12-101', 2026, 'pre-medical', 'SAMPLE Student A', 'SAMPLE Father A',
   '[{"subject":"English","total":100,"obtained":78,"grade":"A"},{"subject":"Urdu","total":100,"obtained":82,"grade":"A+"},{"subject":"Biology","total":100,"obtained":88,"grade":"A+","practical":true},{"subject":"Chemistry","total":100,"obtained":84,"grade":"A+","practical":true},{"subject":"Physics","total":100,"obtained":79,"grade":"A","practical":true},{"subject":"Pak Studies","total":50,"obtained":45,"grade":"A"}]'::jsonb,
   550, 456, 82.9, 'A+', '1st in school (SAMPLE)', true),
  ('GH-12-102', 2026, 'pre-engineering', 'SAMPLE Student B', 'SAMPLE Father B',
   '[{"subject":"English","total":100,"obtained":74,"grade":"A"},{"subject":"Urdu","total":100,"obtained":80,"grade":"A+"},{"subject":"Mathematics","total":100,"obtained":90,"grade":"A+"},{"subject":"Physics","total":100,"obtained":81,"grade":"A+","practical":true},{"subject":"Chemistry","total":100,"obtained":77,"grade":"A","practical":true},{"subject":"Pak Studies","total":50,"obtained":44,"grade":"A"}]'::jsonb,
   550, 446, 81.1, 'A+', null, true),
  ('GH-11-201', 2026, 'ics', 'SAMPLE Student C', 'SAMPLE Father C',
   '[{"subject":"English","total":100,"obtained":71,"grade":"A"},{"subject":"Urdu","total":100,"obtained":76,"grade":"A"},{"subject":"Computer Science","total":100,"obtained":87,"grade":"A+","practical":true},{"subject":"Mathematics","total":100,"obtained":83,"grade":"A+"},{"subject":"Physics","total":100,"obtained":72,"grade":"A","practical":true},{"subject":"Islamiyat","total":50,"obtained":42,"grade":"A"}]'::jsonb,
   550, 431, 78.4, 'A', null, true),
  ('GH-11-202', 2026, 'arts', 'SAMPLE Student D', 'SAMPLE Father D',
   '[{"subject":"English","total":100,"obtained":69,"grade":"A"},{"subject":"Urdu","total":100,"obtained":79,"grade":"A+"},{"subject":"Civics","total":100,"obtained":82,"grade":"A+"},{"subject":"Economics","total":100,"obtained":75,"grade":"A"},{"subject":"History","total":100,"obtained":73,"grade":"A"},{"subject":"Islamiyat","total":50,"obtained":41,"grade":"A"}]'::jsonb,
   550, 419, 76.2, 'A', null, true),
  ('GH-12-103', 2025, 'pre-medical', 'SAMPLE Student E', 'SAMPLE Father E',
   '[{"subject":"English","total":100,"obtained":75,"grade":"A"},{"subject":"Urdu","total":100,"obtained":81,"grade":"A+"},{"subject":"Biology","total":100,"obtained":85,"grade":"A+","practical":true},{"subject":"Chemistry","total":100,"obtained":80,"grade":"A+","practical":true},{"subject":"Physics","total":100,"obtained":76,"grade":"A","practical":true},{"subject":"Pak Studies","total":50,"obtained":43,"grade":"A"}]'::jsonb,
   550, 440, 80.0, 'A+', null, true)
on conflict (roll_no, year, programme) do nothing;

-- Merit list (SAMPLE)
insert into public.merit_lists (session_year, programme, merit_no, application_no, name, matric_percent, test_score, status, version, published) values
  ('2026-27', 'pre-medical', 1, 'GHSS-2026-0412', 'SAMPLE Applicant 1', '89.1%', null, 'Admitted', 'v1.0', true),
  ('2026-27', 'pre-engineering', 2, 'GHSS-2026-0287', 'SAMPLE Applicant 2', '88.4%', null, 'Admitted', 'v1.0', true),
  ('2026-27', 'ics', 3, 'GHSS-2026-0119', 'SAMPLE Applicant 3', '87.6%', null, 'Admitted', 'v1.0', true),
  ('2026-27', 'pre-medical', 4, 'GHSS-2026-0533', 'SAMPLE Applicant 4', '86.9%', null, 'Admitted', 'v1.0', true),
  ('2026-27', 'arts', 5, 'GHSS-2026-0201', 'SAMPLE Applicant 5', '85.5%', null, 'Admitted', 'v1.0', true),
  ('2026-27', 'pre-engineering', 6, 'GHSS-2026-0345', 'SAMPLE Applicant 6', '84.2%', null, 'Admitted', 'v1.0', true),
  ('2026-27', 'ics', 7, 'GHSS-2026-0098', 'SAMPLE Applicant 7', '83.7%', null, 'Admitted', 'v1.0', true),
  ('2026-27', 'pre-medical', 8, 'GHSS-2026-0466', 'SAMPLE Applicant 8', '82.0%', null, 'Admitted', 'v1.0', true),
  ('2026-27', 'arts', 9, 'GHSS-2026-0154', 'SAMPLE Applicant 9', '81.4%', null, 'Waitlisted', 'v1.0', true),
  ('2026-27', 'pre-engineering', 10, 'GHSS-2026-0301', 'SAMPLE Applicant 10', '80.2%', null, 'Waitlisted', 'v1.0', true)
on conflict do nothing;
