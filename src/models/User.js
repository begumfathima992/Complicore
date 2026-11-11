const { DataTypes, Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');

/**
 * Login/auth identity. Separate from Employee because Super Admins and
 * some Employer Admins may not have an employee record at all.
 */
class User extends Model {
  async validatePassword(plainText) {
    return bcrypt.compare(plainText, this.passwordHash);
  }
}

User.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    lastLoginAt: { type: DataTypes.DATE },
  },
  {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    hooks: {
      beforeCreate: async (user) => {
        if (user.changed('passwordHash')) {
          user.passwordHash = await bcrypt.hash(user.passwordHash, 12);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('passwordHash')) {
          user.passwordHash = await bcrypt.hash(user.passwordHash, 12);
        }
      },
    },
  }
);

module.exports = User;
