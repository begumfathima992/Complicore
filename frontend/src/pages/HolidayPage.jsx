import { useState } from 'react';
import { useApiData } from '../hooks/useApiData';
import { holidayApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Loading, ErrorBanner, SuccessBanner } from '../components/Feedback';
import { StatusBadge } from '../components/Badges';
import DataTable from '../components/DataTable';
import EmployeePicker from '../components/EmployeePicker';
import { ApiError } from '../api/client';

const EMPTY_FORM = { employeeId: '', startDate: '', endDate: '', reason: '' };

export default function HolidayPage() {
  const { user } = useAuth();
  const canRequestForOthers = ['SUPER_ADMIN', 'EMPLOYER_ADMIN', 'HR_MANAGER'].includes(user.role);
  const canManagerApprove = ['SUPER_ADMIN', 'EMPLOYER_ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user.role);
  const canHrConfirm = ['SUPER_ADMIN', 'EMPLOYER_ADMIN', 'HR_MANAGER'].includes(user.role);

  const { data: balanceData, error: balanceError, loading: balanceLoading } = useApiData(
    () => (user.employeeId ? holidayApi.balance(user.employeeId) : Promise.resolve(null)),
    [user.employeeId]
  );

  const { data, loading, error, reload } = useApiData(() => holidayApi.list(), []);

  const [form, setForm] = useState({ ...EMPTY_FORM, employeeId: user.employeeId || '' });
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    try {
      await holidayApi.create(form);
      setFormSuccess('Holiday request submitted.');
      setForm({ ...EMPTY_FORM, employeeId: user.employeeId || '' });
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err : new Error('Failed to submit request'));
    } finally {
      setSubmitting(false);
    }
  };

  const act = async (fn) => {
    setActionError(null);
    try {
      await fn();
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err : new Error('Action failed'));
    }
  };

  const baseColumns = [
    { key: 'employee', label: 'Employee', render: (row) => (row.Employee ? `${row.Employee.firstName} ${row.Employee.lastName}` : '—') },
    { key: 'startDate', label: 'Start' },
    { key: 'endDate', label: 'End' },
    { key: 'totalDays', label: 'Days' },
    { key: 'reason', label: 'Reason' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  const allRequests = data?.requests || [];
  const pendingManager = allRequests.filter((r) => r.status === 'pending_manager');
  const pendingHr = allRequests.filter((r) => r.status === 'pending_hr');

  const managerColumns = [
    ...baseColumns,
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="btn-row">
          <button type="button" className="btn btn-small btn-success" onClick={() => act(() => holidayApi.managerApprove(row.id, 'approved'))}>
            Approve
          </button>
          <button type="button" className="btn btn-small btn-danger" onClick={() => act(() => holidayApi.managerApprove(row.id, 'rejected'))}>
            Reject
          </button>
        </div>
      ),
    },
  ];

  const hrColumns = [
    ...baseColumns,
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="btn-row">
          <button type="button" className="btn btn-small btn-success" onClick={() => act(() => holidayApi.hrConfirm(row.id, 'approved'))}>
            Confirm
          </button>
          <button type="button" className="btn btn-small btn-danger" onClick={() => act(() => holidayApi.hrConfirm(row.id, 'rejected'))}>
            Reject
          </button>
        </div>
      ),
    },
  ];

  const myColumns = [
    ...baseColumns,
    {
      key: 'actions',
      label: 'Actions',
      render: (row) =>
        ['pending_manager', 'pending_hr'].includes(row.status) && row.employeeId === user.employeeId ? (
          <button type="button" className="btn btn-small btn-secondary" onClick={() => act(() => holidayApi.cancel(row.id))}>
            Cancel
          </button>
        ) : null,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Holiday</h1>
          <p className="page-subtitle">Balance → Request → Manager Approval → HR Confirmation → Calendar Updated.</p>
        </div>
      </div>

      {user.employeeId && (
        <div className="card">
          <h2>My holiday balance</h2>
          {balanceLoading && <Loading />}
          <ErrorBanner error={balanceError} />
          {balanceData && (
            <div className="tile-grid">
              <div className="tile">
                <div className="tile-value">{balanceData.annualAllowance}</div>
                <div className="tile-label">Annual Allowance</div>
              </div>
              <div className="tile">
                <div className="tile-value">{balanceData.used}</div>
                <div className="tile-label">Used</div>
              </div>
              <div className="tile">
                <div className="tile-value">{balanceData.remaining}</div>
                <div className="tile-label">Remaining</div>
              </div>
              <div className="tile">
                <div className="tile-value">{balanceData.pending}</div>
                <div className="tile-label">Pending</div>
              </div>
            </div>
          )}
        </div>
      )}

      <form className="card" onSubmit={handleSubmit}>
        <h2>Request holiday</h2>
        <ErrorBanner error={formError} />
        <SuccessBanner message={formSuccess} />
        <div className="form-grid">
          {canRequestForOthers ? (
            <EmployeePicker value={form.employeeId} onChange={(v) => setField('employeeId', v)} />
          ) : (
            <div className="field">
              <label>Employee</label>
              <input value="Yourself" disabled />
            </div>
          )}
          <div className="field">
            <label>Start date *</label>
            <input type="date" required value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} />
          </div>
          <div className="field">
            <label>End date *</label>
            <input type="date" required value={form.endDate} onChange={(e) => setField('endDate', e.target.value)} />
          </div>
          <div className="field field-full">
            <label>Reason</label>
            <input value={form.reason} onChange={(e) => setField('reason', e.target.value)} />
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </form>

      <ErrorBanner error={actionError} />

      {canManagerApprove && (
        <>
          <div className="section-title">Manager approval queue</div>
          <DataTable columns={managerColumns} rows={pendingManager} emptyLabel="Nothing awaiting manager approval." />
        </>
      )}

      {canHrConfirm && (
        <>
          <div className="section-title">HR confirmation queue</div>
          <DataTable columns={hrColumns} rows={pendingHr} emptyLabel="Nothing awaiting HR confirmation." />
        </>
      )}

      <div className="section-title">All requests</div>
      {loading && <Loading />}
      <ErrorBanner error={error} />
      {data && <DataTable columns={myColumns} rows={allRequests} emptyLabel="No holiday requests." />}
    </div>
  );
}
