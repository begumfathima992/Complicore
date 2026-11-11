const sequelize = require('../config/database');
const Company = require('./Company');
const Role = require('./Role');
const Department = require('./Department');
const Employee = require('./Employee');
const ImmigrationDetail = require('./ImmigrationDetail');
const EmergencyContact = require('./EmergencyContact');
const User = require('./User');
const Document = require('./Document');
const RightToWorkCheck = require('./RightToWorkCheck');
const ChangeOfCircumstance = require('./ChangeOfCircumstance');
const Alert = require('./Alert');
const Shift = require('./Shift');
const ShiftChangeRequest = require('./ShiftChangeRequest');
const HolidayBalance = require('./HolidayBalance');
const HolidayRequest = require('./HolidayRequest');
const Absence = require('./Absence');
const RolePermissionRestriction = require('./RolePermissionRestriction');
const AuditLog = require('./AuditLog');
const SentExpiryAlert = require('./SentExpiryAlert');

// --- Company (tenant) scoping -------------------------------------------
Company.hasMany(Department, { foreignKey: 'companyId' });
Department.belongsTo(Company, { foreignKey: 'companyId' });

Company.hasMany(Employee, { foreignKey: 'companyId' });
Employee.belongsTo(Company, { foreignKey: 'companyId' });

Company.hasMany(User, { foreignKey: 'companyId' });
User.belongsTo(Company, { foreignKey: 'companyId' });

Company.hasMany(Document, { foreignKey: 'companyId' });
Document.belongsTo(Company, { foreignKey: 'companyId' });

Company.hasMany(RightToWorkCheck, { foreignKey: 'companyId' });
RightToWorkCheck.belongsTo(Company, { foreignKey: 'companyId' });

Company.hasMany(ChangeOfCircumstance, { foreignKey: 'companyId' });
ChangeOfCircumstance.belongsTo(Company, { foreignKey: 'companyId' });

Company.hasMany(Alert, { foreignKey: 'companyId' });
Alert.belongsTo(Company, { foreignKey: 'companyId' });

Company.hasMany(Shift, { foreignKey: 'companyId' });
Shift.belongsTo(Company, { foreignKey: 'companyId' });

Company.hasMany(HolidayRequest, { foreignKey: 'companyId' });
HolidayRequest.belongsTo(Company, { foreignKey: 'companyId' });

Company.hasMany(HolidayBalance, { foreignKey: 'companyId' });
HolidayBalance.belongsTo(Company, { foreignKey: 'companyId' });

Company.hasMany(Absence, { foreignKey: 'companyId' });
Absence.belongsTo(Company, { foreignKey: 'companyId' });

Company.hasMany(RolePermissionRestriction, { foreignKey: 'companyId', onDelete: 'CASCADE' });
RolePermissionRestriction.belongsTo(Company, { foreignKey: 'companyId' });

Company.hasMany(AuditLog, { foreignKey: 'companyId' });
AuditLog.belongsTo(Company, { foreignKey: 'companyId' });

Company.hasMany(EmergencyContact, { foreignKey: 'companyId' });
EmergencyContact.belongsTo(Company, { foreignKey: 'companyId' });

// --- Employee structure ---------------------------------------------------
Department.hasMany(Employee, { foreignKey: 'departmentId' });
Employee.belongsTo(Department, { foreignKey: 'departmentId' });

// Self-referencing "reports to" relationship
Employee.belongsTo(Employee, { as: 'manager', foreignKey: 'managerId' });
Employee.hasMany(Employee, { as: 'directReports', foreignKey: 'managerId' });

Employee.hasOne(ImmigrationDetail, { foreignKey: 'employeeId', onDelete: 'CASCADE' });
ImmigrationDetail.belongsTo(Employee, { foreignKey: 'employeeId' });

Employee.hasMany(EmergencyContact, { foreignKey: 'employeeId', onDelete: 'CASCADE' });
EmergencyContact.belongsTo(Employee, { foreignKey: 'employeeId' });

// --- Right to work ----------------------------------------------------------
Employee.hasMany(RightToWorkCheck, { foreignKey: 'employeeId', onDelete: 'CASCADE' });
RightToWorkCheck.belongsTo(Employee, { foreignKey: 'employeeId' });

// The evidence for a check is optionally a document from the vault below
RightToWorkCheck.belongsTo(Document, { as: 'evidenceDocument', foreignKey: 'evidenceDocumentId' });
RightToWorkCheck.belongsTo(User, { as: 'checkedBy', foreignKey: 'checkedByUserId' });

// --- Change of circumstances -------------------------------------------------
Employee.hasMany(ChangeOfCircumstance, { foreignKey: 'employeeId', onDelete: 'CASCADE' });
ChangeOfCircumstance.belongsTo(Employee, { foreignKey: 'employeeId' });

ChangeOfCircumstance.belongsTo(User, { as: 'changedBy', foreignKey: 'changedByUserId' });
ChangeOfCircumstance.belongsTo(Document, { as: 'supportingDocument', foreignKey: 'supportingDocumentId' });

// --- Document vault -----------------------------------------------------------
Employee.hasMany(Document, { foreignKey: 'employeeId', onDelete: 'CASCADE' });
Document.belongsTo(Employee, { foreignKey: 'employeeId' });

Document.belongsTo(User, { as: 'uploadedBy', foreignKey: 'uploadedByUserId' });

// --- Alerts -------------------------------------------------------------------
Employee.hasMany(Alert, { foreignKey: 'employeeId', onDelete: 'CASCADE' });
Alert.belongsTo(Employee, { foreignKey: 'employeeId' });

Alert.belongsTo(User, { as: 'acknowledgedBy', foreignKey: 'acknowledgedByUserId' });

// --- Duty roster ----------------------------------------------------------
Employee.hasMany(Shift, { foreignKey: 'employeeId', onDelete: 'CASCADE' });
Shift.belongsTo(Employee, { foreignKey: 'employeeId' });

Department.hasMany(Shift, { foreignKey: 'departmentId' });
Shift.belongsTo(Department, { foreignKey: 'departmentId' });

Shift.belongsTo(User, { as: 'createdBy', foreignKey: 'createdByUserId' });

Shift.hasMany(ShiftChangeRequest, { foreignKey: 'shiftId', onDelete: 'CASCADE' });
ShiftChangeRequest.belongsTo(Shift, { foreignKey: 'shiftId' });

ShiftChangeRequest.belongsTo(User, { as: 'requestedBy', foreignKey: 'requestedByUserId' });
ShiftChangeRequest.belongsTo(Employee, { as: 'swapWithEmployee', foreignKey: 'swapWithEmployeeId' });
ShiftChangeRequest.belongsTo(User, { as: 'reviewedBy', foreignKey: 'reviewedByUserId' });

// --- Holiday management -----------------------------------------------------
Employee.hasMany(HolidayBalance, { foreignKey: 'employeeId', onDelete: 'CASCADE' });
HolidayBalance.belongsTo(Employee, { foreignKey: 'employeeId' });

Employee.hasMany(HolidayRequest, { foreignKey: 'employeeId', onDelete: 'CASCADE' });
HolidayRequest.belongsTo(Employee, { foreignKey: 'employeeId' });

HolidayRequest.belongsTo(User, { as: 'managerReviewedBy', foreignKey: 'managerReviewedByUserId' });
HolidayRequest.belongsTo(User, { as: 'hrConfirmedBy', foreignKey: 'hrConfirmedByUserId' });

// --- Absence management -----------------------------------------------------
Employee.hasMany(Absence, { foreignKey: 'employeeId', onDelete: 'CASCADE' });
Absence.belongsTo(Employee, { foreignKey: 'employeeId' });

Absence.belongsTo(Document, { as: 'evidence', foreignKey: 'evidenceDocumentId' });
Absence.belongsTo(User, { as: 'approvedBy', foreignKey: 'approvedByUserId' });

// --- Audit log ----------------------------------------------------------------
Employee.hasMany(AuditLog, { foreignKey: 'employeeId' });
AuditLog.belongsTo(Employee, { foreignKey: 'employeeId' });

AuditLog.belongsTo(User, { as: 'performedBy', foreignKey: 'performedByUserId' });

// --- Auth / RBAC -----------------------------------------------------------
Role.hasMany(User, { foreignKey: 'roleId' });
User.belongsTo(Role, { foreignKey: 'roleId' });

// A user account may (but need not) be linked to one employee record
Employee.hasOne(User, { foreignKey: 'employeeId' });
User.belongsTo(Employee, { foreignKey: 'employeeId' });

// roleKey on RolePermissionRestriction is a plain string (see model comment) -
// no FK to Role.id, since restrictions are addressed by the stable ROLES
// config key, not the DB row.

module.exports = {
  sequelize,
  Company,
  Role,
  Department,
  Employee,
  ImmigrationDetail,
  EmergencyContact,
  User,
  Document,
  RightToWorkCheck,
  ChangeOfCircumstance,
  Alert,
  Shift,
  ShiftChangeRequest,
  HolidayBalance,
  HolidayRequest,
  Absence,
  RolePermissionRestriction,
  AuditLog,
  SentExpiryAlert,
};
