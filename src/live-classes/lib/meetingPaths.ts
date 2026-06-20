export type LiveClassPortalRole = "student" | "teacher" | "parent" | "admin";

export function getLiveClassMeetingPath(role: LiveClassPortalRole, sessionId: string): string {
  switch (role) {
    case "student":
      return `/student/live-classes/${sessionId}`;
    case "teacher":
      return `/teacher/live-classes/${sessionId}`;
    case "parent":
      return `/parent/class-schedule/${sessionId}`;
    case "admin":
      return `/admin/online-learning/session/${sessionId}`;
    default:
      return `/student/live-classes/${sessionId}`;
  }
}

export function getLiveClassListPath(role: LiveClassPortalRole): string {
  switch (role) {
    case "student":
      return "/student/live-classes";
    case "teacher":
      return "/teacher/live-classes";
    case "parent":
      return "/parent/class-schedule";
    case "admin":
      return "/admin/online-learning";
    default:
      return "/student/live-classes";
  }
}
