import { useState } from 'react';
import { useApiData } from '../hooks/useApiData';
import { auditApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Loading, ErrorBanner } from '../components/Feedback';
import DataTable from '../components/DataTable';
import { ApiError } from '../api/client';

const ENTITY_TYPES = ['Employee', 'RightToWorkCheck', 'Document', 'HolidayRequest', 'Absence', 'RolePermissionRestriction'];
const ACTIONS = ['create', 'update', 'delete', 'status_change'];

export default function AuditLogPage() {
  const { user } = useAuth();
  // The hash chain is a single global sequence across every tenant (see
  // backend auditController.js), so verifying it necessarily reports on
  // the whole platform - restricted to Super Admin there, hidden here.
  const canVerify = user.role === 'SUPER_ADMIN';
  const [filters, setFilters] = useState({ entityType: '', action: '', from: '', to: '' });
  const { data, loading, error } = useApiData(() => auditApi.list(filters), [filters.entityType, filters.action, filters.from, filters.to]);

  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyError, setVerifyError] = useState(null);
  const [verifying, setVerifying] = useState(false);

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const handleVerify = async () => {
    setVerifying(true);
    setVerifyError(null);
    setVerifyResult(null);
    try {
      const result = await auditApi.verify();
      setVerifyResult(result);
    } catch (err) {
      setVerifyError(err instanceof ApiError ? err : new Error('Verification failed'));
    } finally {
      setVerifying(false);
    }
  };

  const columns = [
    { key: 'createdAt', label: 'When', render: (row) => new Date(row.createdAt).toLocaleString() },
    { key: 'performedByRoleKey', label: 'Who (role)' },
    { key: 'performedBy', label: 'Who (email)', render: (row) => row.performedBy?.email || '—' },
    { key: 'employee', label: 'Subject', render: (row) => (row.Employee ? `${row.Employee.firstName} ${row.Employee.lastName}` : '—') },
    { key: 'entityType', label: 'Entity' },
    { key: 'action', label: 'Action' },
    { key: 'fieldName', label: 'Field' },
    { key: 'oldValue', label: 'Old Value' },
    { key: 'newValue', label: 'New Value' },
    { key: 'ipAddress', label: 'Where (IP)' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Audit Log</h1>
          <p className="page-subtitle">
            WHO / WHAT / WHEN / WHERE / OLD / NEW for every recorded change. Read-only - entries are written only by
            the backend's own services, never accepted directly from a client, and are chained with a SHA-256 hash so
            tampering is detectable.
          </p>
        </div>
        {canVerify && (
          <button type="button" className="btn btn-secondary" onClick={handleVerify} disabled={verifying}>
            {verifying ? 'Verifying…' : 'Verify Integrity'}
          </button>
        )}
      </div>

      {canVerify && verifyError && <ErrorBanner error={verifyError} />}
      {canVerify && verifyResult && (
        <div className={`feedback ${verifyResult.valid ? 'feedback-success' : 'feedback-error'}`}>
          {verifyResult.valid ? (
            <>✓ Hash chain intact — {verifyResult.rowsChecked} row(s) checked, no tampering detected.</>
          ) : (
            <>
              ✗ Integrity check FAILED at row <code>{verifyResult.brokenAtId}</code>: {verifyResult.reason}
            </>
          )}
        </div>
      )}

      <div className="filter-bar">
        <div className="field">
          <label>Entity type</label>
          <select value={filters.entityType} onChange={(e) => setFilter('entityType', e.target.value)}>
            <option value="">All</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Action</label>
          <select value={filters.action} onChange={(e) => setFilter('action', e.target.value)}>
            <option value="">All</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>From</label>
          <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
        </div>
        <div className="field">
          <label>To</label>
          <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
        </div>
      </div>

      {loading && <Loading />}
      <ErrorBanner error={error} />
      {data && <DataTable columns={columns} rows={data.logs} emptyLabel="No audit log entries match these filters." />}
    </div>
  );
}
