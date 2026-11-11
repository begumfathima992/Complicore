import { useState } from 'react';
import { useApiData } from '../hooks/useApiData';
import { alertsApi } from '../api';
import { Loading, ErrorBanner, SuccessBanner } from '../components/Feedback';
import { SeverityBadge, StatusBadge } from '../components/Badges';
import DataTable from '../components/DataTable';
import { ApiError } from '../api/client';

const SEVERITIES = ['info', 'low', 'medium', 'high', 'critical'];

export default function AlertsPage() {
  const [severity, setSeverity] = useState('');
  const { data, loading, error, reload } = useApiData(() => alertsApi.list(severity ? { severity } : undefined), [severity]);

  const [actionError, setActionError] = useState(null);
  const [syncMessage, setSyncMessage] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const act = async (fn) => {
    setActionError(null);
    try {
      await fn();
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err : new Error('Action failed'));
    }
  };

  const handleSync = async () => {
    setSyncMessage(null);
    setActionError(null);
    setSyncing(true);
    try {
      const result = await alertsApi.sync();
      const summary = Object.entries(result.synced)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      setSyncMessage(`Alert sweep complete (${summary}).`);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err : new Error('Sync failed'));
    } finally {
      setSyncing(false);
    }
  };

  const columns = [
    { key: 'severity', label: 'Severity', render: (row) => <SeverityBadge severity={row.severity} /> },
    { key: 'title', label: 'Title' },
    { key: 'employee', label: 'Employee', render: (row) => (row.Employee ? `${row.Employee.firstName} ${row.Employee.lastName}` : '—') },
    { key: 'alertType', label: 'Type', render: (row) => row.alertType.replace(/_/g, ' ') },
    { key: 'dueDate', label: 'Due Date' },
    { key: 'actionRequired', label: 'Action Required' },
    { key: 'assignedToRoleKey', label: 'Assigned To' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="btn-row">
          {row.status === 'open' && (
            <button type="button" className="btn btn-small btn-secondary" onClick={() => act(() => alertsApi.acknowledge(row.id))}>
              Acknowledge
            </button>
          )}
          {row.status !== 'resolved' && (
            <button type="button" className="btn btn-small btn-success" onClick={() => act(() => alertsApi.resolve(row.id))}>
              Resolve
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Alerts</h1>
          <p className="page-subtitle">
            Compliance alerts across right-to-work, documents, holiday/absence requests, probation and contract
            endings. An alert existing is a reminder only, never proof of compliance.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={handleSync} disabled={syncing}>
          {syncing ? 'Syncing…' : 'Run alert sweep'}
        </button>
      </div>

      <SuccessBanner message={syncMessage} />
      <ErrorBanner error={actionError} />

      <div className="filter-bar">
        <div className="field">
          <label>Severity</label>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="">All</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <Loading />}
      <ErrorBanner error={error} />
      {data && <DataTable columns={columns} rows={data.alerts} emptyLabel="No open alerts." />}
    </div>
  );
}
