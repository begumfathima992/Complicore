require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const rightToWorkRoutes = require('./routes/rightToWorkRoutes');
const documentRoutes = require('./routes/documentRoutes');
const changeOfCircumstanceRoutes = require('./routes/changeOfCircumstanceRoutes');
const alertRoutes = require('./routes/alertRoutes');
const shiftRoutes = require('./routes/shiftRoutes');
const holidayRoutes = require('./routes/holidayRoutes');
const absenceRoutes = require('./routes/absenceRoutes');
const roleRoutes = require('./routes/roleRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const reportRoutes = require('./routes/reportRoutes');
const auditRoutes = require('./routes/auditRoutes');
const emergencyContactRoutes = require('./routes/emergencyContactRoutes');
const companyRoutes = require('./routes/companyRoutes');
const userRoutes = require('./routes/userRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const importRoutes = require('./routes/importRoutes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
// SITE_ORIGIN restricts CORS to the deployed frontend in production; with
// it unset (local dev) all origins are allowed, same as before.
app.use(cors(process.env.SITE_ORIGIN ? { origin: process.env.SITE_ORIGIN } : {}));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
// Render's health check convention lives under /api/*; kept alongside the
// original /health rather than replacing it, since nothing else referenced
// /health needed to change.
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/right-to-work-checks', rightToWorkRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/change-of-circumstances', changeOfCircumstanceRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/holiday', holidayRoutes);
app.use('/api/absences', absenceRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditRoutes);
app.use('/api/emergency-contacts', emergencyContactRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/import', importRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = app;
