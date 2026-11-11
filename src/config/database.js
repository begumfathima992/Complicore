require('dotenv').config();
const { Sequelize } = require('sequelize');

const sharedOptions = {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    underscored: true,
    timestamps: true,
  },
  // A pooled Neon connection string already fans out behind pgbouncer, so
  // the app's own pool just needs to be modest - this isn't the only
  // thing holding connections against the database.
  pool: {
    max: Number(process.env.DB_POOL_MAX) || 10,
    min: 0,
    idle: 10000,
    acquire: 30000,
  },
};

// DATABASE_URL (Neon's pooled connection string) is the production path;
// the discrete DB_HOST/PORT/NAME/USER/PASSWORD vars remain a fallback for
// local-only development with a plain Postgres instance and no Neon URL
// configured at all.
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      ...sharedOptions,
      dialectOptions: /sslmode=require|neon\.tech/.test(process.env.DATABASE_URL) ? { ssl: { require: true } } : {},
    })
  : new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
      ...sharedOptions,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
    });

module.exports = sequelize;
