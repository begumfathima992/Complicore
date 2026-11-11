import { useState } from 'react';
import { useApiData } from '../hooks/useApiData';
import { shiftsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Loading, ErrorBanner, SuccessBanner } from '../components/Feedback';
import { StatusBadge } from '../components/Badges';
import DataTable from '../components/DataTable';
import EmployeePicker from '../components/EmployeePicker';
import { ApiError } from '../api/client';
import { downloadBlob } from '../utils/download';

const SHIFT_STATUSES = ['draft', 'published', 'approved'];
const REQUEST_TYPES = ['swap', 'time_change', 'cancellation'];

const EMPTY_SHIFT = { employeeId: '', shiftDate: '', startTime: '', endTime: '', role: '', status: 'draft', notes: '' };
const EMPTY_REQUEST = { shiftId: '', requestType: 'time_change', proposedStartTime: '', proposedEndTime: '', reason: '' };

export default function RosterPage() {
  const { user } = useAuth();
  const canManageRoster = user.role !== 'EMPLOYEE';

  const [range, setRange] = useState({ from: '', to: '' });
  const { data, loading, error, reload } = useApiData(() => shiftsApi.list(range), [range.from, range.to]);

  const {
    data: changeRequestData,
    error: crError,
    reload: reloadChangeRequests,
  } = useApiData(() => shiftsApi.listChangeRequests(), []);

  const [shiftForm, setShiftForm] = useState(EMPTY_SHIFT);
  const [shiftError, setShiftError] = useState(null);
  const [shiftSuccess, setShiftSuccess] = useState(null);
  const [conflicts, setConflicts] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [requestForm, setRequestForm] = useState(EMPTY_REQUEST);
  const [requestError, setRequestError] = useState(null);
  const [requestSuccess, setRequestSuccess] = useState(null);

  const [reviewError, setReviewError] = useState(null);

  const setShiftField = (key, value) => setShiftForm((prev) => ({ ...prev, [key]: value }));
  const setRequestField = (key, value) => setRequestForm((prev) => ({ ...prev, [key]: value }));

  const submitShift = async (e, force = false) => {
    e?.preventDefault();
    setShiftError(null);
    setShiftSuccess(null);
    setSubmitting(true);
    try {
      const result = await shiftsApi.create(shiftForm, force);
      setShiftSuccess('Shift created.');
      setConflicts(result.conflicts?.length ? result.conflicts : null);
      setShiftForm(EMPTY_SHIFT);
      reload();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setShiftError(err);
        setConflicts(err.data?.conflicts?.length ? err.data.conflicts : true);
      } else {
        setShiftError(err instanceof ApiError ? err : new Error('Failed to create shift'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    try {
      const { blob, filename } = await shiftsApi.exportCsv();
      downloadBlob(blob, filename);
    } catch (err) {
      setShiftError(err instanceof ApiError ? err : new Error('Export failed'));
    }
  };

  const submitChangeRequest = async (e) => {
    e.preventDefault();
    setRequestError(null);
    setRequestSuccess(null);
    try {
      await shiftsApi.createChangeRequest(requestForm);
      setRequestSuccess('Change request submitted.');
      setRequestForm(EMPTY_REQUEST);
      reloadChangeRequests();
    } catch (err) {
      setRequestError(err instanceof ApiError ? err : new Error('Failed to submit request'));
    }
  };

  const reviewRequest = async (id, decision) => {
    setReviewError(null);
    try {
      await shiftsApi.reviewChangeRequest(id, decision);
      reloadChangeRequests();
      reload();
    } catch (err) {
      setReviewError(err instanceof ApiError ? err : new Error('Failed to review request'));
    }
  };

  const shiftColumns = [
    { key: 'shiftDate', label: 'Date' },
    { key: 'startTime', label: 'Start' },
    { key: 'endTime', label: 'End' },
    { key: 'employee', label: 'Employee', render: (row) => (row.Employee ? `${row.Employee.firstName} ${row.Employee.lastName}` : '—') },
    { key: 'role', label: 'Role' },
    { key: 'department', label: 'Department', render: (row) => row.Department?.name },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ];

  const requestColumns = [
    { key: 'shift', label: 'Shift', render: (row) => (row.Shift ? `${row.Shift.shiftDate} ${row.Shift.startTime}-${row.Shift.endTime}` : '—') },
    { key: 'requestType', label: 'Type', render: (row) => row.requestType.replace(/_/g, ' ') },
    { key: 'reason', label: 'Reason' },
    { key: 'requestedBy', label: 'Requested By', render: (row) => row.requestedBy?.email || '—' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) =>
        canManageRoster && row.status === 'pending' ? (
          <div className="btn-row">
            <button type="button" className="btn btn-small btn-success" onClick={() => reviewRequest(row.id, 'approved')}>
              Approve
            </button>
            <button type="button" className="btn btn-small btn-danger" onClick={() => reviewRequest(row.id, 'rejected')}>
              Reject
            </button>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Duty Roster</h1>
          <p className="page-subtitle">Shift schedule with conflict detection against overlapping shifts, holiday and absence.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={handleExport}>
          Export CSV
        </button>
      </div>

      {canManageRoster && (
        <form className="card" onSubmit={submitShift}>
          <h2>Create a shift</h2>
          <ErrorBanner error={shiftError} />
          <SuccessBanner message={shiftSuccess} />
          {conflicts && (
            <div className="feedback feedback-error">
              <div>Scheduling conflict detected:</div>
              {Array.isArray(conflicts) && (
                <ul style={{ margin: '6px 0' }}>
                  {conflicts.map((c, i) => (
                    <li key={i}>
                      {c.type.replace(/_/g, ' ')}
                      {c.shiftDate ? ` on ${c.shiftDate}` : ''}
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="link-button" onClick={(e) => submitShift(e, true)}>
                Create anyway
              </button>
            </div>
          )}
          <div className="form-grid">
            <EmployeePicker value={shiftForm.employeeId} onChange={(v) => setShiftField('employeeId', v)} />
            <div className="field">
              <label>Shift date *</label>
              <input type="date" required value={shiftForm.shiftDate} onChange={(e) => setShiftField('shiftDate', e.target.value)} />
            </div>
            <div className="field">
              <label>Start time *</label>
              <input type="time" required value={shiftForm.startTime} onChange={(e) => setShiftField('startTime', e.target.value)} />
            </div>
            <div className="field">
              <label>End time *</label>
              <input type="time" required value={shiftForm.endTime} onChange={(e) => setShiftField('endTime', e.target.value)} />
            </div>
            <div className="field">
              <label>Position / role</label>
              <input value={shiftForm.role} onChange={(e) => setShiftField('role', e.target.value)} placeholder="e.g. Reception" />
            </div>
            <div className="field">
              <label>Status</label>
              <select value={shiftForm.status} onChange={(e) => setShiftField('status', e.target.value)}>
                {SHIFT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="field field-full">
              <label>Notes</label>
              <input value={shiftForm.notes} onChange={(e) => setShiftField('notes', e.target.value)} />
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Saving…' : 'Create shift'}
            </button>
          </div>
        </form>
      )}

      <div className="filter-bar">
        <div className="field">
          <label>From</label>
          <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
        </div>
        <div className="field">
          <label>To</label>
          <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
        </div>
      </div>

      <div className="section-title">Shifts</div>
      {loading && <Loading />}
      <ErrorBanner error={error} />
      {data && <DataTable columns={shiftColumns} rows={data.shifts} emptyLabel="No shifts scheduled." />}

      <div className="section-title">Request a shift change</div>
      <form className="card" onSubmit={submitChangeRequest}>
        <ErrorBanner error={requestError} />
        <SuccessBanner message={requestSuccess} />
        <div className="form-grid">
          <div className="field">
            <label>Shift ID *</label>
            <input
              required
              value={requestForm.shiftId}
              onChange={(e) => setRequestField('shiftId', e.target.value)}
              placeholder="Copy the shift's id from the table above"
            />
          </div>
          <div className="field">
            <label>Request type</label>
            <select value={requestForm.requestType} onChange={(e) => setRequestField('requestType', e.target.value)}>
              {REQUEST_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          {requestForm.requestType === 'time_change' && (
            <>
              <div className="field">
                <label>Proposed start</label>
                <input type="time" value={requestForm.proposedStartTime} onChange={(e) => setRequestField('proposedStartTime', e.target.value)} />
              </div>
              <div className="field">
                <label>Proposed end</label>
                <input type="time" value={requestForm.proposedEndTime} onChange={(e) => setRequestField('proposedEndTime', e.target.value)} />
              </div>
            </>
          )}
          <div className="field field-full">
            <label>Reason</label>
            <input value={requestForm.reason} onChange={(e) => setRequestField('reason', e.target.value)} />
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="submit" className="btn">
            Submit request
          </button>
        </div>
      </form>

      <div className="section-title">{canManageRoster ? 'Change request inbox' : 'My change requests'}</div>
      <ErrorBanner error={crError} />
      <ErrorBanner error={reviewError} />
      {changeRequestData && (
        <DataTable columns={requestColumns} rows={changeRequestData.changeRequests} emptyLabel="No change requests." />
      )}
    </div>
  );
}
