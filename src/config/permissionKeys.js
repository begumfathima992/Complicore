const { FEATURES, ROLES, ACTION_MATRIX, getAccessLevel } = require('./permissions');

/**
 * Maps each (feature, action) pair from permissions.js onto a granular,
 * human-readable permission key - the same style as the example in the
 * spec ("employee.view", "documents.upload", "holiday.approve", ...).
 * Several (feature, action) pairs can collapse onto the same key (e.g.
 * documents:create -> 'documents.upload' but documents:update ->
 * 'documents.manage') because the granular key names the *capability*,
 * while (feature, action) names the underlying enforcement check.
 *
 * This file is the read model for Role Management: it turns the compact
 * access-level matrix into the explicit permission-string list admins
 * actually see and can restrict (services/permissionService.js).
 */
const KEY_MAP = {
  'employees:read': 'employee.view',
  'employees:create': 'employee.create',
  'employees:update': 'employee.edit',
  'employees:delete': 'employee.delete',

  'right_to_work:read': 'right_to_work.view',
  'right_to_work:create': 'right_to_work.manage',
  'right_to_work:update': 'right_to_work.manage',

  'documents:read': 'documents.view',
  'documents:create': 'documents.upload',
  'documents:update': 'documents.manage',
  'documents:delete': 'documents.delete',

  'holiday:read': 'holiday.view',
  'holiday:create': 'holiday.request',
  'holiday:approve': 'holiday.approve',
  'holiday:update': 'holiday.manage',

  'sick_leave:read': 'absence.view',
  'sick_leave:create': 'absence.request',
  'sick_leave:approve': 'absence.approve',
  'sick_leave:update': 'absence.manage',

  'duty_roster:read': 'duty_roster.view',
  'duty_roster:create': 'duty_roster.manage',
  'duty_roster:update': 'duty_roster.manage',
  'duty_roster:approve': 'duty_roster.approve',

  'reports:read': 'reports.view',
  'audit_logs:read': 'audit_logs.view',

  'role_management:read': 'role_management.view',
  'role_management:update': 'role_management.manage',

  'change_of_circumstances:read': 'change_of_circumstances.view',
  'change_of_circumstances:create': 'change_of_circumstances.log',

  'alerts:read': 'alerts.view',
  'alerts:update': 'alerts.manage',

  'emergency_contacts:read': 'emergency_contacts.view',
  'emergency_contacts:create': 'emergency_contacts.manage',
  'emergency_contacts:update': 'emergency_contacts.manage',
  'emergency_contacts:delete': 'emergency_contacts.delete',

  'companies:read': 'companies.view',
  'companies:create': 'companies.create',
  'companies:update': 'companies.manage',

  'users:read': 'users.view',
  'users:create': 'users.create',
  'users:update': 'users.manage',
  'users:delete': 'users.deactivate',

  'attendance:read': 'attendance.view',
  'attendance:create': 'attendance.request',
  'attendance:approve': 'attendance.approve',
  'attendance:update': 'attendance.manage',

  'import:read': 'import.view',
  'import:create': 'import.run',
};

/** All granular keys that exist, for validating restriction requests. */
const ALL_PERMISSION_KEYS = Array.from(new Set(Object.values(KEY_MAP))).concat(['compliance.manage']);

/**
 * The full set of granular keys a role holds *at the platform level*
 * (before any per-company RolePermissionRestriction is applied).
 */
function platformPermissionKeysForRole(roleKey) {
  const keys = new Set();

  for (const feature of Object.values(FEATURES)) {
    const level = getAccessLevel(roleKey, feature);
    const actions = ACTION_MATRIX[level] || [];
    for (const action of actions) {
      const mapped = KEY_MAP[`${feature}:${action}`];
      if (mapped) keys.add(mapped);
    }
  }

  // Synthetic combined key, matching the spec's HR Manager example: a role
  // only gets it if it can actively manage both right-to-work and document
  // compliance evidence, not just view them.
  if (keys.has('right_to_work.manage') && keys.has('documents.manage')) {
    keys.add('compliance.manage');
  }

  return keys;
}

module.exports = { KEY_MAP, ALL_PERMISSION_KEYS, platformPermissionKeysForRole, ROLES };
