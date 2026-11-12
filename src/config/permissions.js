/**
 * Central RBAC definition.
 *
 * ROLES are ordered by seniority (higher LEVEL = more authority).
 * FEATURES maps each module to the access level each role holds.
 *
 * Access levels:
 *   full     - unrestricted create/read/update/delete within the role's scope
 *   limited  - create/read/update within the role's scope, no delete
 *   view     - read-only within the role's scope
 *   own          - read/update restricted to the caller's own record, never create
 *   self_manage  - read/create restricted to the caller's own sub-items
 *                  (e.g. an employee uploading their own documents) - no
 *                  update, since "editing" a document's status/verification
 *                  is a manage-level action, not something the owner does
 *                  to themself (a new upload is a fresh create instead)
 *   approve  - read within scope + approve/reject sub-actions (e.g. leave requests)
 *   request  - create/read restricted to records the caller raised themselves
 *   self_full - full read/create/update/delete, restricted to the caller's
 *               own sub-items - unlike self_manage, updates/deletes are
 *               real writes with no audit/versioning need (e.g. an
 *               employee's own next-of-kin details: personal, low-stakes,
 *               and something they should be able to keep current without
 *               HR mediation)
 *   none     - no access
 *
 * "Scope" (who the role can see) is resolved separately in
 * middleware/authorize.js -> resolveScope(), because the same access level
 * (e.g. "full") means "everyone on the platform" for SUPER_ADMIN but
 * "everyone in my company" for EMPLOYER_ADMIN / HR_MANAGER.
 */

const ROLES = {
  SUPER_ADMIN: { name: 'Super Admin', level: 100 },
  EMPLOYER_ADMIN: { name: 'Employer Admin', level: 80 },
  HR_MANAGER: { name: 'HR Manager', level: 60 },
  MANAGER: { name: 'Manager', level: 40 },
  EMPLOYEE: { name: 'Employee', level: 20 },
};

const ACCESS_LEVELS = Object.freeze({
  FULL: 'full',
  LIMITED: 'limited',
  VIEW: 'view',
  OWN: 'own',
  SELF_MANAGE: 'self_manage',
  APPROVE: 'approve',
  REQUEST: 'request',
  SELF_FULL: 'self_full',
  NONE: 'none',
});

const FEATURES = Object.freeze({
  EMPLOYEES: 'employees',
  RIGHT_TO_WORK: 'right_to_work',
  DOCUMENTS: 'documents',
  HOLIDAY: 'holiday',
  SICK_LEAVE: 'sick_leave',
  DUTY_ROSTER: 'duty_roster',
  REPORTS: 'reports',
  AUDIT_LOGS: 'audit_logs',
  ROLE_MANAGEMENT: 'role_management',
  CHANGE_OF_CIRCUMSTANCES: 'change_of_circumstances',
  ALERTS: 'alerts',
  EMERGENCY_CONTACTS: 'emergency_contacts',
  COMPANIES: 'companies',
  USERS: 'users',
  ATTENDANCE: 'attendance',
  IMPORT: 'import',
});

const { FULL, LIMITED, VIEW, OWN, SELF_MANAGE, APPROVE, REQUEST, SELF_FULL, NONE } = ACCESS_LEVELS;

const PERMISSIONS = {
  [FEATURES.EMPLOYEES]: {
    SUPER_ADMIN: FULL, EMPLOYER_ADMIN: FULL, HR_MANAGER: FULL, MANAGER: LIMITED, EMPLOYEE: OWN,
  },
  [FEATURES.RIGHT_TO_WORK]: {
    SUPER_ADMIN: FULL, EMPLOYER_ADMIN: FULL, HR_MANAGER: FULL, MANAGER: VIEW, EMPLOYEE: NONE,
  },
  [FEATURES.DOCUMENTS]: {
    SUPER_ADMIN: FULL, EMPLOYER_ADMIN: FULL, HR_MANAGER: FULL, MANAGER: LIMITED, EMPLOYEE: SELF_MANAGE,
  },
  [FEATURES.HOLIDAY]: {
    SUPER_ADMIN: FULL, EMPLOYER_ADMIN: FULL, HR_MANAGER: FULL, MANAGER: APPROVE, EMPLOYEE: REQUEST,
  },
  [FEATURES.SICK_LEAVE]: {
    SUPER_ADMIN: FULL, EMPLOYER_ADMIN: FULL, HR_MANAGER: FULL, MANAGER: APPROVE, EMPLOYEE: REQUEST,
  },
  [FEATURES.DUTY_ROSTER]: {
    SUPER_ADMIN: FULL, EMPLOYER_ADMIN: FULL, HR_MANAGER: FULL, MANAGER: FULL, EMPLOYEE: VIEW,
  },
  [FEATURES.REPORTS]: {
    SUPER_ADMIN: FULL, EMPLOYER_ADMIN: FULL, HR_MANAGER: FULL, MANAGER: LIMITED, EMPLOYEE: NONE,
  },
  [FEATURES.AUDIT_LOGS]: {
    SUPER_ADMIN: FULL, EMPLOYER_ADMIN: FULL, HR_MANAGER: FULL, MANAGER: NONE, EMPLOYEE: NONE,
  },
  [FEATURES.ROLE_MANAGEMENT]: {
    SUPER_ADMIN: FULL, EMPLOYER_ADMIN: FULL, HR_MANAGER: FULL, MANAGER: NONE, EMPLOYEE: NONE,
  },
  // A change-of-circumstances record belongs to an employee profile, so it
  // follows the same shape as EMPLOYEES: Managers can log/view changes for
  // their own team, employees can view (but never edit/delete) their own
  // history - the log is append-only, enforced in the controller.
  [FEATURES.CHANGE_OF_CIRCUMSTANCES]: {
    SUPER_ADMIN: FULL, EMPLOYER_ADMIN: FULL, HR_MANAGER: FULL, MANAGER: LIMITED, EMPLOYEE: OWN,
  },
  // Compliance alerts (right-to-work / document expiry). Treated like
  // Reports: visible to HR and above in full, Managers see their team's
  // alerts only, Employees are not shown compliance risk data directly.
  [FEATURES.ALERTS]: {
    SUPER_ADMIN: FULL, EMPLOYER_ADMIN: FULL, HR_MANAGER: FULL, MANAGER: LIMITED, EMPLOYEE: NONE,
  },
  // Next-of-kin data: not compliance/audit data, so an Employee gets full
  // self-service CRUD on their own contacts rather than the more
  // restricted OWN/SELF_MANAGE shapes used elsewhere.
  [FEATURES.EMERGENCY_CONTACTS]: {
    SUPER_ADMIN: FULL, EMPLOYER_ADMIN: FULL, HR_MANAGER: FULL, MANAGER: LIMITED, EMPLOYEE: SELF_FULL,
  },
  // Companies (tenants) are a fundamentally different shape of resource -
  // Super Admin operates across all of them (sales-assisted onboarding:
  // only Super Admin ever creates one - see companyController.js), while
  // every other role's "company" is a single fixed record, never a list.
  // EMPLOYER_ADMIN gets exactly OWN's action set (read+update, no create)
  // deliberately: OWN's scope semantics (employeeId) don't apply here at
  // all - companyController.js does its own companyId-based scoping - but
  // its action list happens to be exactly "can view and edit the one
  // record that's theirs, can never create or delete", which is precisely
  // right for a tenant managing their own company profile. HR_MANAGER can
  // view (e.g. sponsor licence info relevant to compliance work) but not
  // edit - that's an Employer Admin decision.
  [FEATURES.COMPANIES]: {
    SUPER_ADMIN: FULL, EMPLOYER_ADMIN: OWN, HR_MANAGER: VIEW, MANAGER: NONE, EMPLOYEE: NONE,
  },
  // User account management (login identities, not employee profiles).
  // FULL for EMPLOYER_ADMIN and HR_MANAGER resolves to 'company' scope via
  // resolveScope's default fallthrough (not an employee-specific 'own'/
  // 'team' scope - User has its own companyId column, and
  // scopeToChildWhere's 'company'/'all' branches work against it directly
  // without needing anything employee-specific). Decision: HR_MANAGER is
  // included here (not just EMPLOYER_ADMIN) because account
  // provisioning/deactivation is routine HR administration in most orgs,
  // and canManageRole() already stops HR_MANAGER from creating/editing
  // anyone at or above their own seniority (an EMPLOYER_ADMIN account, or
  // another HR_MANAGER's), so this isn't a privilege-escalation risk.
  [FEATURES.USERS]: {
    SUPER_ADMIN: FULL, EMPLOYER_ADMIN: FULL, HR_MANAGER: FULL, MANAGER: NONE, EMPLOYEE: NONE,
  },
  // Attendance (actual hours worked - distinct from DUTY_ROSTER's planned
  // shifts). Shaped like HOLIDAY/SICK_LEAVE: Manager approves/views their
  // team's entries, Employee can only submit/view their own.
  [FEATURES.ATTENDANCE]: {
    SUPER_ADMIN: FULL, EMPLOYER_ADMIN: FULL, HR_MANAGER: FULL, MANAGER: APPROVE, EMPLOYEE: REQUEST,
  },
  // Bulk CSV/Excel import - an inherently company-wide admin action, so no
  // Manager/Employee access, same shape as USERS.
  [FEATURES.IMPORT]: {
    SUPER_ADMIN: FULL, EMPLOYER_ADMIN: FULL, HR_MANAGER: FULL, MANAGER: NONE, EMPLOYEE: NONE,
  },
};

// Which access levels allow which CRUD-style actions.
const ACTION_MATRIX = {
  [FULL]: ['read', 'create', 'update', 'delete', 'approve'],
  [LIMITED]: ['read', 'create', 'update'],
  [VIEW]: ['read'],
  [OWN]: ['read', 'update'],
  [SELF_MANAGE]: ['read', 'create'],
  [APPROVE]: ['read', 'approve'],
  [REQUEST]: ['read', 'create'],
  [SELF_FULL]: ['read', 'create', 'update', 'delete'],
  [NONE]: [],
};

function getAccessLevel(roleKey, feature) {
  const featurePerms = PERMISSIONS[feature];
  if (!featurePerms) return NONE;
  return featurePerms[roleKey] || NONE;
}

function canPerform(roleKey, feature, action) {
  const level = getAccessLevel(roleKey, feature);
  return ACTION_MATRIX[level]?.includes(action) ?? false;
}

module.exports = {
  ROLES,
  ACCESS_LEVELS,
  FEATURES,
  PERMISSIONS,
  ACTION_MATRIX,
  getAccessLevel,
  canPerform,
};
