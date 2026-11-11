/**
 * Builds a migration's up()/down() from an already-associated Sequelize
 * model (imported via ../../src/models, so every belongsTo-added FK
 * column - companyId, employeeId, managerId, etc. - is already present on
 * model.getAttributes()) rather than hand-transcribing column
 * definitions. The model stays the single source of truth for the
 * schema; this just lets that same definition drive a real, versioned
 * migration instead of sync({ alter: true }).
 */
function createTableFromModel(Model) {
  return {
    async up(queryInterface) {
      await queryInterface.createTable(Model.getTableName(), Model.getAttributes());
    },
    async down(queryInterface) {
      await queryInterface.dropTable(Model.getTableName());
    },
  };
}

module.exports = { createTableFromModel };
