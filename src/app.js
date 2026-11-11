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
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

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

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = app;
