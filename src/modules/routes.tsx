import { Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { withAdminModuleLayout } from "@/modules/lib/withAdminModuleLayout";
import StaffManagementPage from "@/modules/hr/pages/StaffManagement";
import LeaveManagementPage from "@/modules/hr/pages/LeaveManagement";
import StaffAttendancePage from "@/modules/hr/pages/StaffAttendance";
import LibraryManagementPage from "@/modules/library/pages/LibraryManagement";
import TransportPage from "@/modules/transport/pages/Transport";
import HostelPage from "@/modules/hostel/pages/Hostel";
import InventoryPage from "@/modules/inventory/pages/Inventory";

const StaffManagement = withAdminModuleLayout(StaffManagementPage);
const LeaveManagement = withAdminModuleLayout(LeaveManagementPage);
const StaffAttendance = withAdminModuleLayout(StaffAttendancePage);
const LibraryManagement = withAdminModuleLayout(LibraryManagementPage);
const Transport = withAdminModuleLayout(TransportPage);
const Hostel = withAdminModuleLayout(HostelPage);
const Inventory = withAdminModuleLayout(InventoryPage);

const ADMIN_ROLES = ["admin", "super_admin"] as const;

export function OperationsModuleRoutes() {
  return (
    <>
      <Route
        path="/admin/hr/staff"
        element={
          <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}>
            <StaffManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/hr/leave"
        element={
          <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}>
            <LeaveManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/hr/attendance"
        element={
          <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}>
            <StaffAttendance />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/library"
        element={
          <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}>
            <LibraryManagement />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/transport"
        element={
          <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}>
            <Transport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/hostel"
        element={
          <ProtectedRoute allowedRoles={[...ADMIN_ROLES]}>
            <Hostel />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/inventory"
        element={
          <ProtectedRoute allowedRoles={[...ADMIN_ROLES, "accountant"]}>
            <Inventory />
          </ProtectedRoute>
        }
      />
    </>
  );
}
