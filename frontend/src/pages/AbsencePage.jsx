import { useState } from 'react';
import { useApiData } from '../hooks/useApiData';
import { absencesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Loading, ErrorBanner, SuccessBanner } from '../components/Feedback';
import { StatusBadge } from '../components/Badges';
import DataTable from '../components/DataTable';
import EmployeePicker from '../components/EmployeePicker';
import { ApiError } from '../api/client';

const ABSENCE_TYPES = ['sickness', 'unauthorised', 'family_leave', 'other', 'long_term_absence'];
const REASON_CATEGORIES = ['illness_non_specific', 'injury', 'mental_health', 'medical_appointment', 'bereavement', 'other'];

export default function AbsencePage() {
  const { user } = useAuth();
  const canCreateForOthers = ['SUPER_ADMIN', 'EMPLOYER_ADMIN', 'HR_MANAGER'].includes(user.role);
  // Manager can only approve/view per the backend matrix - never create/edit.
  const canCreate = user.role === 'EMPLOYEE' || canCreateForOthers;
  const canApprove = ['SUPER_ADMIN', 'EMPLOYER_ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user.role);
  const canEdit = ['SUPER_ADMIN', 'EMPLOYER_ADMIN', 'HR_MANAGER'].includes(user.role);

  const { data, loading, error, reload } = useApiData(() => absencesApi.list(), []);

  const [form, setForm] = useState({
    employeeId: user.role === 'EMPLOYEE' ? user.employeeId || '' : '',
    absenceType: 'sickness',
    startDate: '',
    endDate: '',
    reasonCategory: 'illness_non_specific',
    notes: '',
  });
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [returnDates, setReturnDates] = useState({});

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    try {
      await absencesApi.create(form);
      setFormSuccess('Absence recorded.');
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err : new Error('Failed to record absence'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id) => {
    setActionError(null);
    try {
      await absencesApi.approve(id);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err : new Error('Approve failed'));
    }
  };

  const handleSetReturnDate = async (id) => {
    const date = returnDates[id];
    if (!date) return;
    setActionError(null);
    try {
      await absencesApi.update(id, { returnToWorkDate: date });
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err : new Error('Update failed'));
    }
  };

  const columns = [
    { key: 'employee', label: 'Employee', render: (row) => (row.Employee ? `${row.Employee.firstName} ${row.Employee.lastName}` : '—') },
    { key: 'absenceType', label: 'Type', render: (row) => row.absenceType.replace(/_/g, ' ') },
    { key: 'startDate', label: 'Start' },
    { key: 'endDate', label: 'End' },
    { key: 'durationDays', label: 'Duration' },
    { key: 'reasonCategory', label: 'Category', render: (row) => row.reasonCategory?.replace(/_/g, ' ') },
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'approvedBy', label: 'Approved By', render: (row) => row.approvedBy?.email || '—' },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="btn-row" style={{ alignItems: 'center' }}>
          {canApprove && !row.approvedByUserId && (
            <button type="button" className="btn btn-small btn-success" onClick={() => handleApprove(row.id)}>
              Approve
            </button>
          )}
          {canEdit && row.status === 'open' && (
            <>
              <input
                type="date"
                style={{ width: 130 }}
                value={returnDates[row.id] || ''}
                onChange={(e) => setReturnDates((prev) => ({ ...prev, [row.id]: e.target.value }))}
              />
              <button type="button" className="btn btn-small btn-secondary" onClick={() => handleSetReturnDate(row.id)}>
                Set return date
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Sick Leave &amp; Absence</h1>
          <p className="page-subtitle">
            Covers sickness, unauthorised absence, family leave, other, and long-term absence. Holiday is recorded
            separately in the Holiday module.
          </p>
        </div>
      </div>

      {canCreate && (
        <form className="card" onSubmit={handleSubmit}>
          <h2>Record an absence</h2>
          <ErrorBanner error={formError} />
          <SuccessBanner message={formSuccess} />
          <div className="form-grid">
            {canCreateForOthers ? (
              <EmployeePicker value={form.employeeId} onChange={(v) => setField('employeeId', v)} />
            ) : (
              <div className="field">
                <label>Employee</label>
                <input value="Yourself" disabled />
              </div>
            )}
            <div className="field">
              <label>Absence type</label>
              <select value={form.absenceType} onChange={(e) => setField('absenceType', e.target.value)}>
                {ABSENCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Start date *</label>
              <input type="date" required value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} />
            </div>
            <div className="field">
              <label>End date</label>
              <input type="date" value={form.endDate} onChange={(e) => setField('endDate', e.target.value)} />
            </div>
            <div className="field">
              <label>Reason category</label>
              <select value={form.reasonCategory} onChange={(e) => setField('reasonCategory', e.target.value)}>
                {REASON_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              <span className="muted" style={{ fontSize: 11 }}>
                Operational category only - no diagnosis detail is collected.
              </span>
            </div>
            <div className="field field-full">
              <label>Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                placeholder="Logistics only (e.g. cover arranged) - avoid clinical detail."
              />
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button type="submit" className="btn" disabled={submitting}>
              {submitting ? 'Saving…' : 'Record absence'}
            </button>
          </div>
        </form>
      )}

      <ErrorBanner error={actionError} />

      <div className="section-title">Absence records</div>
      {loading && <Loading />}
      <ErrorBanner error={error} />
      {data && <DataTable columns={columns} rows={data.absences} emptyLabel="No absences recorded." />}
    </div>
  );
}
