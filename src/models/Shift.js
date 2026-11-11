const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

/**
 * A single roster shift. `startsAt`/`endsAt` are full timestamps (derived
 * from shiftDate + startTime/endTime below) so overlap/conflict checks work
 * correctly even for overnight shifts like 16:00-00:00 - `endsAt` rolls
 * onto the next calendar day whenever endTime <= startTime.
 * `shiftDate`/`startTime`/`endTime` are kept as separate display fields
 * because a calendar-style roster UI groups and renders by those, not by
 * the underlying timestamps.
 */
class Shift extends Model {}

Shift.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    shiftDate: { type: DataTypes.DATEONLY, allowNull: false },
    startTime: { type: DataTypes.STRING, allowNull: false }, // 'HH:MM'
    endTime: { type: DataTypes.STRING, allowNull: false }, // 'HH:MM'
    startsAt: { type: DataTypes.DATE, allowNull: false },
    endsAt: { type: DataTypes.DATE, allowNull: false },
    role: { type: DataTypes.STRING }, // e.g. "Reception", "Kitchen" - the position being covered
    status: {
      type: DataTypes.ENUM('draft', 'published', 'approved'),
      defaultValue: 'draft',
    },
    notes: { type: DataTypes.STRING },
  },
  {
    sequelize,
    modelName: 'Shift',
    tableName: 'shifts',
    hooks: {
      beforeValidate: (shift) => {
        if (shift.shiftDate && shift.startTime && shift.endTime) {
          const start = new Date(`${shift.shiftDate}T${shift.startTime}:00`);
          const end = new Date(`${shift.shiftDate}T${shift.endTime}:00`);
          if (end <= start) end.setDate(end.getDate() + 1); // crosses midnight
          shift.startsAt = start;
          shift.endsAt = end;
        }
      },
    },
  }
);

module.exports = Shift;
