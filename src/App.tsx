import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
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
import Fees from "./pages/admin/Fees";
import FeeStructures from "./pages/admin/FeeStructures";
import AdminAttendance from "./pages/admin/Attendance";
import AdminSchedule from "./pages/admin/Schedule";
import Reports from "./pages/admin/Reports";
import AdminAnnouncements from "./pages/admin/Announcements";
import AdminReportCards from "./pages/admin/ReportCards";
import Payments from "./pages/parent/Payments";
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
import StudentResources from "./pages/student/Resources";
import Messages from "./pages/Messages";
import Schedule from "./pages/student/Schedule";
import NotFound from "./pages/NotFound";
import ExamTypes from "./pages/admin/ExamTypes";
import GradeScales from "./pages/admin/GradeScales";
import QuestionBank from "./pages/teacher/QuestionBank";
import TeacherOnlineExams from "./pages/teacher/OnlineExams";
import StudentOnlineExams from "./pages/student/OnlineExams";
import SuperAdminManagement from "./pages/admin/SuperAdminManagement";
import SchoolSettings from "./pages/admin/SchoolSettings";

function App() {
  const [queryClient] = useState(() => new QueryClient());

  // Disable right-click globally to protect content
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // Prevent common keyboard shortcuts for copying
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Ctrl+Shift+I (DevTools), Ctrl+Shift+J (Console), Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'I' || e.key === 'J')) {
        e.preventDefault();
        return false;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'U') {
        e.preventDefault();
        return false;
      }
      // Prevent F12
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ThemeProvider>
            <AuthProvider>
              <Routes>
              <Route path="/" element={<Landing />} />
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
              <Route path="/admin/fees" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <Fees />
                </ProtectedRoute>
              } />
              <Route path="/admin/fee-structures" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <FeeStructures />
                </ProtectedRoute>
              } />
              <Route path="/admin/attendance" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <AdminAttendance />
                </ProtectedRoute>
              } />
              <Route path="/admin/schedule" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <AdminSchedule />
                </ProtectedRoute>
              } />
              <Route path="/admin/reports" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
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
                  <AdminReportCards />
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
              <Route path="/admin/exam-types" element={
                <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
                  <ExamTypes />
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
              <Route path="/parent" element={
                <ProtectedRoute allowedRoles={["parent"]}>
                  <ParentDashboard />
                </ProtectedRoute>
              } />
              <Route path="/parent/payments" element={
                <ProtectedRoute allowedRoles={["parent"]}>
                  <Payments />
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
              <Route path="/student/schedule" element={
                <ProtectedRoute allowedRoles={["student"]}>
                  <Schedule />
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
          </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
