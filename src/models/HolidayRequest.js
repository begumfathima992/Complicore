const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Holiday Balance -> Request Holiday -> Manager Approval -> HR Confirmation
 * -> Calendar Updated.
 *
 * `status` walks that pipeline: pending_manager -> pending_hr -> approved
 * (or rejected/cancelled at either stage). "Calendar Updated" is realised
 * by the roster's conflict detection reading approved requests directly
 * (see services/rosterService.js) rather than duplicating the dates into a
 * separate calendar table.
 */
class HolidayRequest extends Model {}

HolidayRequest.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    startDate: { type: DataTypes.DATEONLY, allowNull: false },
    endDate: { type: DataTypes.DATEONLY, allowNull: false },
    totalDays: { type: DataTypes.DECIMAL(4, 1), allowNull: false },
    reason: { type: DataTypes.STRING },
    status: {
      type: DataTypes.ENUM('pending_manager', 'pending_hr', 'approved', 'rejected', 'cancelled'),
      defaultValue: 'pending_manager',
    },
    managerReviewedAt: { type: DataTypes.DATE },
    hrConfirmedAt: { type: DataTypes.DATE },
    rejectionReason: { type: DataTypes.STRING },
  },
  { sequelize, modelName: 'HolidayRequest', tableName: 'holiday_requests' }
);

module.exports = HolidayRequest;
