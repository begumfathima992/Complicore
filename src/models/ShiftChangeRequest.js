const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * An employee's request to change a shift they're assigned to. Managers
 * approve/reject; approval is what actually mutates the Shift (see
 * services/rosterService.applyShiftChangeRequest).
 */
class ShiftChangeRequest extends Model {}

ShiftChangeRequest.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    requestType: {
      type: DataTypes.ENUM('swap', 'time_change', 'cancellation'),
      allowNull: false,
    },
    proposedStartTime: { type: DataTypes.STRING }, // 'HH:MM', for time_change
    proposedEndTime: { type: DataTypes.STRING },
    reason: { type: DataTypes.STRING },
    status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
    reviewNotes: { type: DataTypes.STRING },
    reviewedAt: { type: DataTypes.DATE },
  },
  { sequelize, modelName: 'ShiftChangeRequest', tableName: 'shift_change_requests' }
);

module.exports = ShiftChangeRequest;
