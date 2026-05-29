import { useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SchoolThemeProvider } from "./contexts/SchoolThemeContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Loader from "./pages/loader";
import Auth from "./pages/Auth";
import Contact from "./pages/Contact";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import AdminDashboard from "./pages/AdminDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import ParentDashboard from "./pages/ParentDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import Students from "./pages/admin/Students";
import Settings from "./pages/Settings";
import Teachers from "./pages/admin/Teachers";
import Classes from "./pages/admin/Classes";
import AdminAttendance from "./pages/admin/Attendance";
import AdminTimetable from "./pages/admin/Timetable";
import Reports from "@/report/pages/admin/AnalyticsReports";
import AdminReportCardsIndex from "@/report/pages/admin/ReportCardsIndex";
import AdminReportCardsView from "@/report/pages/admin/ReportCardsView";
import AdminReportCardsArchive from "@/report/pages/admin/ReportCardsArchive";
import AdminReportCardsVersions from "@/report/pages/admin/ReportCardsVersions";
import ReportSettings from "@/report/pages/admin/ReportSettings";
import TeacherReportCardsIndex from "@/report/pages/teacher/ReportCardsIndex";
import TeacherReportCardsView from "@/report/pages/teacher/ReportCardsView";
import TeacherReportCardsHistory from "@/report/pages/teacher/ReportCardsHistory";
import TeacherSignatures from "@/report/pages/teacher/Signatures";
import TeacherScores from "@/report/pages/teacher/Scores";
import ParentReports from "@/report/pages/parent/Reports";
import StudentReportCard from "@/report/pages/student/ReportCard";
import StudentPerformance from "@/report/pages/student/Performance";
import SuperAdminReports from "@/report/pages/super-admin/Reports";
import AdminAnnouncements from "./pages/admin/Announcements";
import ParentBillingPayments from "./pages/parent/BillingPayments";
import Children from "./pages/parent/Children";
import ParentAttendance from "./pages/parent/Attendance";
import ParentGrades from "./pages/parent/Grades";
import ParentStudentLink from "./pages/admin/ParentStudentLink";
import TeacherClassLink from "./pages/admin/TeacherClassLink";
import Subjects from "./pages/admin/Subjects";
import TeacherAttendance from "./pages/teacher/Attendance";
import TeacherAssignments from "./pages/teacher/Assignments";
import Gradebook from "./pages/teacher/Gradebook";
import TeacherGrades from "./pages/teacher/Grades";
import TeacherClasses from "./pages/teacher/Classes";
import ClassDetails from "./pages/teacher/ClassDetails";
import StudentAssignments from "./pages/student/Assignments";
import StudentGrades from "./pages/student/Grades";
import TeacherExams from "./pages/teacher/Exams";
import TeacherResources from "./pages/teacher/Resources";
import TeacherLessonNotes from "@/lesson-notes/pages/teacher/TeacherLessonNotes";
import TeacherLessonNoteEditor from "@/lesson-notes/pages/teacher/TeacherLessonNoteEditor";
import AdminLessonNotes from "@/lesson-notes/pages/admin/AdminLessonNotes";
import AdminLessonNoteReview from "@/lesson-notes/pages/admin/AdminLessonNoteReview";
import StudentResources from "./pages/student/Resources";
import Messages from "./pages/Messages";
import StudentTimetable from "./pages/student/Timetable";
import TeacherTimetable from "./pages/teacher/Timetable";
import NotFound from "./pages/NotFound";

import GradeScales from "./pages/admin/GradeScales";
import QuestionBank from "./pages/teacher/QuestionBank";
import TeacherOnlineExams from "./pages/teacher/OnlineExams";
import StudentOnlineExams from "./pages/student/OnlineExams";
import StudentBilling from "./pages/student/Billing";
import StudentPaymentHistory from "./pages/student/PaymentHistory";
import ParentPaymentHistory from "./pages/parent/PaymentHistory";
import SuperAdminManagement from "./pages/admin/SuperAdminManagement";
import SchoolSettings from "./pages/admin/SchoolSettings";
import PendingUsers from "./pages/admin/PendingUsers";
import NumberGenerator from "./pages/admin/NumberGenerator";
import ParentContacts from "./pages/admin/ParentContacts";
import RoleManagement from "./pages/admin/RoleManagement";
import AccountantDashboard from "./pages/admin/AccountantDashboard";
import AuditorDashboard from "./pages/admin/AuditorDashboard";
import AuditLogs from "./pages/admin/AuditLogs";
import ApprovalRequests from "./pages/admin/ApprovalRequests";
import { PERMISSIONS } from "./lib/permissions";
import {
  BillingDashboardPage,
  BillingPayrollPage,
  BillingPayrollHistoryPage,
  BillingSettingsPage,
  BillingPaymentGatewayPage,
  BillingReportsPage,
  BillingInvoicesPage,
  BillingPaymentsPage,
  BillingFeesPage,
  BillingPaidStudentsPage,
  BillingOutstandingStudentsPage,
  BillingConsolidatedPage,
} from "@/billing/routes";

function App() {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <ThemeProvider>
            <AuthProvider>
              <SchoolThemeProvider>
              <Routes>
              <Route path="/" element={<Loader />} />
              <Route path="/landing" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/students" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <Students />
                </ProtectedRoute>
              } />
              <Route path="/admin/teachers" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <Teachers />
                </ProtectedRoute>
              } />
              <Route path="/admin/classes" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <Classes />
                </ProtectedRoute>
              } />
              <Route path="/admin/billing" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin", "accountant", "auditor"]}>
                  <BillingDashboardPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/billing/settings" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <BillingSettingsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/billing/settings/payments" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <BillingPaymentGatewayPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/billing/payroll" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin", "accountant"]}>
                  <BillingPayrollPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/billing/payroll/history" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin", "accountant"]}>
                  <BillingPayrollHistoryPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/billing/invoices" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin", "accountant", "auditor"]}>
                  <BillingInvoicesPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/billing/payments" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin", "accountant", "auditor"]}>
                  <BillingPaymentsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/billing/fees" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin", "accountant"]}>
                  <BillingFeesPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/billing/paid-students" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin", "accountant", "auditor"]}>
                  <BillingPaidStudentsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/billing/outstanding" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin", "accountant", "auditor"]}>
                  <BillingOutstandingStudentsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/billing/reports" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin", "accountant", "auditor"]}>
                  <BillingReportsPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/billing/family" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin", "accountant"]}>
                  <BillingConsolidatedPage />
                </ProtectedRoute>
              } />
              <Route path="/admin/fees" element={<Navigate to="/admin/billing/invoices" replace />} />
              <Route path="/admin/fee-structures" element={<Navigate to="/admin/billing/fees" replace />} />
              <Route path="/admin/roles" element={
                <ProtectedRoute
                  allowedRoles={["admin", "super_admin"]}
                  requiredAnyPermission={["portal.staff_access.view", "portal.staff_access.manage", "admin.manage_permissions"]}
                >
                  <RoleManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/audit-logs" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin", "auditor"]} requiredPermission={PERMISSIONS.admin.viewAudit}>
                  <AuditLogs />
                </ProtectedRoute>
              } />
              <Route path="/admin/approvals" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]} requiredAnyPermission={[PERMISSIONS.admin.approveRequests, PERMISSIONS.admin.viewAudit]}>
                  <ApprovalRequests />
                </ProtectedRoute>
              } />
              <Route path="/accountant" element={
                <ProtectedRoute allowedRoles={["accountant", "admin", "super_admin"]}>
                  <AccountantDashboard />
                </ProtectedRoute>
              } />
              <Route path="/auditor" element={
                <ProtectedRoute allowedRoles={["auditor", "admin", "super_admin"]}>
                  <AuditorDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/attendance" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <AdminAttendance />
                </ProtectedRoute>
              } />
              <Route path="/admin/timetable" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <AdminTimetable />
                </ProtectedRoute>
              } />
              <Route path="/admin/reports" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin", "accountant", "auditor"]}>
                  <Reports />
                </ProtectedRoute>
              } />
              <Route path="/admin/announcements" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <AdminAnnouncements />
                </ProtectedRoute>
              } />
              <Route path="/admin/report-cards" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <AdminReportCardsIndex />
                </ProtectedRoute>
              } />
              <Route path="/admin/report-cards/view" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <AdminReportCardsView />
                </ProtectedRoute>
              } />
              <Route path="/admin/report-cards/archive" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <AdminReportCardsArchive />
                </ProtectedRoute>
              } />
              <Route path="/admin/report-cards/versions" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <AdminReportCardsVersions />
                </ProtectedRoute>
              } />
              <Route path="/admin/report-settings" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <ReportSettings />
                </ProtectedRoute>
              } />
              <Route path="/super-admin/reports" element={
                <ProtectedRoute allowedRoles={["super_admin"]}>
                  <SuperAdminReports />
                </ProtectedRoute>
              } />
              <Route path="/admin/parent-student-link" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <ParentStudentLink />
                </ProtectedRoute>
              } />
              <Route path="/admin/teacher-class-link" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <TeacherClassLink />
                </ProtectedRoute>
              } />
              <Route path="/admin/subjects" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <Subjects />
                </ProtectedRoute>
              } />
              <Route path="/admin/lesson-notes" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin", "accountant"]}>
                  <AdminLessonNotes />
                </ProtectedRoute>
              } />
              <Route path="/admin/lesson-notes/:id" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin", "accountant"]}>
                  <AdminLessonNoteReview />
                </ProtectedRoute>
              } />
              <Route path="/admin/grade-scales" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <GradeScales />
                </ProtectedRoute>
              } />
              <Route path="/admin/super-admin-management" element={
                <ProtectedRoute allowedRoles={["super_admin"]}>
                  <SuperAdminManagement />
                </ProtectedRoute>
              } />
              <Route path="/admin/school-settings" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                <SchoolSettings />
                </ProtectedRoute>
              } />
              <Route path="/admin/number-generator" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <NumberGenerator />
                </ProtectedRoute>
              } />
              <Route path="/admin/pending-users" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <PendingUsers />
                </ProtectedRoute>
              } />
              <Route path="/admin/parent-contacts" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <ParentContacts />
                </ProtectedRoute>
              } />
              <Route path="/teacher" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherDashboard />
                </ProtectedRoute>
              } />
              <Route path="/teacher/attendance" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherAttendance />
                </ProtectedRoute>
              } />
              <Route path="/teacher/assignments" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherAssignments />
                </ProtectedRoute>
              } />
              <Route path="/teacher/grades" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherGrades />
                </ProtectedRoute>
              } />
              <Route path="/teacher/classes" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherClasses />
                </ProtectedRoute>
              } />
              <Route path="/teacher/classes/:classId" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <ClassDetails />
                </ProtectedRoute>
              } />
              <Route path="/teacher/scores" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherScores />
                </ProtectedRoute>
              } />
              <Route path="/teacher/report-cards" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherReportCardsIndex />
                </ProtectedRoute>
              } />
              <Route path="/teacher/report-cards/view" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherReportCardsView />
                </ProtectedRoute>
              } />
              <Route path="/teacher/report-cards/history" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherReportCardsHistory />
                </ProtectedRoute>
              } />
              <Route path="/teacher/signatures" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherSignatures />
                </ProtectedRoute>
              } />
              <Route path="/parent" element={
                <ProtectedRoute allowedRoles={["parent"]}>
                  <ParentDashboard />
                </ProtectedRoute>
              } />
              <Route path="/parent/payments" element={
                <ProtectedRoute allowedRoles={["parent"]}>
                  <ParentBillingPayments />
                </ProtectedRoute>
              } />
              <Route path="/parent/payment-history" element={
                <ProtectedRoute allowedRoles={["parent"]}>
                  <ParentPaymentHistory />
                </ProtectedRoute>
              } />
              <Route path="/parent/children" element={
                <ProtectedRoute allowedRoles={["parent"]}>
                  <Children />
                </ProtectedRoute>
              } />
              <Route path="/parent/attendance" element={
                <ProtectedRoute allowedRoles={["parent"]}>
                  <ParentAttendance />
                </ProtectedRoute>
              } />
              <Route path="/parent/grades" element={
                <ProtectedRoute allowedRoles={["parent"]}>
                  <ParentGrades />
                </ProtectedRoute>
              } />
              <Route path="/parent/reports" element={
                <ProtectedRoute allowedRoles={["parent"]}>
                  <ParentReports />
                </ProtectedRoute>
              } />
              <Route path="/teacher/exams" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherExams />
                </ProtectedRoute>
              } />
              <Route path="/teacher/question-bank" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <QuestionBank />
                </ProtectedRoute>
              } />
              <Route path="/teacher/online-exams" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherOnlineExams />
                </ProtectedRoute>
              } />
              <Route path="/teacher/resources" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherResources />
                </ProtectedRoute>
              } />
              <Route path="/teacher/lesson-notes" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherLessonNotes />
                </ProtectedRoute>
              } />
              <Route path="/teacher/lesson-notes/new" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherLessonNoteEditor />
                </ProtectedRoute>
              } />
              <Route path="/teacher/lesson-notes/:id" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherLessonNoteEditor />
                </ProtectedRoute>
              } />
              <Route path="/student" element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentDashboard />
                </ProtectedRoute>
              } />
              <Route path="/student/assignments" element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentAssignments />
                </ProtectedRoute>
              } />
              <Route path="/student/grades" element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentGrades />
                </ProtectedRoute>
              } />
              <Route path="/student/report-card" element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentReportCard />
                </ProtectedRoute>
              } />
              <Route path="/student/performance" element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentPerformance />
                </ProtectedRoute>
              } />
              <Route path="/student/timetable" element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentTimetable />
                </ProtectedRoute>
              } />
              <Route path="/teacher/timetable" element={
                <ProtectedRoute allowedRoles={["teacher"]}>
                  <TeacherTimetable />
                </ProtectedRoute>
              } />
              <Route path="/student/resources" element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentResources />
                </ProtectedRoute>
              } />
              <Route path="/student/online-exams" element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentOnlineExams />
                </ProtectedRoute>
              } />
              <Route path="/student/billing" element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentBilling />
                </ProtectedRoute>
              } />
              <Route path="/student/payment-history" element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <StudentPaymentHistory />
                </ProtectedRoute>
              } />
              
              <Route path="/messages" element={
                <ProtectedRoute allowedRoles={["teacher", "parent"]}>
                  <Messages />
                </ProtectedRoute>
              } />
              
              <Route path="/settings" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin", "teacher", "parent", "student"]}>
                  <Settings />
                </ProtectedRoute>
              } />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
              </SchoolThemeProvider>
          </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
