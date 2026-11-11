const { Op } = require('sequelize');
const { Alert, Company, User, Role, SentExpiryAlert } = require('../models');
const { syncRightToWorkAlerts, syncDocumentAlerts, daysUntil } = require('./alertService');
const { sendEmail } = require('./emailService');

// Checked in this order (most urgent first) so a late-run cron still finds
// the single most urgent bucket an item is currently in.
const THRESHOLDS = [
  { key: 'overdue', test: (days) => days < 0 },
  { key: '7', test: (days) => days <= 7 },
  { key: '30', test: (days) => days <= 30 },
  { key: '60', test: (days) => days <= 60 },
  { key: '90', test: (days) => days <= 90 },
];

function determineThreshold(days) {
  const match = THRESHOLDS.find((t) => t.test(days));
  return match ? match.key : null;
}

function describeThreshold(threshold, days) {
  if (threshold === 'overdue') return `overdue by ${Math.abs(days)} day(s)`;
  return `due in ${days} day(s)`;
}

function buildDigestEmail({ companyName, items }) {
  const rows = items
    .map((item) => `<li><strong>${item.title}</strong> – ${describeThreshold(item.threshold, item.days)} (due ${item.dueDate})</li>`)
    .join('');
  const textRows = items.map((item) => `- ${item.title} – ${describeThreshold(item.threshold, item.days)} (due ${item.dueDate})`).join('\n');

  return {
    subject: `${companyName}: ${items.length} compliance item(s) need attention`,
    html: `<p>The following right-to-work, visa, and document expiries for <strong>${companyName}</strong> need attention:</p><ul>${rows}</ul>`,
    text: `The following right-to-work, visa, and document expiries for ${companyName} need attention:\n\n${textRows}`,
  };
}

/**
 * Finds open right-to-work/visa/document-expiry alerts that have just
 * crossed a 90/60/30/7-day-or-overdue threshold, sends one digest email
 * per affected company to its Employer Admin + HR Manager users, and
 * records each (item, threshold) pair sent so it is never emailed again -
 * see models/SentExpiryAlert.js. `sendEmailFn` is injectable for tests.
 */
async function runExpiryAlertEmailJob({ sendEmailFn = sendEmail } = {}) {
  await Promise.all([syncRightToWorkAlerts(), syncDocumentAlerts()]);

  const alerts = await Alert.findAll({
    where: {
      sourceType: { [Op.in]: ['RightToWorkCheck', 'Document'] },
      status: { [Op.ne]: 'resolved' },
      dueDate: { [Op.ne]: null },
    },
  });

  const byCompany = new Map();
  for (const alert of alerts) {
    const days = daysUntil(alert.dueDate);
    const threshold = determineThreshold(days);
    if (!threshold) continue;

    const already = await SentExpiryAlert.findOne({
      where: { sourceType: alert.sourceType, sourceId: String(alert.sourceId), threshold },
    });
    if (already) continue;

    if (!byCompany.has(alert.companyId)) byCompany.set(alert.companyId, []);
    byCompany.get(alert.companyId).push({
      sourceType: alert.sourceType,
      sourceId: String(alert.sourceId),
      threshold,
      days,
      title: alert.title,
      dueDate: alert.dueDate,
    });
  }

  const summary = { companiesProcessed: 0, emailsSent: 0, itemsEmailed: 0, skippedNoRecipients: 0, skippedNotSent: 0 };

  for (const [companyId, items] of byCompany) {
    summary.companiesProcessed += 1;
    const company = await Company.findByPk(companyId);
    if (!company) continue;

    const recipients = await User.findAll({
      where: { companyId, isActive: true },
      include: [{ model: Role, where: { key: { [Op.in]: ['EMPLOYER_ADMIN', 'HR_MANAGER'] } } }],
      attributes: ['email'],
    });
    const to = recipients.map((u) => u.email);

    if (to.length === 0) {
      summary.skippedNoRecipients += items.length;
      continue;
    }

    const { subject, html, text } = buildDigestEmail({ companyName: company.name, items });

    let result;
    try {
      result = await sendEmailFn({ to, subject, html, text });
    } catch (err) {
      console.error(`Expiry alert email failed for company ${companyId}:`, err.message);
      summary.skippedNotSent += items.length;
      continue;
    }

    if (!result.sent) {
      console.warn(`Expiry alert email skipped for company ${companyId}: ${result.reason}`);
      summary.skippedNotSent += items.length;
      continue;
    }

    await SentExpiryAlert.bulkCreate(
      items.map((item) => ({ sourceType: item.sourceType, sourceId: item.sourceId, threshold: item.threshold, companyId })),
      { ignoreDuplicates: true }
    );

    summary.emailsSent += 1;
    summary.itemsEmailed += items.length;
  }

  return summary;
}

module.exports = { runExpiryAlertEmailJob, determineThreshold };
