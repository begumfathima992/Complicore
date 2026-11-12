// Runs before each test file's modules are required - forces the app onto
// a dedicated, disposable local Postgres database via the discrete DB_*
// vars, never Neon (DATABASE_URL/DIRECT_URL are explicitly blanked so
// config/database.js and sequelizeCliConfig.js both fall back to them).
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = '';
process.env.DIRECT_URL = '';
process.env.DB_HOST = process.env.TEST_DB_HOST || 'localhost';
process.env.DB_PORT = process.env.TEST_DB_PORT || '5432';
process.env.DB_NAME = process.env.TEST_DB_NAME || 'hrms_test';
process.env.DB_USER = process.env.TEST_DB_USER || 'postgres';
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD || 'postgres';
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test_access_secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
// Never hit the real Resend API from a test run - tests that need to
// observe "an email was sent" inject their own sendEmailFn instead.
process.env.RESEND_API_KEY = '';
// Dummy 32-byte key for utils/fieldEncryption.js (VisaRecord.shareCode,
// IdentityDocument.documentNumber) - never the real production key.
process.env.FIELD_ENCRYPTION_KEY = process.env.FIELD_ENCRYPTION_KEY || '0'.repeat(64);
