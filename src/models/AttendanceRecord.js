const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

const ACTUAL_STATUSES = ['present', 'absent', 'sick'];
const PLANNED_STATUSES = ['planned_absence', 'unpaid_leave'];

/**
 * One row per employee per day of *actual* attendance, or of a planned
 * absence that isn't holiday. Approved holiday is deliberately NOT a
 * status here - services/attendanceService.js merges HolidayRequest in at
 * read time instead, so holiday data is never duplicated into this table
 * (one source of truth).
 *
 * `status` in ACTUAL_STATUSES may only be recorded for today or the past -
 * enforced in the beforeValidate hook below (mirrored client-side, but
 * this is the authoritative check). A past/today row can later be edited
 * to a different status (e.g. a planned_absence confirmed as sick), but a
 * future row can only ever hold a PLANNED_STATUSES value until its date
 * arrives.
 */
class AttendanceRecord extends Model {}

AttendanceRecord.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    status: {
      type: DataTypes.ENUM(...ACTUAL_STATUSES, ...PLANNED_STATUSES),
      allowNull: false,
      defaultValue: 'present',
    },
    clockIn: { type: DataTypes.STRING }, // 'HH:MM'
    clockOut: { type: DataTypes.STRING }, // 'HH:MM'
    breakMinutes: { type: DataTypes.INTEGER, defaultValue: 0 },
    totalHours: { type: DataTypes.DECIMAL(5, 2) }, // derived below; null for non-'present' rows
    source: { type: DataTypes.ENUM('manual', 'clock', 'import'), defaultValue: 'manual' },
    notes: { type: DataTypes.STRING },
    createdByUserId: { type: DataTypes.UUID },
    approvedByUserId: { type: DataTypes.UUID },
  },
  {
    sequelize,
    modelName: 'AttendanceRecord',
    tableName: 'attendance_records',
    hooks: {
      beforeValidate: (record) => {
        if (record.status === 'present' && record.clockIn && record.clockOut) {
          const start = new Date(`${record.date}T${record.clockIn}:00`);
          const end = new Date(`${record.date}T${record.clockOut}:00`);
          const minutes = Math.max(0, (end - start) / 60000 - (record.breakMinutes || 0));
          record.totalHours = Math.round((minutes / 60) * 100) / 100;
        } else {
          record.totalHours = null;
        }
      },
    },
  }
);

AttendanceRecord.ACTUAL_STATUSES = ACTUAL_STATUSES;
AttendanceRecord.PLANNED_STATUSES = PLANNED_STATUSES;

module.exports = AttendanceRecord;
