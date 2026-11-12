const { Op } = require('sequelize');
const {
  RightToWorkCheck,
  Document,
  Employee,
  Alert,
  HolidayRequest,
  Absence,
  VisaRecord,
  IdentityDocument,
} = require('../models');

// Absence-threshold trigger: N or more absence periods within a rolling window.
// A simplified stand-in for a Bradford-factor-style policy, not a statutory rule.
const ABSENCE_THRESHOLD_COUNT = 3;
const ABSENCE_THRESHOLD_WINDOW_DAYS = 90;

// Mandatory documents every active employee should have on file.
const REQUIRED_DOCUMENT_TYPES = ['passport_id', 'right_to_work_evidence'];

function daysUntil(dateOnly) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateOnly);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

/**
 * Generic day-based severity classifier. `tiers` lets callers pick how
 * aggressively a given alert type escalates (right-to-work is stricter
 * than, say, a training certificate).
 */
function classifyByDays(days, tiers = { mediumDays: 90, highDays: 30 }) {
  if (days < 0) return 'critical';
  if (days <= tiers.highDays) return 'high';
  if (days <= tiers.mediumDays) return 'medium';
  return null; // not due for an alert yet
}

function buildMessage(label, days) {
  if (days < 0) return `${label} expired ${Math.abs(days)} day(s) ago`;
  return `${label} expires in ${days} day(s)`;
}

/** Same phrasing rule as buildMessage, for titles that don't carry a full label. */
function daysPhrase(days) {
  return days < 0 ? `expired ${Math.abs(days)} day(s) ago` : `expires in ${days} day(s)`;
}

async function upsertAlert({
  alertType,
  sourceType,
  sourceId,
  employeeId,
  companyId,
  severity,
  dueDate,
  title,
  message,
  actionRequired,
  assignedToRoleKey,
}) {
  const existing = await Alert.findOne({
    where: { alertType, sourceType, sourceId, status: { [Op.ne]: 'resolved' } },
  });

  if (!severity) {
    // No longer due - e.g. a later-dated check/document has superseded this one.
    if (existing) await existing.update({ status: 'resolved' });
    return null;
  }

  const attrs = { severity, dueDate, title, message, actionRequired, assignedToRoleKey };
  if (existing) {
    await existing.update(attrs);
    return existing;
  }

  return Alert.create({ alertType, sourceType, sourceId, employeeId, companyId, status: 'open', ...attrs });
}

/** Most recent right-to-work check per employee drives that employee's alert. */
async function syncRightToWorkAlerts() {
  const checks = await RightToWorkCheck.findAll({
    where: { expiryDate: { [Op.ne]: null } },
    include: [{ model: Employee, where: { employmentStatus: 'active' }, attributes: ['id', 'companyId', 'firstName', 'lastName'] }],
    order: [['checkDate', 'DESC']],
  });

  const latestPerEmployee = new Map();
  for (const check of checks) {
    if (!latestPerEmployee.has(check.employeeId)) latestPerEmployee.set(check.employeeId, check);
  }

  const results = [];
  for (const check of latestPerEmployee.values()) {
    const days = daysUntil(check.expiryDate);
    const severity = classifyByDays(days, { mediumDays: 90, highDays: 30 });
    results.push(
      await upsertAlert({
        alertType: 'right_to_work_expiry',
        sourceType: 'RightToWorkCheck',
        sourceId: check.id,
        employeeId: check.employeeId,
        companyId: check.Employee.companyId,
        severity,
        dueDate: check.expiryDate,
        title: `Right-to-work document ${daysPhrase(days)}`,
        message: buildMessage(`${check.Employee.firstName} ${check.Employee.lastName}'s right-to-work permission`, days),
        actionRequired: 'Review required',
        assignedToRoleKey: 'HR_MANAGER',
      })
    );
  }
  return results.filter(Boolean);
}

/** Current (isCurrent:true) visa_records drive this, separately from any uploaded 'visa' Document's own expiry below. */
async function syncVisaRecordAlerts() {
  const records = await VisaRecord.findAll({
    where: { isCurrent: true, expiryDate: { [Op.ne]: null } },
    include: [{ model: Employee, where: { employmentStatus: 'active' }, attributes: ['id', 'companyId', 'firstName', 'lastName'] }],
  });

  const results = [];
  for (const record of records) {
    const days = daysUntil(record.expiryDate);
    const severity = classifyByDays(days, { mediumDays: 90, highDays: 30 });
    results.push(
      await upsertAlert({
        alertType: 'visa_expiry',
        sourceType: 'VisaRecord',
        sourceId: record.id,
        employeeId: record.employeeId,
        companyId: record.Employee.companyId,
        severity,
        dueDate: record.expiryDate,
        title: `${record.Employee.firstName} ${record.Employee.lastName}'s visa ${daysPhrase(days)}`,
        message: buildMessage(`Visa (${record.visaType || 'unspecified type'})`, days),
        actionRequired: 'Review required',
        assignedToRoleKey: 'HR_MANAGER',
      })
    );
  }
  return results.filter(Boolean);
}

/** Current (isCurrent:true) identity_documents (passports/national ID/BRP) drive this. */
async function syncIdentityDocumentAlerts() {
  const documents = await IdentityDocument.findAll({
    where: { isCurrent: true, expiryDate: { [Op.ne]: null } },
    include: [{ model: Employee, where: { employmentStatus: 'active' }, attributes: ['id', 'companyId', 'firstName', 'lastName'] }],
  });

  const results = [];
  for (const doc of documents) {
    const days = daysUntil(doc.expiryDate);
    const severity = classifyByDays(days, { mediumDays: 90, highDays: 30 });
    results.push(
      await upsertAlert({
        alertType: 'passport_expiry',
        sourceType: 'IdentityDocument',
        sourceId: doc.id,
        employeeId: doc.employeeId,
        companyId: doc.Employee.companyId,
        severity,
        dueDate: doc.expiryDate,
        title: `${doc.Employee.firstName} ${doc.Employee.lastName}'s ${doc.type.replace(/_/g, ' ')} ${daysPhrase(days)}`,
        message: buildMessage(doc.type.replace(/_/g, ' '), days),
        actionRequired: 'Review and renew document',
        assignedToRoleKey: 'HR_MANAGER',
      })
    );
  }
  return results.filter(Boolean);
}

async function syncDocumentAlerts() {
  const documents = await Document.findAll({
    where: { expiryDate: { [Op.ne]: null }, isCurrent: true },
    include: [{ model: Employee, where: { employmentStatus: 'active' }, attributes: ['id', 'companyId', 'firstName', 'lastName'] }],
  });

  const results = [];
  for (const doc of documents) {
    const days = daysUntil(doc.expiryDate);
    const isVisaEvidence = ['visa', 'right_to_work_evidence'].includes(doc.documentType);
    const isTraining = ['training_record', 'certificate', 'qualification'].includes(doc.documentType);

    const alertType = doc.documentType === 'visa' ? 'visa_expiry' : isTraining ? 'training_expiry' : 'document_expiry';
    const severity = classifyByDays(days, isVisaEvidence ? { mediumDays: 90, highDays: 30 } : { mediumDays: 60, highDays: 14 });

    results.push(
      await upsertAlert({
        alertType,
        sourceType: 'Document',
        sourceId: doc.id,
        employeeId: doc.employeeId,
        companyId: doc.Employee.companyId,
        severity,
        dueDate: doc.expiryDate,
        title: `${doc.Employee.firstName} ${doc.Employee.lastName}'s ${doc.documentType.replace(/_/g, ' ')} ${daysPhrase(days)}`,
        message: buildMessage(`Document (${doc.documentType})`, days),
        actionRequired: 'Review and renew document',
        assignedToRoleKey: 'HR_MANAGER',
      })
    );
  }
  return results.filter(Boolean);
}

async function syncMissingDocumentAlerts() {
  const employees = await Employee.findAll({
    where: { employmentStatus: 'active' },
    include: [{ model: Document, where: { isCurrent: true }, required: false, attributes: ['documentType'] }],
  });

  const results = [];
  for (const employee of employees) {
    const heldTypes = new Set(employee.Documents.map((d) => d.documentType));
    const missing = REQUIRED_DOCUMENT_TYPES.filter((type) => !heldTypes.has(type));

    for (const type of REQUIRED_DOCUMENT_TYPES) {
      const isMissing = missing.includes(type);
      results.push(
        await upsertAlert({
          alertType: 'missing_document',
          sourceType: 'Employee',
          sourceId: `${employee.id}:${type}`, // composite - one alert per (employee, required type)
          employeeId: employee.id,
          companyId: employee.companyId,
          severity: isMissing ? (type === 'right_to_work_evidence' ? 'critical' : 'high') : null,
          dueDate: null,
          title: `${employee.firstName} ${employee.lastName} is missing ${type.replace(/_/g, ' ')}`,
          message: `Required document '${type}' has not been uploaded`,
          actionRequired: 'Request document from employee',
          assignedToRoleKey: 'HR_MANAGER',
        })
      );
    }
  }
  return results.filter(Boolean);
}

async function syncProbationAndContractAlerts() {
  const employees = await Employee.findAll({
    where: {
      employmentStatus: 'active',
      [Op.or]: [{ probationEndDate: { [Op.ne]: null } }, { contractEndDate: { [Op.ne]: null } }],
    },
  });

  const results = [];
  for (const employee of employees) {
    if (employee.probationEndDate) {
      const days = daysUntil(employee.probationEndDate);
      results.push(
        await upsertAlert({
          alertType: 'probation_ending',
          sourceType: 'Employee',
          sourceId: `${employee.id}:probation`,
          employeeId: employee.id,
          companyId: employee.companyId,
          severity: classifyByDays(days, { mediumDays: 30, highDays: 7 }),
          dueDate: employee.probationEndDate,
          title: `${employee.firstName} ${employee.lastName}'s probation ${days < 0 ? `ended ${Math.abs(days)} day(s) ago` : `ends in ${days} day(s)`}`,
          message: buildMessage('Probation period', days),
          actionRequired: 'Complete probation review',
          assignedToRoleKey: 'MANAGER',
        })
      );
    }
    if (employee.contractEndDate) {
      const days = daysUntil(employee.contractEndDate);
      results.push(
        await upsertAlert({
          alertType: 'contract_ending',
          sourceType: 'Employee',
          sourceId: `${employee.id}:contract`,
          employeeId: employee.id,
          companyId: employee.companyId,
          severity: classifyByDays(days, { mediumDays: 60, highDays: 14 }),
          dueDate: employee.contractEndDate,
          title: `${employee.firstName} ${employee.lastName}'s fixed-term contract ${days < 0 ? `ended ${Math.abs(days)} day(s) ago` : `ends in ${days} day(s)`}`,
          message: buildMessage('Fixed-term contract', days),
          actionRequired: 'Decide on renewal/termination',
          assignedToRoleKey: 'HR_MANAGER',
        })
      );
    }
  }
  return results.filter(Boolean);
}

/** Flags employees who've had repeated absence periods in a short window. */
async function syncAbsenceThresholdAlerts() {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - ABSENCE_THRESHOLD_WINDOW_DAYS);

  const employees = await Employee.findAll({ where: { employmentStatus: 'active' } });

  const results = [];
  for (const employee of employees) {
    const count = await Absence.count({
      where: { employeeId: employee.id, absenceType: { [Op.ne]: 'unauthorised' }, startDate: { [Op.gte]: windowStart } },
    });

    results.push(
      await upsertAlert({
        alertType: 'absence_threshold',
        sourceType: 'Employee',
        sourceId: `${employee.id}:absence_threshold`,
        employeeId: employee.id,
        companyId: employee.companyId,
        severity: count >= ABSENCE_THRESHOLD_COUNT ? 'medium' : null,
        dueDate: null,
        title: `${employee.firstName} ${employee.lastName} has had ${count} absence period(s) in the last ${ABSENCE_THRESHOLD_WINDOW_DAYS} days`,
        message: `Absence count (${count}) reached the review threshold (${ABSENCE_THRESHOLD_COUNT})`,
        actionRequired: 'Consider a return-to-work / welfare review',
        assignedToRoleKey: 'HR_MANAGER',
      })
    );
  }
  return results.filter(Boolean);
}

/** Notification-style alert raised when a holiday request needs review; resolved once it leaves the pipeline. */
async function upsertHolidayRequestAlert(request) {
  const employee = await Employee.findByPk(request.employeeId, { attributes: ['id', 'companyId', 'firstName', 'lastName'] });
  const isPending = ['pending_manager', 'pending_hr'].includes(request.status);

  return upsertAlert({
    alertType: 'holiday_request',
    sourceType: 'HolidayRequest',
    sourceId: request.id,
    employeeId: request.employeeId,
    companyId: employee.companyId,
    severity: isPending ? 'info' : null,
    dueDate: request.startDate,
    title: `${employee.firstName} ${employee.lastName} has a holiday request awaiting ${request.status === 'pending_hr' ? 'HR confirmation' : 'manager approval'}`,
    message: `${request.totalDays} day(s) requested from ${request.startDate}`,
    actionRequired: request.status === 'pending_hr' ? 'HR confirmation required' : 'Manager approval required',
    assignedToRoleKey: request.status === 'pending_hr' ? 'HR_MANAGER' : 'MANAGER',
  });
}

/** Same pattern for absences that still need manager sign-off. */
async function upsertSickLeaveAlert(absence) {
  const employee = await Employee.findByPk(absence.employeeId, { attributes: ['id', 'companyId', 'firstName', 'lastName'] });
  const needsReview = absence.status === 'open' && !absence.approvedByUserId;

  return upsertAlert({
    alertType: 'sick_leave',
    sourceType: 'Absence',
    sourceId: absence.id,
    employeeId: absence.employeeId,
    companyId: employee.companyId,
    severity: needsReview ? 'info' : null,
    dueDate: absence.startDate,
    title: `${employee.firstName} ${employee.lastName}'s ${absence.absenceType.replace(/_/g, ' ')} needs review`,
    message: `Absence recorded from ${absence.startDate}${absence.endDate ? ` to ${absence.endDate}` : ' (ongoing)'}`,
    actionRequired: 'Manager review required',
    assignedToRoleKey: 'MANAGER',
  });
}

/** Ad-hoc alert raised directly by HR - not derived from any other record. */
async function createComplianceTaskAlert({ companyId, employeeId, severity, title, message, actionRequired, assignedToRoleKey, dueDate }) {
  return Alert.create({
    alertType: 'compliance_task',
    sourceType: null,
    sourceId: null,
    companyId,
    employeeId: employeeId || null,
    severity,
    title,
    message,
    actionRequired,
    assignedToRoleKey,
    dueDate,
    status: 'open',
  });
}

async function syncAllAlerts() {
  const [rtw, docs, missing, endings, absenceThreshold, visas, identityDocuments] = await Promise.all([
    syncRightToWorkAlerts(),
    syncDocumentAlerts(),
    syncMissingDocumentAlerts(),
    syncProbationAndContractAlerts(),
    syncAbsenceThresholdAlerts(),
    syncVisaRecordAlerts(),
    syncIdentityDocumentAlerts(),
  ]);
  return {
    rightToWork: rtw.length,
    documents: docs.length,
    missingDocuments: missing.length,
    probationAndContract: endings.length,
    absenceThreshold: absenceThreshold.length,
    visaRecords: visas.length,
    identityDocuments: identityDocuments.length,
  };
}

module.exports = {
  syncRightToWorkAlerts,
  syncDocumentAlerts,
  syncMissingDocumentAlerts,
  syncProbationAndContractAlerts,
  syncAbsenceThresholdAlerts,
  syncVisaRecordAlerts,
  syncIdentityDocumentAlerts,
  upsertHolidayRequestAlert,
  upsertSickLeaveAlert,
  createComplianceTaskAlert,
  syncAllAlerts,
  daysUntil,
  classifyByDays,
  REQUIRED_DOCUMENT_TYPES,
};
