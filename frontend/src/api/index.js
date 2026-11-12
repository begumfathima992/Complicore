import { api, uploadImportFile } from './client';

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  changePassword: (currentPassword, newPassword) => api.post('/auth/change-password', { currentPassword, newPassword }),
};

export const companiesApi = {
  list: () => api.get('/companies'),
  get: (id) => api.get(`/companies/${id}`),
  create: (data) => api.post('/companies', data),
  update: (id, data) => api.patch(`/companies/${id}`, data),
};

export const usersApi = {
  list: () => api.get('/users'),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
  deactivate: (id) => api.patch(`/users/${id}/deactivate`, {}),
  reactivate: (id) => api.patch(`/users/${id}/reactivate`, {}),
};

export const dashboardApi = {
  compliance: () => api.get('/dashboard/compliance'),
};

export const employeesApi = {
  list: (search) => api.get('/employees', { search }),
  get: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.patch(`/employees/${id}`, data),
  terminate: (id) => api.delete(`/employees/${id}`),
};

export const rightToWorkApi = {
  list: (employeeId) => api.get('/right-to-work-checks', { employeeId }),
  get: (id) => api.get(`/right-to-work-checks/${id}`),
  create: (data) => api.post('/right-to-work-checks', data),
  update: (id, data) => api.patch(`/right-to-work-checks/${id}`, data),
  getImmigrationDetail: (employeeId) => api.get(`/right-to-work-checks/immigration-detail/${employeeId}`),
  updateImmigrationDetail: (employeeId, data) =>
    api.patch(`/right-to-work-checks/immigration-detail/${employeeId}`, data),
};

export const documentsApi = {
  list: (params) => api.get('/documents', params),
  get: (id) => api.get(`/documents/${id}`),
  getUploadUrl: (data) => api.post('/documents/upload-url', data),
  create: (data) => api.post('/documents', data),
  getViewUrl: (id) => api.get(`/documents/${id}/view-url`),
  getDownloadUrl: (id) => api.get(`/documents/${id}/download-url`),
  update: (id, data) => api.patch(`/documents/${id}`, data),
};

export const changeOfCircumstancesApi = {
  list: (params) => api.get('/change-of-circumstances', params),
  get: (id) => api.get(`/change-of-circumstances/${id}`),
  create: (data) => api.post('/change-of-circumstances', data),
};

export const shiftsApi = {
  list: (params) => api.get('/shifts', params),
  get: (id) => api.get(`/shifts/${id}`),
  create: (data, force) => api.post('/shifts', data, force ? { force: 'true' } : undefined),
  update: (id, data, force) => api.patch(`/shifts/${id}`, data, force ? { force: 'true' } : undefined),
  remove: (id) => api.delete(`/shifts/${id}`),
  availability: (date) => api.get('/shifts/availability', { date }),
  exportCsv: () => api.download('/shifts/export'),
  listChangeRequests: () => api.get('/shifts/change-requests'),
  createChangeRequest: (data) => api.post('/shifts/change-requests', data),
  reviewChangeRequest: (id, decision, reviewNotes) =>
    api.patch(`/shifts/change-requests/${id}`, { decision, reviewNotes }),
};

export const holidayApi = {
  balance: (employeeId, year) => api.get('/holiday/balance', { employeeId, year }),
  list: (params) => api.get('/holiday/requests', params),
  get: (id) => api.get(`/holiday/requests/${id}`),
  create: (data) => api.post('/holiday/requests', data),
  managerApprove: (id, decision, rejectionReason) =>
    api.patch(`/holiday/requests/${id}/manager-approve`, { decision, rejectionReason }),
  hrConfirm: (id, decision, rejectionReason) =>
    api.patch(`/holiday/requests/${id}/hr-confirm`, { decision, rejectionReason }),
  cancel: (id) => api.patch(`/holiday/requests/${id}/cancel`, {}),
};

export const absencesApi = {
  list: (params) => api.get('/absences', params),
  get: (id) => api.get(`/absences/${id}`),
  create: (data) => api.post('/absences', data),
  update: (id, data) => api.patch(`/absences/${id}`, data),
  approve: (id) => api.patch(`/absences/${id}/approve`, {}),
};

export const alertsApi = {
  list: (params) => api.get('/alerts', params),
  create: (data) => api.post('/alerts', data),
  sync: () => api.post('/alerts/sync', {}),
  acknowledge: (id) => api.patch(`/alerts/${id}/acknowledge`, {}),
  resolve: (id) => api.patch(`/alerts/${id}/resolve`, {}),
};

export const reportsApi = {
  list: () => api.get('/reports'),
  run: (key, params) => api.get(`/reports/${key}`, { ...params, format: 'json' }),
  download: (key, format, params) => api.download(`/reports/${key}`, { ...params, format }),
};

export const rolesApi = {
  list: (companyId) => api.get('/roles', companyId ? { companyId } : undefined),
  permissions: (roleKey, companyId) => api.get(`/roles/${roleKey}/permissions`, companyId ? { companyId } : undefined),
  updatePermission: (roleKey, permissionKey, allowed, companyId) =>
    api.patch(`/roles/${roleKey}/permissions`, { permissionKey, allowed, companyId }),
};

export const auditApi = {
  list: (params) => api.get('/audit-logs', params),
  get: (id) => api.get(`/audit-logs/${id}`),
  verify: () => api.get('/audit-logs/verify'),
};

export const attendanceApi = {
  list: (params) => api.get('/attendance', params),
  weekly: (employeeId, weekStart) => api.get('/attendance/weekly', { employeeId, weekStart }),
  upsert: (data) => api.post('/attendance', data),
  approve: (id) => api.patch(`/attendance/${id}/approve`, {}),
  exportFile: (params, format) => api.download('/attendance/export', { ...params, format }),
};

export const contractHistoryApi = {
  list: (employeeId) => api.get(`/employees/${employeeId}/contract-history`),
  create: (employeeId, data) => api.post(`/employees/${employeeId}/contract-history`, data),
};

export const visaRecordsApi = {
  list: (employeeId) => api.get(`/right-to-work-checks/visa-records/${employeeId}`),
  create: (employeeId, data) => api.post(`/right-to-work-checks/visa-records/${employeeId}`, data),
};

export const identityDocumentsApi = {
  list: (employeeId) => api.get(`/right-to-work-checks/identity-documents/${employeeId}`),
  create: (employeeId, data) => api.post(`/right-to-work-checks/identity-documents/${employeeId}`, data),
};

export const importApi = {
  template: () => api.download('/import/template'),
  preview: (sheet, file, companyId) => uploadImportFile('/import/preview', sheet, file, companyId),
  commit: (sheet, file, companyId) => uploadImportFile('/import/commit', sheet, file, companyId),
};

export const emergencyContactsApi = {
  list: (employeeId) => api.get('/emergency-contacts', { employeeId }),
  get: (id) => api.get(`/emergency-contacts/${id}`),
  create: (data) => api.post('/emergency-contacts', data),
  update: (id, data) => api.patch(`/emergency-contacts/${id}`, data),
  remove: (id) => api.delete(`/emergency-contacts/${id}`),
};
