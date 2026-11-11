import { useState } from 'react';
import { useApiData } from '../hooks/useApiData';
import { changeOfCircumstancesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Loading, ErrorBanner, SuccessBanner } from '../components/Feedback';
import DataTable from '../components/DataTable';
import EmployeePicker from '../components/EmployeePicker';
import { ApiError } from '../api/client';

const CHANGE_TYPES = [
  'address',
  'role',
  'salary',
  'working_hours',
  'work_location',
  'absence',
  'termination',
  'promotion',
  'transfer',
  'other',
];

const EMPTY_FORM = { employeeId: '', changeType: 'role', oldValue: '', newValue: '', effectiveDate: '', reason: '' };

export default function ChangeOfCircumstancesPage() {
  const { user } = useAuth();
  // Backend blocks employees from logging their own changes - this is an
  // append-only audit trail someone else must record.
  const canLogChange = user.role !== 'EMPLOYEE';

  const { data, loading, error, reload } = useApiData(() => changeOfCircumstancesApi.list(), []);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    try {
      await changeOfCircumstancesApi.create(form);
      setFormSuccess('Change of circumstance logged.');
      setForm(EMPTY_FORM);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err : new Error('Failed to log change'));
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'employee', label: 'Employee', render: (row) => (row.Employee ? `${row.Employee.firstName} ${row.Employee.lastName}` : '—') },
    { key: 'changeType', label: 'Change Type', render: (row) => row.changeType.replace(/_/g, ' ') },
    { key: 'oldValue', label: 'Old Value' },
    { key: 'newValue', label: 'New Value' },
    { key: 'effectiveDate', label: 'Effective Date' },
    { key: 'reason', label: 'Reason' },
    { key: 'changedBy', label: 'Changed By', render: (row) => row.changedBy?.email || '—' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Change of Circumstances</h1>
          <p className="page-subtitle">
            An append-only audit trail of material changes to an employee's record. Entries can never be edited or
            deleted once logged.
          </p>
        </div>
      </div>

      {canLogChange && (
        <form className="card" onSubmit={handleSubmit}>
          <h2>Log a change</h2>
          <ErrorBanner error={formError} />
          <SuccessBanner message={formSuccess} />
          <div className="form-grid">
            <EmployeePicker value={form.employeeId} onChange={(v) => setField('employeeId', v)} />
            <div className="field">
              <label>Change type</label>
              <select value={form.changeType} onChange={(e) => setField('changeType', e.target.value)}>
                {CHANGE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Effective date *</label>
              <input type="date" required value={form.effectiveDate} onChange={(e) => setField('effectiveDate', e.target.value)} />
            </div>
            <div className="field">
              <label>Old value</label>
              <input value={form.oldValue} onChange={(e) => setField('oldValue', e.target.value)} />
            </div>
            <div className="field">
              <label>New value</label>
              <input value={form.newValue} onChange={(e) => setField('newValue', e.target.value)} />
            </div>
            <div className="field field-full">
              <label>Reason</label>
              <textarea value={form.reason} onChange={(e) => setField('reason', e.target.value)} />
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Logging…' : 'Log change'}
            </button>
          </div>
        </form>
      )}

      <div className="section-title">History</div>
      {loading && <Loading />}
      <ErrorBanner error={error} />
      {data && <DataTable columns={columns} rows={data.changes} emptyLabel="No changes logged." />}
    </div>
  );
}
