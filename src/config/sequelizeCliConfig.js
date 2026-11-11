require('dotenv').config();

// Migrations always run over DIRECT_URL (Neon's unpooled connection -
// pgbouncer's transaction pooling mode doesn't support the prepared
// statements / advisory locks sequelize-cli's migration runner uses).
// Falls back to the discrete DB_* vars for local-only development where
// no Neon URL is configured at all, so `npm run migrate` still works
// against a plain local Postgres.
const sslRequired = /neon\.tech|sslmode=require/.test(process.env.DIRECT_URL || process.env.DB_HOST || '');

const base = process.env.DIRECT_URL
  ? {
      use_env_variable: 'DIRECT_URL',
      dialect: 'postgres',
      dialectOptions: sslRequired ? { ssl: { require: true } } : {},
    }
  : {
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      dialect: 'postgres',
    };

module.exports = {
  development: base,
  test: base,
  production: base,
};
