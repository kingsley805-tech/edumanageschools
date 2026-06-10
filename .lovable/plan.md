
## Class Teacher — Full Build

Existing pieces we already have and will reuse:
- `classes.class_teacher_id` column (already added)
- `academic_recommendations` table (already added)
- `class_registers`, `register_student_entries`, `attendance_records`, `attendance_summaries`
- `term_report_cards` review/approval flow
- `notifications`, `audit_logs`, `register_audit_logs`

### 1. Database
- New helper `is_class_teacher_of(user_id, class_id)` (SECURITY DEFINER) — used by RLS and UI.
- New RPC `assign_class_teacher(class_id, teacher_id | null)` — admin-only; logs to `audit_logs`; allows removal by passing null; allows a teacher to lead multiple classes.
- New RPC `create_academic_recommendation(student_id, type, suggestions, strengths, weaknesses, threshold_alert)` — class teacher (or admin) only; inserts row and fans out in-app notifications to all linked parents/guardians + the student; writes audit log.
- New RPC `class_teacher_student_overview(class_id)` — returns per-student attendance %, latest grades, position, trend flags (poor attendance < 75%, declining avg, repeated fails).
- RLS additions on `term_report_cards`, `attendance_records`, `students`, `grades` to allow `is_class_teacher_of(auth.uid(), class_id)` SELECT (in addition to existing teacher/admin rules).
- View `v_class_teacher_alerts` (security_invoker) listing flagged students for the caller's assigned classes.

### 2. Admin UI
- On the existing Classes admin page: add an "Assign Class Teacher" dropdown per row that calls `assign_class_teacher`. Shows current assignee + remove button.
- New admin page **Class Teacher Activity** (`/admin/class-teacher-activity`) — table of recommendations, report-card submissions, attendance changes filtered from `audit_logs` + `register_audit_logs`.

### 3. Teacher UI (Class Teacher only)
- New nav item **My Class** (visible when teacher leads ≥1 class).
- New page `/teacher/my-class` with tabs:
  - **Overview** — class roster, today's attendance status, attendance % per student, alert badges.
  - **Attendance** — link into existing register editor for the class, plus historical chart.
  - **Report Cards** — list of class report cards with submit-for-approval button (uses existing RPC) and view-only after approval.
  - **Performance** — per-student strengths/weaknesses computed from grades; click a row to open recommendation drawer.
  - **Recommendations** — list previously sent recommendations + status; "New recommendation" button.

### 4. Parent UI
- New page `/parent/recommendations` — recommendations for all linked children, marked read/unread, with severity badges.
- Reuse existing in-app notification bell — recommendations and threshold alerts arrive there too.

### 5. Notifications & audit
- In-app only (per your choice). Inserted into `notifications` by the RPC.
- Every assign/unassign, recommendation, and report-card review writes an `audit_logs` row tagged `module='class_teacher'`.

### Out of scope for this build
- SMS / Email / WhatsApp channels for recommendations (in-app only as requested).
- Direct messaging chat between teacher and parent (existing Messages page already covers it).

### Technical notes
- All cross-table reads from the class-teacher dashboard go through a single RPC to avoid N+1 round trips and to centralize the permission check.
- Position generation uses existing report-card position function; no change to grading logic.
- Threshold defaults: attendance < 75%, term average < 50%, or two consecutive declining terms — configurable later via `school_settings` JSON.
