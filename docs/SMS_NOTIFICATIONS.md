Implement automatic SMS notifications to parents when attendance is taken and successfully saved on the Teacher Attendance page:

Page:
http://localhost:8080/teacher/attendance

Requirements:

1. After a teacher marks attendance and clicks "Save Attendance", the system should automatically send an SMS notification to the student's linked parent/guardian registered phone number.

2. SMS should be sent only after the attendance record has been successfully saved in the database.

3. The SMS message must include:

   * School Name
   * Student Name
   * Attendance Date
   * Attendance Status (Present, Absent, Late, Excused, etc.)

4. Example SMS Messages:

   Present:
   "EduManage School: John Mensah was marked PRESENT on 17-Jun-2026."

   Absent:
   "EduManage School: John Mensah was marked ABSENT on 17-Jun-2026. Please contact the school if necessary."

   Late:
   "EduManage School: John Mensah was marked LATE on 17-Jun-2026."

5. System Logic:

   * Retrieve the student's linked parent/guardian contact number.
   * Validate that the phone number exists before sending SMS.
   * Prevent duplicate SMS notifications for the same student, date, and attendance session.
   * Log all SMS notifications in an attendance_sms_logs table for auditing and tracking.

6. Error Handling:

   * Attendance must still be saved even if SMS delivery fails.
   * Failed SMS attempts should be logged with the error message.
   * Display a warning notification to the teacher if attendance is saved but SMS sending fails.

7. Performance:

   * Send SMS notifications asynchronously using a queue/background job.
   * Prevent delays when saving attendance records.

8. Admin Settings:

   * Add a setting to enable or disable attendance SMS notifications.
   * Allow schools to customize the SMS template.
   * Track SMS costs and usage statistics.

9. Security:

   * Only authorized teachers can trigger attendance notifications.
   * Ensure parents receive notifications only for students linked to their accounts.

Expected Result:
Whenever attendance is recorded and saved from the Teacher Attendance page, the student's parent automatically receives an SMS containing the school name, student name, attendance date, and attendance status.