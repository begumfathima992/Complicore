'use strict';
const { randomUUID } = require('crypto');
const { encryptField } = require('../src/utils/fieldEncryption');

/**
 * One-time backfill: every ImmigrationDetail row that already has a
 * visaType/visaExpiry/shareCode/sponsorshipReference value becomes the
 * initial `isCurrent: true` VisaRecord for that employee - then the four
 * columns are dropped from immigration_details, since VisaRecord is now
 * the source of truth. `startDate` is left null: there is no historical
 * "visa start date" on file for these pre-existing records (confirmed in
 * the earlier field audit - this was never tracked before now).
 */
module.exports = {
  async up(queryInterface) {
    // immigration_details has no company_id of its own (only ImmigrationDetail
    // belongsTo Employee - there's no Company association on this model) -
    // join to employees for it, same as every other denormalized companyId.
    const [rows] = await queryInterface.sequelize.query(`
      SELECT d.id, d.employee_id, e.company_id, d.visa_type, d.visa_expiry, d.share_code, d.sponsorship_reference, d.created_at
      FROM immigration_details d
      JOIN employees e ON e.id = d.employee_id
      WHERE d.visa_type IS NOT NULL OR d.visa_expiry IS NOT NULL OR d.share_code IS NOT NULL OR d.sponsorship_reference IS NOT NULL
    `);

    for (const row of rows) {
      await queryInterface.sequelize.query(
        `INSERT INTO visa_records
           (id, employee_id, company_id, visa_type, share_code, expiry_date, sponsorship_reference, is_current, created_at, updated_at)
         VALUES
           (:id, :employeeId, :companyId, :visaType, :shareCode, :expiryDate, :sponsorshipReference, true, :createdAt, now())`,
        {
          replacements: {
            id: randomUUID(),
            employeeId: row.employee_id,
            companyId: row.company_id,
            visaType: row.visa_type,
            shareCode: row.share_code ? encryptField(row.share_code) : null,
            expiryDate: row.visa_expiry,
            sponsorshipReference: row.sponsorship_reference,
            createdAt: row.created_at,
          },
        }
      );
    }

    await queryInterface.removeColumn('immigration_details', 'visa_type');
    await queryInterface.removeColumn('immigration_details', 'visa_expiry');
    await queryInterface.removeColumn('immigration_details', 'share_code');
    await queryInterface.removeColumn('immigration_details', 'sponsorship_reference');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('immigration_details', 'visa_type', { type: Sequelize.STRING });
    await queryInterface.addColumn('immigration_details', 'visa_expiry', { type: Sequelize.DATEONLY });
    await queryInterface.addColumn('immigration_details', 'share_code', { type: Sequelize.STRING });
    await queryInterface.addColumn('immigration_details', 'sponsorship_reference', { type: Sequelize.STRING });
    // Data is not restored here - visa_records remains the historical
    // record; this just puts the old columns back for a clean rollback.
  },
};
