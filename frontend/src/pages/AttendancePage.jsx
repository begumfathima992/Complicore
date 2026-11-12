import { useState } from 'react';
import { useApiData } from '../hooks/useApiData';
import { attendanceApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Loading, ErrorBanner, SuccessBanner } from '../components/Feedback';
import EmployeePicker from '../components/EmployeePicker';
import { downloadBlob } from '../utils/download';
import { ApiError } from '../api/client';

const STATUSES = ['present', 'absent', 'sick', 'planned_absence', 'unpaid_leave'];
// Mirrors AttendanceRecord.PLANNED_STATUSES on the backend - a manually
// entered planned_absence/unpaid_leave row gets the same lighter "Planned"
// treatment as a synthesized Holiday/Absence cell, not just actual kinds.
const PLANNED_RECORD_STATUSES = ['planned_absence', 'unpaid_leave'];

function mondayOf(dateStr) {
  const d = new Date(dateStr);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
  const { user } = useAuth();
  const canPickOthers = ['SUPER_ADMIN', 'EMPLOYER_ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user.role);
  const canApprove = ['SUPER_ADMIN', 'EMPLOYER_ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user.role);

  const [employeeId, setEmployeeId] = useState(user.employeeId || '');
  const [weekStart, setWeekStart] = useState(mondayOf(todayStr()));
  const [form, setForm] = useState(null); // null = no day selected yet
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const { data, loading, error, reload } = useApiData(
    () => (employeeId ? attendanceApi.weekly(employeeId, weekStart) : Promise.resolve(null)),
    [employeeId, weekStart]
  );

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const openDay = (date, record) => {
    setFormError(null);
    setFormSuccess(null);
    setForm({
      date,
      status: record?.status || (date > todayStr() ? 'planned_absence' : 'present'),
      clockIn: record?.clockIn || '09:00',
      clockOut: record?.clockOut || '17:00',
      breakMinutes: record?.breakMinutes ?? 0,
      notes: record?.notes || '',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    try {
      await attendanceApi.upsert({ employeeId, ...form });
      setFormSuccess(`Saved ${form.date}.`);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err : new Error('Failed to save entry'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (record) => {
    setActionError(null);
    try {
      await attendanceApi.approve(record.id);
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err : new Error('Approve failed'));
    }
  };

  const handleExport = async (format) => {
    try {
      const { blob, filename } = await attendanceApi.exportFile({ employeeId, from: weekStart, to: addDays(weekStart, 6) }, format);
      downloadBlob(blob, filename);
    } catch (err) {
      setActionError(err instanceof ApiError ? err : new Error('Export failed'));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Attendance</h1>
          <p className="page-subtitle">
            Actual hours worked, day by day - not the planned Duty Roster. Today and past days can record real hours;
            future days can only hold a planned entry (holiday, training, unpaid leave) until their date arrives.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="form-grid">
          {canPickOthers ? (
            <EmployeePicker value={employeeId} onChange={setEmployeeId} required={false} />
          ) : (
            <div className="field">
              <label>Employee</label>
              <input value="Yourself" disabled />
            </div>
          )}
          <div className="field">
            <label>Week starting (Monday)</label>
            <div className="btn-row">
              <button type="button" className="btn btn-small btn-secondary" onClick={() => setWeekStart((w) => addDays(w, -7))}>
                ← Prev
              </button>
              <input type="date" value={weekStart} onChange={(e) => setWeekStart(mondayOf(e.target.value))} />
              <button type="button" className="btn btn-small btn-secondary" onClick={() => setWeekStart((w) => addDays(w, 7))}>
                Next →
              </button>
            </div>
          </div>
        </div>

        {!employeeId && <p className="muted">Select an employee to see their attendance.</p>}
        {loading && <Loading />}
        <ErrorBanner error={error} />
        <ErrorBanner error={actionError} />

        {data && (
          <>
            <div className="tile-grid" style={{ marginBottom: 16 }}>
              <div className="tile">
                <div className="tile-value">{data.totalHours}</div>
                <div className="tile-label">Total hours this week</div>
              </div>
              <div className="tile">
                <div className="tile-value">{data.daysWorked}</div>
                <div className="tile-label">Days worked this week</div>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Clock in</th>
                    <th>Clock out</th>
                    <th>Hours</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.days.map((d) => {
                    const isPlannedRecord = d.kind === 'actual' && PLANNED_RECORD_STATUSES.includes(d.record.status);
                    const isPlanned = d.kind === 'planned' || isPlannedRecord;
                    return (
                    <tr key={d.date} style={isPlanned || d.kind === 'future_empty' ? { opacity: 0.6 } : undefined}>
                      <td>
                        {d.date} {d.date === todayStr() ? <span className="badge badge-info">Today</span> : null}
                      </td>
                      <td>
                        {d.kind === 'actual' && !isPlannedRecord && d.record.status.replace(/_/g, ' ')}
                        {isPlannedRecord && <span className="badge badge-medium">Planned: {d.record.status.replace(/_/g, ' ')}</span>}
                        {d.kind === 'planned' && <span className="badge badge-medium">Planned: {d.label}</span>}
                        {(d.kind === 'empty' || d.kind === 'future_empty') && '—'}
                      </td>
                      <td>{d.record?.clockIn || '—'}</td>
                      <td>{d.record?.clockOut || '—'}</td>
                      <td>{d.record?.totalHours ?? '—'}</td>
                      <td>
                        <div className="btn-row">
                          {d.kind !== 'planned' && (
                            <button type="button" className="btn btn-small btn-secondary" onClick={() => openDay(d.date, d.record)}>
                              {d.record ? 'Edit' : 'Add'}
                            </button>
                          )}
                          {canApprove && d.record && !d.record.approvedByUserId && (
                            <button type="button" className="btn btn-small btn-success" onClick={() => handleApprove(d.record)}>
                              Approve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="btn-row" style={{ marginTop: 12 }}>
              <button type="button" className="btn btn-secondary" onClick={() => handleExport('csv')}>
                Export CSV
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => handleExport('excel')}>
                Export Excel
              </button>
            </div>
          </>
        )}
      </div>

      {employeeId && (
        <div className="card">
          {!form && <p className="muted">Click "Add" or "Edit" on a day above to record an entry.</p>}
          {form && (
            <form onSubmit={handleSubmit}>
              <h2>Entry for {form.date}</h2>
              <ErrorBanner error={formError} />
              <SuccessBanner message={formSuccess} />
              <div className="form-grid">
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
                  <label>Clock in</label>
                  <input type="time" value={form.clockIn} onChange={(e) => setField('clockIn', e.target.value)} />
                </div>
                <div className="field">
                  <label>Clock out</label>
                  <input type="time" value={form.clockOut} onChange={(e) => setField('clockOut', e.target.value)} />
                </div>
                <div className="field">
                  <label>Break (mins)</label>
                  <input type="number" value={form.breakMinutes} onChange={(e) => setField('breakMinutes', e.target.value)} />
                </div>
                <div className="field field-full">
                  <label>Notes</label>
                  <input value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
                </div>
              </div>
              <div className="btn-row" style={{ marginTop: 16 }}>
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save entry'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
