'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // fileUrl held a raw URL/string the client typed in; it now holds an
    // R2 object key (see services/storageService.js) - renamed to make
    // that explicit, not just a comment change. Guarded: on a database
    // that's migrating from scratch, the earlier create-documents
    // migration reads the *current* model (already fileKey by the time
    // this migration was added), so there's nothing to rename there -
    // only a database that ran the original 18 migrations before this
    // one was added (i.e. the already-deployed Neon database) still has
    // the old column name.
    const table = await queryInterface.describeTable('documents');
    if (table.file_url && !table.file_key) {
      await queryInterface.renameColumn('documents', 'file_url', 'file_key');
    }

    // New audit actions for document access, not just document mutation.
    await queryInterface.sequelize.query("ALTER TYPE enum_audit_logs_action ADD VALUE IF NOT EXISTS 'upload'");
    await queryInterface.sequelize.query("ALTER TYPE enum_audit_logs_action ADD VALUE IF NOT EXISTS 'view'");
    await queryInterface.sequelize.query("ALTER TYPE enum_audit_logs_action ADD VALUE IF NOT EXISTS 'download'");
  },

  async down(queryInterface) {
    // Postgres can't drop a single enum value - down() only reverts the
    // column rename; the added action values are left in place (harmless
    // if unused).
    await queryInterface.renameColumn('documents', 'file_key', 'file_url');
  },
};
