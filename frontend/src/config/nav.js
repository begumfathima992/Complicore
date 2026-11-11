// Mirrors the read-access rows of the backend's config/permissions.js matrix,
// for UX only (hide links a role would just get a 403 from). The backend's
// authorize() middleware - and, per-company, its Role Management
// restrictions - remain the actual authority; this list can only fall out
// of sync in the "shows a link that then 403s" direction, never the
// reverse, since every page also renders API error messages directly.
const ALL_ROLES = ['SUPER_ADMIN', 'EMPLOYER_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'];
const MANAGER_UP = ['SUPER_ADMIN', 'EMPLOYER_ADMIN', 'HR_MANAGER', 'MANAGER'];
const HR_UP = ['SUPER_ADMIN', 'EMPLOYER_ADMIN', 'HR_MANAGER'];

export const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', roles: MANAGER_UP },
  { path: '/employees', label: 'Employees', roles: ALL_ROLES },
  { path: '/right-to-work', label: 'Right to Work', roles: MANAGER_UP },
  { path: '/documents', label: 'Documents', roles: ALL_ROLES },
  { path: '/change-of-circumstances', label: 'Change of Circumstances', roles: ALL_ROLES },
  { path: '/roster', label: 'Duty Roster', roles: ALL_ROLES },
  { path: '/holiday', label: 'Holiday', roles: ALL_ROLES },
  { path: '/absence', label: 'Absence', roles: ALL_ROLES },
  { path: '/alerts', label: 'Alerts', roles: MANAGER_UP },
  { path: '/reports', label: 'Reports', roles: MANAGER_UP },
  { path: '/roles', label: 'Role Management', roles: HR_UP },
  { path: '/audit-log', label: 'Audit Log', roles: HR_UP },
  { path: '/companies', label: 'Companies', roles: HR_UP },
  { path: '/users', label: 'Users', roles: HR_UP },
];

export function navItemsForRole(role) {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
