const crypto = require('crypto');
const { AuditLog } = require('../models');

/**
 * Canonical, order-stable serialization of the fields that go into the
 * hash - must exactly match what verifyIntegrity() recomputes.
 */
function canonicalPayload(row) {
  return JSON.stringify({
    entityType: row.entityType,
    entityId: row.entityId,
    action: row.action,
    fieldName: row.fieldName ?? null,
    oldValue: row.oldValue ?? null,
    newValue: row.newValue ?? null,
    performedByUserId: row.performedByUserId ?? null,
    performedByRoleKey: row.performedByRoleKey,
    employeeId: row.employeeId ?? null,
    companyId: row.companyId,
    previousHash: row.previousHash ?? '',
  });
}

function computeHash(row) {
  return crypto.createHash('sha256').update(canonicalPayload(row)).digest('hex');
}

/**
 * Appends one audit row, chained to the single most recent row across the
 * whole table (a global chain, not per-company - it's simpler to verify
 * and a cross-tenant chain is still meaningful evidence of no tampering).
 * Never call AuditLog.create()/update()/destroy() directly elsewhere -
 * always go through this so the chain stays intact.
 */
async function recordAudit({
  entityType,
  entityId,
  action,
  fieldName = null,
  oldValue = null,
  newValue = null,
  performedByUserId = null,
  performedByRoleKey,
  employeeId = null,
  companyId,
  ipAddress = null,
  userAgent = null,
}) {
  const last = await AuditLog.findOne({ order: [['createdAt', 'DESC']] });
  const previousHash = last ? last.hash : null;

  const row = {
    entityType,
    entityId,
    action,
    fieldName,
    oldValue: oldValue == null ? null : String(oldValue),
    newValue: newValue == null ? null : String(newValue),
    performedByUserId,
    performedByRoleKey,
    employeeId,
    companyId,
    ipAddress,
    userAgent,
    previousHash,
  };
  row.hash = computeHash(row);

  return AuditLog.create(row);
}

/**
 * Snapshots the fields about to change - MUST be called BEFORE
 * `instance.update(updates)`. (Sequelize's own `instance.previous(field)`
 * looks like it would do this, but it doesn't survive a completed
 * `.update()` call - Sequelize resets that tracking once the save
 * succeeds, so reading it afterward silently returns the *new* value for
 * both "old" and "new" and every change looks like a no-op. Capturing the
 * diff ourselves, before the write, sidesteps that entirely.)
 */
function snapshotChanges(instance, updates) {
  return Object.keys(updates)
    .map((field) => ({ field, oldValue: instance.get(field), newValue: updates[field] }))
    .filter(({ oldValue, newValue }) => oldValue !== newValue);
}

/**
 * Records one AuditLog row per changed field from a snapshotChanges()
 * result - call AFTER `instance.update(updates)` has succeeded. Matches
 * the "Role changed: Old: Care Worker / New: Senior Care Worker" example.
 */
async function recordFieldChanges(entityType, entityId, changes, { performedByUserId, performedByRoleKey, employeeId, companyId, ipAddress, userAgent }) {
  const rows = [];
  for (const { field, oldValue, newValue } of changes) {
    rows.push(
      await recordAudit({
        entityType,
        entityId,
        action: 'update',
        fieldName: field,
        oldValue,
        newValue,
        performedByUserId,
        performedByRoleKey,
        employeeId,
        companyId,
        ipAddress,
        userAgent,
      })
    );
  }
  return rows;
}

/** Walks the whole chain in order and confirms no row has been altered or removed. */
async function verifyIntegrity() {
  const rows = await AuditLog.findAll({ order: [['createdAt', 'ASC']] });

  let expectedPreviousHash = null;
  for (const row of rows) {
    if (row.previousHash !== expectedPreviousHash) {
      return { valid: false, brokenAtId: row.id, reason: 'previousHash does not match the prior row' };
    }
    const recomputed = computeHash(row);
    if (recomputed !== row.hash) {
      return { valid: false, brokenAtId: row.id, reason: 'stored hash does not match recomputed hash' };
    }
    expectedPreviousHash = row.hash;
  }

  return { valid: true, rowsChecked: rows.length };
}

/** Common WHO/WHERE fields pulled from the request, for controllers to spread into the calls above. */
function actorContextFrom(req) {
  return {
    performedByUserId: req.user.id,
    performedByRoleKey: req.user.role,
    companyId: req.user.companyId,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
}

module.exports = { recordAudit, snapshotChanges, recordFieldChanges, verifyIntegrity, actorContextFrom };
