import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesListPage from './pages/EmployeesListPage';
import EmployeeDetailPage from './pages/EmployeeDetailPage';
import EmployeeCreatePage from './pages/EmployeeCreatePage';
import RightToWorkPage from './pages/RightToWorkPage';
import DocumentsPage from './pages/DocumentsPage';
import ChangeOfCircumstancesPage from './pages/ChangeOfCircumstancesPage';
import RosterPage from './pages/RosterPage';
import AttendancePage from './pages/AttendancePage';
import ImportPage from './pages/ImportPage';
import HolidayPage from './pages/HolidayPage';
import AbsencePage from './pages/AbsencePage';
import AlertsPage from './pages/AlertsPage';
import ReportsPage from './pages/ReportsPage';
import RoleManagementPage from './pages/RoleManagementPage';
import AuditLogPage from './pages/AuditLogPage';
import CompaniesPage from './pages/CompaniesPage';
import UsersPage from './pages/UsersPage';
import ChangePasswordPage from './pages/ChangePasswordPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/employees" element={<EmployeesListPage />} />
        <Route path="/employees/new" element={<EmployeeCreatePage />} />
        <Route path="/employees/:id" element={<EmployeeDetailPage />} />
        <Route path="/right-to-work" element={<RightToWorkPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/change-of-circumstances" element={<ChangeOfCircumstancesPage />} />
        <Route path="/roster" element={<RosterPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/import" element={<ImportPage />} />
        <Route path="/holiday" element={<HolidayPage />} />
        <Route path="/absence" element={<AbsencePage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/roles" element={<RoleManagementPage />} />
        <Route path="/audit-log" element={<AuditLogPage />} />
        <Route path="/companies" element={<CompaniesPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
      </Route>
    </Routes>
  );
}
