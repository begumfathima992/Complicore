import { useEffect, useState } from 'react';
import { rightToWorkApi, visaRecordsApi, identityDocumentsApi } from '../api';
import { ApiError } from '../api/client';
import { ErrorBanner, SuccessBanner, Loading } from './Feedback';
import { StatusBadge } from './Badges';
import EmployeePicker from './EmployeePicker';
import HistoryRecordCard from './HistoryRecordCard';
import { useApiData } from '../hooks/useApiData';

const RIGHT_TO_WORK_STATUSES = ['verified', 'pending', 'expired', 'not_required'];
const COMPLIANCE_STATUSES = ['compliant', 'action_required', 'non_compliant'];
// EU Settlement Scheme status - distinct from general right-to-work status.
// 'not_applicable' (the default) means the employee was never in scope for
// the EUSS, not that their status is unverified.
const SETTLEMENT_STATUSES = ['not_applicable', 'settled', 'pre_settled'];

const EMPTY = {
  nationality: '',
  rightToWorkStatus: 'pending',
  complianceStatus: 'compliant',
  settlementStatus: 'not_applicable',
};

const EMPTY_VISA_FORM = { visaType: '', shareCode: '', startDate: '', expiryDate: '', sponsorshipReference: '', supersedesCurrent: true };
const EMPTY_PASSPORT_FORM = { type: 'passport', documentNumber: '', issuingCountry: '', nationality: '', issueDate: '', expiryDate: '', supersedesCurrent: true };

/**
 * View/edit the employee's ImmigrationDetail record (nationality,
 * right-to-work status, EU Settlement Scheme status) plus the full
 * past/current/future visa and passport/identity-document histories.
 * Lives on the Right-to-Work page rather than the general Employee edit
 * form because it is gated by RIGHT_TO_WORK permission (Manager:
 * view-only, HR/Employer/Super: can edit) - a different, stricter gate
 * than the EMPLOYEES permission the rest of the employee profile uses.
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

  const {
    data: visaData,
    loading: visaLoading,
    error: visaError,
    reload: reloadVisas,
  } = useApiData(() => (employeeId ? visaRecordsApi.list(employeeId) : Promise.resolve(null)), [employeeId]);

  const {
    data: passportData,
    loading: passportLoading,
    error: passportError,
    reload: reloadPassports,
  } = useApiData(() => (employeeId ? identityDocumentsApi.list(employeeId) : Promise.resolve(null)), [employeeId]);

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

  const visaColumns = [
    { key: 'visaType', label: 'Visa Type' },
    { key: 'shareCode', label: 'Share Code', render: (r) => r.shareCode || '—' },
    { key: 'startDate', label: 'Start' },
    { key: 'expiryDate', label: 'Expiry' },
    { key: 'isCurrent', label: 'Current?', render: (r) => (r.isCurrent ? <StatusBadge status="active" /> : r.supersedesCurrent ? <StatusBadge status="pending" /> : '—') },
  ];

  const passportColumns = [
    { key: 'type', label: 'Type' },
    { key: 'documentNumber', label: 'Number', render: (r) => r.documentNumber || '—' },
    { key: 'issuingCountry', label: 'Issuing Country' },
    { key: 'issueDate', label: 'Issue Date' },
    { key: 'expiryDate', label: 'Expiry' },
    { key: 'isCurrent', label: 'Current?', render: (r) => (r.isCurrent ? <StatusBadge status="active" /> : r.supersedesCurrent ? <StatusBadge status="pending" /> : '—') },
  ];

  return (
    <div className="card">
      <h2>Compliance record (nationality, right-to-work status, EU Settlement Scheme status)</h2>
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

      {employeeId && !loading && !loadError && (
        <>
          <HistoryRecordCard
            title="Visa history"
            hint="Past visas are kept as history. A new visa with a future start date stays scheduled until that date arrives, when it automatically becomes current and closes the old one's alerts."
            records={visaData?.records}
            loading={visaLoading}
            error={visaError}
            columns={visaColumns}
            canEdit={canEdit}
            emptyForm={EMPTY_VISA_FORM}
            submitLabel="Add visa record"
            formFields={[
              { key: 'visaType', label: 'Visa type' },
              { key: 'shareCode', label: 'Share code (eVisa)', placeholder: 'e.g. W12-345-678' },
              { key: 'startDate', label: 'Start date', type: 'date' },
              { key: 'expiryDate', label: 'Expiry date', type: 'date' },
              { key: 'sponsorshipReference', label: 'Sponsorship / CoS reference' },
              { key: 'supersedesCurrent', label: 'Replaces the current visa?', type: 'checkbox' },
            ]}
            onSubmit={async (values) => {
              await visaRecordsApi.create(employeeId, values);
              reloadVisas();
            }}
          />

          <HistoryRecordCard
            title="Passport / identity document history"
            hint="An employee can hold more than one (dual nationality). Old documents are kept as history. A renewal with a future issue date stays scheduled until that date arrives."
            records={passportData?.documents}
            loading={passportLoading}
            error={passportError}
            columns={passportColumns}
            canEdit={canEdit}
            emptyForm={EMPTY_PASSPORT_FORM}
            submitLabel="Add passport / ID record"
            formFields={[
              { key: 'type', label: 'Type (passport/national_id/brp)' },
              { key: 'documentNumber', label: 'Document number' },
              { key: 'issuingCountry', label: 'Issuing country' },
              { key: 'nationality', label: 'Nationality on document' },
              { key: 'issueDate', label: 'Issue date', type: 'date' },
              { key: 'expiryDate', label: 'Expiry date', type: 'date' },
              { key: 'supersedesCurrent', label: 'Replaces the current one?', type: 'checkbox' },
            ]}
            onSubmit={async (values) => {
              await identityDocumentsApi.create(employeeId, values);
              reloadPassports();
            }}
          />
        </>
      )}
    </div>
  );
}
