const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');
const { ROLES } = require('../config/permissions');

class Role extends Model {}

Role.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    key: {
      type: DataTypes.ENUM(...Object.keys(ROLES)),
      allowNull: false,
      unique: true,
    },
    name: { type: DataTypes.STRING, allowNull: false },
    level: { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, modelName: 'Role', tableName: 'roles' }
);

module.exports = Role;
