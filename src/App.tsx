import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import AdminDashboard from "./pages/AdminDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import ParentDashboard from "./pages/ParentDashboard";
import StudentDashboard from "./pages/StudentDashboard";
import Students from "./pages/admin/Students";
import Settings from "./pages/Settings";
import Teachers from "./pages/admin/Teachers";
import Classes from "./pages/admin/Classes";
import Fees from "./pages/admin/Fees";
import AdminAttendance from "./pages/admin/Attendance";
import AdminSchedule from "./pages/admin/Schedule";
import Reports from "./pages/admin/Reports";
import AdminAnnouncements from "./pages/admin/Announcements";
import AdminReportCards from "./pages/admin/ReportCards";
import Payments from "./pages/parent/Payments";
import Children from "./pages/parent/Children";
import ParentAttendance from "./pages/parent/Attendance";
import ParentGrades from "./pages/parent/Grades";
import TeacherAttendance from "./pages/teacher/Attendance";
import TeacherAssignments from "./pages/teacher/Assignments";
import TeacherGrades from "./pages/teacher/Grades";
import TeacherClasses from "./pages/teacher/Classes";
import StudentAssignments from "./pages/student/Assignments";
import StudentGrades from "./pages/student/Grades";
import TeacherExams from "./pages/teacher/Exams";
import TeacherResources from "./pages/teacher/Resources";
import StudentResources from "./pages/student/Resources";
import Messages from "./pages/Messages";
import Schedule from "./pages/student/Schedule";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/students" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Students />
              </ProtectedRoute>
            } />
            <Route path="/admin/teachers" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Teachers />
              </ProtectedRoute>
            } />
            <Route path="/admin/classes" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Classes />
              </ProtectedRoute>
            } />
            <Route path="/admin/fees" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Fees />
              </ProtectedRoute>
            } />
            <Route path="/admin/attendance" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminAttendance />
              </ProtectedRoute>
            } />
            <Route path="/admin/schedule" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminSchedule />
              </ProtectedRoute>
            } />
            <Route path="/admin/reports" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <Reports />
              </ProtectedRoute>
            } />
            <Route path="/admin/announcements" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminAnnouncements />
              </ProtectedRoute>
            } />
            <Route path="/admin/report-cards" element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminReportCards />
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
            
            <Route path="/messages" element={
              <ProtectedRoute allowedRoles={["teacher", "parent"]}>
                <Messages />
              </ProtectedRoute>
            } />
            
            <Route path="/settings" element={
              <ProtectedRoute allowedRoles={["admin", "teacher", "parent", "student"]}>
                <Settings />
              </ProtectedRoute>
            } />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
