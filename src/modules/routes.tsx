import { Route } from "react-router-dom";
import type { ReactNode } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { withAdminModuleLayout } from "@/modules/lib/withAdminModuleLayout";
import StaffManagementPage from "@/modules/hr/pages/StaffManagement";
import LeaveManagementPage from "@/modules/hr/pages/LeaveManagement";
import StaffAttendancePage from "@/modules/hr/pages/StaffAttendance";
import LibraryManagementPage from "@/modules/library/pages/LibraryManagement";
import TransportPage from "@/modules/transport/pages/Transport";
import HostelPage from "@/modules/hostel/pages/Hostel";
import InventoryPage from "@/modules/inventory/pages/Inventory";
import AchievementsPage from "@/modules/achievements/pages/Achievements";
import ProgramsPage from "@/modules/programs/pages/Programs";
import StudentPerformancePage from "@/modules/performance/pages/StudentPerformance";
import DepartmentsPage from "@/modules/administration/pages/Departments";
import StaffEmployeesPage from "@/modules/administration/pages/StaffEmployees";
import AcademicCalendarPage from "@/modules/administration/pages/AcademicCalendar";
import BehaviorReportsPage from "@/modules/domestics/pages/BehaviorReports";
import ExeatsPage from "@/modules/domestics/pages/Exeats";
import StudentHealthPage from "@/modules/health/pages/StudentHealth";
import ExpensesPage from "@/modules/finance/pages/Expenses";
import OtherIncomePage from "@/modules/finance/pages/OtherIncome";
import BudgetsPage from "@/modules/finance/pages/Budgets";
import SchoolShopPage from "@/modules/shop/pages/SchoolShop";
import LaboratoryPage from "@/modules/laboratory/pages/Laboratory";
import AiReceptionistPage from "@/modules/ai-receptionist/pages/AiReceptionist";

const StaffManagement = withAdminModuleLayout(StaffManagementPage);
const LeaveManagement = withAdminModuleLayout(LeaveManagementPage);
const StaffAttendance = withAdminModuleLayout(StaffAttendancePage);
const LibraryManagement = withAdminModuleLayout(LibraryManagementPage);
const Transport = withAdminModuleLayout(TransportPage);
const Hostel = withAdminModuleLayout(HostelPage);
const Inventory = withAdminModuleLayout(InventoryPage);
const Achievements = withAdminModuleLayout(AchievementsPage);
const Programs = withAdminModuleLayout(ProgramsPage);
const StudentPerformance = withAdminModuleLayout(StudentPerformancePage);
const Departments = withAdminModuleLayout(DepartmentsPage);
const StaffEmployees = withAdminModuleLayout(StaffEmployeesPage);
const AcademicCalendar = withAdminModuleLayout(AcademicCalendarPage);
const BehaviorReports = withAdminModuleLayout(BehaviorReportsPage);
const Exeats = withAdminModuleLayout(ExeatsPage);
const StudentHealth = withAdminModuleLayout(StudentHealthPage);
const Expenses = withAdminModuleLayout(ExpensesPage);
const OtherIncome = withAdminModuleLayout(OtherIncomePage);
const Budgets = withAdminModuleLayout(BudgetsPage);
const SchoolShop = withAdminModuleLayout(SchoolShopPage);
const Laboratory = withAdminModuleLayout(LaboratoryPage);
const AiReceptionist = withAdminModuleLayout(AiReceptionistPage);

const ADMIN_ROLES = ["admin", "super_admin"] as const;
const FINANCE_ROLES = [...ADMIN_ROLES, "accountant"] as const;

function adminRoute(path: string, element: ReactNode, roles: readonly string[] = ADMIN_ROLES) {
  return (
    <Route
      path={path}
      element={<ProtectedRoute allowedRoles={[...roles]}>{element}</ProtectedRoute>}
    />
  );
}

export function OperationsModuleRoutes() {
  return (
    <>
      {adminRoute("/admin/hr/staff", <StaffManagement />)}
      {adminRoute("/admin/hr/leave", <LeaveManagement />)}
      {adminRoute("/admin/hr/attendance", <StaffAttendance />)}
      {adminRoute("/admin/library", <LibraryManagement />)}
      {adminRoute("/admin/transport", <Transport />)}
      {adminRoute("/admin/hostel", <Hostel />)}
      {adminRoute("/admin/inventory", <Inventory />, FINANCE_ROLES)}
      {adminRoute("/admin/achievements", <Achievements />)}
      {adminRoute("/admin/programs", <Programs />)}
      {adminRoute("/admin/student-performance", <StudentPerformance />, [...ADMIN_ROLES, "teacher"])}
      {adminRoute("/admin/staff", <StaffEmployees />)}
      {adminRoute("/admin/departments", <Departments />)}
      {adminRoute("/admin/academic-calendar", <AcademicCalendar />)}
      {adminRoute("/admin/behavior", <BehaviorReports />, [...ADMIN_ROLES, "teacher"])}
      {adminRoute("/admin/exeats", <Exeats />)}
      {adminRoute("/admin/health", <StudentHealth />)}
      {adminRoute("/admin/finance/expenses", <Expenses />, FINANCE_ROLES)}
      {adminRoute("/admin/finance/other-income", <OtherIncome />, FINANCE_ROLES)}
      {adminRoute("/admin/finance/budgets", <Budgets />, FINANCE_ROLES)}
      {adminRoute("/admin/shop", <SchoolShop />, FINANCE_ROLES)}
      {adminRoute("/admin/laboratory", <Laboratory />)}
      {adminRoute("/admin/ai-receptionist", <AiReceptionist />)}
    </>
  );
}
