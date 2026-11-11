import { useState } from 'react';
import { useApiData } from '../hooks/useApiData';
import { rightToWorkApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Loading, ErrorBanner, SuccessBanner } from '../components/Feedback';
import { StatusBadge } from '../components/Badges';
import DataTable from '../components/DataTable';
import EmployeePicker from '../components/EmployeePicker';
import ImmigrationDetailEditor from '../components/ImmigrationDetailEditor';
import { ApiError } from '../api/client';

const CHECK_TYPES = ['initial_manual_check', 'initial_online_check', 'follow_up_check', 'continuous_check'];
const STATUSES = ['verified', 'pending', 'expiring_soon', 'expired', 'not_verified'];

const EMPTY_FORM = {
  employeeId: '',
  checkType: 'initial_manual_check',
  checkDate: '',
  status: 'pending',
  expiryDate: '',
  evidenceReference: '',
  verificationNotes: '',
  nextReviewDate: '',
};

export default function RightToWorkPage() {
  const { user } = useAuth();
  const canLogChecks = ['SUPER_ADMIN', 'EMPLOYER_ADMIN', 'HR_MANAGER'].includes(user.role);

  const { data, loading, error, reload } = useApiData(() => rightToWorkApi.list(), []);
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
      await rightToWorkApi.create(form);
      setFormSuccess('Right-to-work check logged.');
      setForm(EMPTY_FORM);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err : new Error('Failed to log check'));
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'employee', label: 'Employee', render: (row) => (row.Employee ? `${row.Employee.firstName} ${row.Employee.lastName}` : '—') },
    { key: 'checkType', label: 'Check Type', render: (row) => row.checkType.replace(/_/g, ' ') },
    { key: 'checkDate', label: 'Check Date' },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'expiryDate', label: 'Expiry' },
    { key: 'nextReviewDate', label: 'Next Review' },
    { key: 'checkedBy', label: 'Checked By', render: (row) => row.checkedBy?.email || '—' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Right to Work</h1>
          <p className="page-subtitle">
            A log of right-to-work checks per employee. Status is always set by whoever performed the check - never
            inferred automatically from dates.
          </p>
        </div>
      </div>

      <ImmigrationDetailEditor canEdit={canLogChecks} />

      {canLogChecks && (
        <form className="card" onSubmit={handleSubmit}>
          <h2>Log a new check</h2>
          <ErrorBanner error={formError} />
          <SuccessBanner message={formSuccess} />
          <div className="form-grid">
            <EmployeePicker value={form.employeeId} onChange={(v) => setField('employeeId', v)} />
            <div className="field">
              <label>Check type</label>
              <select value={form.checkType} onChange={(e) => setField('checkType', e.target.value)}>
                {CHECK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Check date *</label>
              <input type="date" required value={form.checkDate} onChange={(e) => setField('checkDate', e.target.value)} />
            </div>
            <div className="field">
              <label>Status</label>
              <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Expiry date</label>
              <input type="date" value={form.expiryDate} onChange={(e) => setField('expiryDate', e.target.value)} />
            </div>
            <div className="field">
              <label>Next review date</label>
              <input type="date" value={form.nextReviewDate} onChange={(e) => setField('nextReviewDate', e.target.value)} />
            </div>
            <div className="field">
              <label>Evidence reference</label>
              <input value={form.evidenceReference} onChange={(e) => setField('evidenceReference', e.target.value)} />
            </div>
            <div className="field field-full">
              <label>Verification notes</label>
              <textarea value={form.verificationNotes} onChange={(e) => setField('verificationNotes', e.target.value)} />
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Saving…' : 'Log check'}
            </button>
          </div>
        </form>
      )}

      <div className="section-title">Check history</div>
      {loading && <Loading />}
      <ErrorBanner error={error} />
      {data && <DataTable columns={columns} rows={data.checks} emptyLabel="No right-to-work checks recorded." />}
    </div>
  );
}
