const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * One row per employee per year. `used`/`remaining`/`pending` for the
 * dashboard are intentionally NOT stored here - they're derived on read
 * from approved/pending HolidayRequest rows (see services/holidayService)
 * so there is exactly one source of truth and no risk of the two drifting
 * apart.
 */
class HolidayBalance extends Model {}

HolidayBalance.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    year: { type: DataTypes.INTEGER, allowNull: false },
    annualAllowanceDays: { type: DataTypes.DECIMAL(4, 1), defaultValue: 28 },
    carriedOverDays: { type: DataTypes.DECIMAL(4, 1), defaultValue: 0 },
  },
  {
    sequelize,
    modelName: 'HolidayBalance',
    tableName: 'holiday_balances',
    indexes: [{ unique: true, fields: ['employee_id', 'year'] }],
  }
);

module.exports = HolidayBalance;
