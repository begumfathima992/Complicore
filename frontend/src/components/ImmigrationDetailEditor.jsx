import { useEffect, useState } from 'react';
import { rightToWorkApi } from '../api';
import { ApiError } from '../api/client';
import { ErrorBanner, SuccessBanner, Loading } from './Feedback';
import EmployeePicker from './EmployeePicker';

const RIGHT_TO_WORK_STATUSES = ['verified', 'pending', 'expired', 'not_required'];
const COMPLIANCE_STATUSES = ['compliant', 'action_required', 'non_compliant'];
// EU Settlement Scheme status - distinct from general right-to-work status.
// 'not_applicable' (the default) means the employee was never in scope for
// the EUSS, not that their status is unverified.
const SETTLEMENT_STATUSES = ['not_applicable', 'settled', 'pre_settled'];

const EMPTY = {
  nationality: '',
  rightToWorkStatus: 'pending',
  visaType: '',
  visaExpiry: '',
  shareCode: '',
  sponsorshipReference: '',
  complianceStatus: 'compliant',
  settlementStatus: 'not_applicable',
};

/**
 * View/edit the employee's ImmigrationDetail record (nationality, visa,
 * right-to-work status, EU Settlement Scheme status). Lives on the
 * Right-to-Work page rather than the general Employee edit form because it
 * is gated by RIGHT_TO_WORK permission (Manager: view-only, HR/Employer/
 * Super: can edit) - a different, stricter gate than the EMPLOYEES
 * permission the rest of the employee profile uses.
 */
export default function ImmigrationDetailEditor({ canEdit }) {
  const [employeeId, setEmployeeId] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!employeeId) {
      setForm(EMPTY);
      return;
    }
    setLoading(true);
    setLoadError(null);
    setSaveSuccess(null);
    rightToWorkApi
      .getImmigrationDetail(employeeId)
      .then((res) => setForm(res.immigrationDetail ? { ...EMPTY, ...res.immigrationDetail } : EMPTY))
      .catch((err) => setLoadError(err instanceof ApiError ? err : new Error('Failed to load compliance record')))
      .finally(() => setLoading(false));
  }, [employeeId]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);
    setSaving(true);
    try {
      const { immigrationDetail } = await rightToWorkApi.updateImmigrationDetail(employeeId, form);
      setForm({ ...EMPTY, ...immigrationDetail });
      setSaveSuccess('Compliance record saved.');
    } catch (err) {
      setSaveError(err instanceof ApiError ? err : new Error('Save failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <h2>Compliance record (nationality, visa, EU Settlement Scheme status)</h2>
      <div className="form-grid" style={{ marginBottom: 14 }}>
        <EmployeePicker value={employeeId} onChange={setEmployeeId} required={false} label="View/edit record for" />
      </div>

      {!employeeId && <p className="muted">Select an employee to view or edit their compliance record.</p>}
      {loading && <Loading />}
      <ErrorBanner error={loadError} />

      {employeeId && !loading && !loadError && (
        <form onSubmit={handleSave}>
          <ErrorBanner error={saveError} />
          <SuccessBanner message={saveSuccess} />
          <div className="form-grid">
            <div className="field">
              <label>Nationality</label>
              <input value={form.nationality || ''} disabled={!canEdit} onChange={(e) => setField('nationality', e.target.value)} />
            </div>
            <div className="field">
              <label>Right-to-work status</label>
              <select value={form.rightToWorkStatus} disabled={!canEdit} onChange={(e) => setField('rightToWorkStatus', e.target.value)}>
                {RIGHT_TO_WORK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Visa type</label>
              <input value={form.visaType || ''} disabled={!canEdit} onChange={(e) => setField('visaType', e.target.value)} />
            </div>
            <div className="field">
              <label>Visa expiry</label>
              <input type="date" value={form.visaExpiry || ''} disabled={!canEdit} onChange={(e) => setField('visaExpiry', e.target.value)} />
            </div>
            <div className="field">
              <label>Share code</label>
              <input value={form.shareCode || ''} disabled={!canEdit} onChange={(e) => setField('shareCode', e.target.value)} />
            </div>
            <div className="field">
              <label>Sponsorship reference</label>
              <input
                value={form.sponsorshipReference || ''}
                disabled={!canEdit}
                onChange={(e) => setField('sponsorshipReference', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Compliance status</label>
              <select value={form.complianceStatus} disabled={!canEdit} onChange={(e) => setField('complianceStatus', e.target.value)}>
                {COMPLIANCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>EU Settlement Scheme status</label>
              <select value={form.settlementStatus} disabled={!canEdit} onChange={(e) => setField('settlementStatus', e.target.value)}>
                {SETTLEMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {canEdit && (
            <div className="btn-row" style={{ marginTop: 16 }}>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? 'Saving…' : 'Save compliance record'}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
