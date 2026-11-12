const { Op } = require('sequelize');
const { EmployeeContractHistory, Employee, VisaRecord, IdentityDocument, Alert } = require('../models');

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function resolveAlertsFor(sourceType, sourceId) {
  await Alert.update({ status: 'resolved' }, { where: { sourceType, sourceId, status: { [Op.ne]: 'resolved' } } });
}

/**
 * Promotes a contract-history version: mirrors its fields onto the live
 * Employee row (so every existing report/list/page that reads Employee
 * directly keeps working unchanged) and closes out whichever version was
 * previously open-ended. Called synchronously from the controller when
 * `effectiveFrom <= today`, or by activateDueChanges() below once a
 * scheduled effectiveFrom arrives.
 */
async function promoteContractVersion(version) {
  const previous = await EmployeeContractHistory.findOne({
    where: { employeeId: version.employeeId, isCurrent: true, id: { [Op.ne]: version.id } },
  });
  if (previous) {
    const dayBefore = new Date(version.effectiveFrom);
    dayBefore.setDate(dayBefore.getDate() - 1);
    await previous.update({ isCurrent: false, effectiveTo: dayBefore.toISOString().slice(0, 10) });
  }
  await version.update({ isCurrent: true });
  await Employee.update(
    {
      jobTitle: version.jobTitle,
      salary: version.salary,
      contractedHoursPerWeek: version.contractedHoursPerWeek,
      contractEndDate: version.contractEndDate,
      workLocation: version.workLocation,
    },
    { where: { id: version.employeeId } }
  );
  return version;
}

/** Same promotion shape for visas: close the old current record's open alerts, then flip isCurrent. */
async function promoteVisaRecord(record) {
  const previous = await VisaRecord.findOne({
    where: { employeeId: record.employeeId, isCurrent: true, id: { [Op.ne]: record.id } },
  });
  if (previous) {
    await previous.update({ isCurrent: false });
    await resolveAlertsFor('VisaRecord', previous.id);
  }
  await record.update({ isCurrent: true, supersedesCurrent: false });
  return record;
}

/** Same shape again for passports/identity documents, scoped per (employeeId, type) so a passport renewal doesn't affect a BRP record. */
async function promoteIdentityDocument(doc) {
  const previous = await IdentityDocument.findOne({
    where: { employeeId: doc.employeeId, type: doc.type, isCurrent: true, id: { [Op.ne]: doc.id } },
  });
  if (previous) {
    await previous.update({ isCurrent: false });
    await resolveAlertsFor('IdentityDocument', previous.id);
  }
  await doc.update({ isCurrent: true, supersedesCurrent: false });
  return doc;
}

/** Promotes a freshly-created record immediately if its trigger date is today/past; otherwise leaves it scheduled for the daily sweep. */
async function promoteContractVersionIfDue(version) {
  if (version.effectiveFrom <= today()) return promoteContractVersion(version);
  return version;
}
async function promoteVisaRecordIfDue(record) {
  if (record.supersedesCurrent && record.startDate && record.startDate <= today()) return promoteVisaRecord(record);
  return record;
}
async function promoteIdentityDocumentIfDue(doc) {
  if (doc.supersedesCurrent && doc.issueDate && doc.issueDate <= today()) return promoteIdentityDocument(doc);
  return doc;
}

/**
 * Daily sweep (see jobs/scheduledChangesCron.js): promotes every scheduled
 * change whose trigger date has arrived or passed. Uses `<=`, not `=`, so
 * a day the cron didn't run (deploy, outage) still gets caught up on the
 * next run - idempotent either way, since each query only matches rows
 * that are still `isCurrent: false`.
 */
async function activateDueChanges() {
  const t = today();

  const dueContracts = await EmployeeContractHistory.findAll({
    where: { effectiveFrom: { [Op.lte]: t }, isCurrent: false },
    order: [['effectiveFrom', 'ASC']],
  });
  for (const version of dueContracts) await promoteContractVersion(version);

  const dueVisas = await VisaRecord.findAll({
    where: { supersedesCurrent: true, isCurrent: false, startDate: { [Op.lte]: t } },
    order: [['startDate', 'ASC']],
  });
  for (const record of dueVisas) await promoteVisaRecord(record);

  const dueIdentityDocuments = await IdentityDocument.findAll({
    where: { supersedesCurrent: true, isCurrent: false, issueDate: { [Op.lte]: t } },
    order: [['issueDate', 'ASC']],
  });
  for (const doc of dueIdentityDocuments) await promoteIdentityDocument(doc);

  return {
    contractVersions: dueContracts.length,
    visaRecords: dueVisas.length,
    identityDocuments: dueIdentityDocuments.length,
  };
}

module.exports = {
  promoteContractVersion,
  promoteVisaRecord,
  promoteIdentityDocument,
  promoteContractVersionIfDue,
  promoteVisaRecordIfDue,
  promoteIdentityDocumentIfDue,
  activateDueChanges,
};
