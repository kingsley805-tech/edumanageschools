import { Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AiAssistantPage from "./pages/AiAssistantPage";

const AI_ROLES = ["admin", "super_admin", "teacher", "parent", "student", "accountant", "auditor"] as const;

export function AiAssistantRoutes() {
  return (
    <>
      <Route
        path="/ai-assistant"
        element={
          <ProtectedRoute allowedRoles={[...AI_ROLES]}>
            <AiAssistantPage />
          </ProtectedRoute>
        }
      />
      <Route path="/dashboard/ai-assistant" element={<Navigate to="/ai-assistant" replace />} />
    </>
  );
}
