import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AdminOnlineLearning from "@/live-classes/pages/admin/OnlineLearning";
import GoogleOAuthCallback from "@/live-classes/pages/admin/GoogleOAuthCallback";
import TeacherLiveClasses from "@/live-classes/pages/teacher/LiveClasses";
import StudentLiveClasses from "@/live-classes/pages/student/LiveClasses";
import ParentClassSchedule from "@/live-classes/pages/parent/ClassSchedule";
import LiveClassMeetingRoom from "@/live-classes/pages/shared/LiveClassMeetingRoom";

/** Live classes / Google Meet portal routes — keep in one module so Vite always bundles them. */
export function LiveClassesRoutes() {
  return (
    <>
      <Route
        path="/admin/online-learning"
        element={
          <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
            <AdminOnlineLearning />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/online-learning/session/:sessionId"
        element={
          <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
            <LiveClassMeetingRoom role="admin" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/online-learning/oauth/callback"
        element={
          <ProtectedRoute allowedRoles={["admin", "super_admin"]}>
            <GoogleOAuthCallback />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/live-classes/:sessionId"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <LiveClassMeetingRoom role="teacher" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/teacher/live-classes"
        element={
          <ProtectedRoute allowedRoles={["teacher"]}>
            <TeacherLiveClasses />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/live-classes/:sessionId"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <LiveClassMeetingRoom role="student" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/student/live-classes"
        element={
          <ProtectedRoute allowedRoles={["student"]}>
            <StudentLiveClasses />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent/class-schedule/:sessionId"
        element={
          <ProtectedRoute allowedRoles={["parent"]}>
            <LiveClassMeetingRoom role="parent" />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parent/class-schedule"
        element={
          <ProtectedRoute allowedRoles={["parent"]}>
            <ParentClassSchedule />
          </ProtectedRoute>
        }
      />
    </>
  );
}
