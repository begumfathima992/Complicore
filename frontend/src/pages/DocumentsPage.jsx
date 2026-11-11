import { useState } from 'react';
import { useApiData } from '../hooks/useApiData';
import { documentsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Loading, ErrorBanner, SuccessBanner } from '../components/Feedback';
import { StatusBadge } from '../components/Badges';
import DataTable from '../components/DataTable';
import EmployeePicker from '../components/EmployeePicker';
import { ApiError } from '../api/client';

const DOCUMENT_TYPES = [
  'passport_id',
  'right_to_work_evidence',
  'visa',
  'employment_contract',
  'dbs_check',
  'qualification',
  'certificate',
  'training_record',
  'other',
];
const STATUSES = ['valid', 'expiring_soon', 'expired', 'pending_review'];

const EMPTY_FORM = { employeeId: '', documentType: 'passport_id', fileUrl: '', fileName: '', expiryDate: '' };

export default function DocumentsPage() {
  const { user } = useAuth();
  const canEditStatus = user.role !== 'EMPLOYEE';

  const [showSuperseded, setShowSuperseded] = useState(false);
  const { data, loading, error, reload } = useApiData(
    () => documentsApi.list({ includeSuperseded: showSuperseded ? 'true' : 'false' }),
    [showSuperseded]
  );

  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [rowUpdating, setRowUpdating] = useState(null);
  const [rowError, setRowError] = useState(null);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleUpload = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    try {
      await documentsApi.upload(form);
      setFormSuccess('Document registered.');
      setForm(EMPTY_FORM);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err : new Error('Upload failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (doc, status) => {
    setRowError(null);
    setRowUpdating(doc.id);
    try {
      await documentsApi.update(doc.id, { status });
      reload();
    } catch (err) {
      setRowError(err instanceof ApiError ? err : new Error('Update failed'));
    } finally {
      setRowUpdating(null);
    }
  };

  const columns = [
    { key: 'employee', label: 'Employee', render: (row) => (row.Employee ? `${row.Employee.firstName} ${row.Employee.lastName}` : '—') },
    { key: 'documentType', label: 'Type', render: (row) => row.documentType.replace(/_/g, ' ') },
    { key: 'version', label: 'Version', render: (row) => `v${row.version}${row.isCurrent ? '' : ' (superseded)'}` },
    { key: 'expiryDate', label: 'Expiry' },
    {
      key: 'status',
      label: 'Status',
      render: (row) =>
        canEditStatus ? (
          <select
            value={row.status}
            disabled={rowUpdating === row.id}
            onChange={(e) => handleStatusChange(row, e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        ) : (
          <StatusBadge status={row.status} />
        ),
    },
    { key: 'uploadedBy', label: 'Uploaded By', render: (row) => row.uploadedBy?.email || '—' },
    { key: 'uploadDate', label: 'Upload Date' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Documents</h1>
          <p className="page-subtitle">
            Document metadata registry. Re-uploading a document of the same type creates a new version rather than
            overwriting the old one.
          </p>
        </div>
      </div>

      <form className="card" onSubmit={handleUpload}>
        <h2>Upload a document</h2>
        <ErrorBanner error={formError} />
        <SuccessBanner message={formSuccess} />
        <div className="form-grid">
          <EmployeePicker value={form.employeeId} onChange={(v) => setField('employeeId', v)} />
          <div className="field">
            <label>Document type</label>
            <select value={form.documentType} onChange={(e) => setField('documentType', e.target.value)}>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>File name</label>
            <input value={form.fileName} onChange={(e) => setField('fileName', e.target.value)} placeholder="passport-scan.pdf" />
          </div>
          <div className="field field-full">
            <label>File URL *</label>
            <input
              required
              value={form.fileUrl}
              onChange={(e) => setField('fileUrl', e.target.value)}
              placeholder="s3://bucket/path or https://…"
            />
          </div>
          <div className="field">
            <label>Expiry date</label>
            <input type="date" value={form.expiryDate} onChange={(e) => setField('expiryDate', e.target.value)} />
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Uploading…' : 'Upload document'}
          </button>
        </div>
      </form>

      <div className="page-header" style={{ marginTop: 4 }}>
        <div className="section-title" style={{ margin: 0 }}>
          Document vault
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={showSuperseded} onChange={(e) => setShowSuperseded(e.target.checked)} />
          Show superseded versions
        </label>
      </div>

      <ErrorBanner error={rowError} />
      {loading && <Loading />}
      <ErrorBanner error={error} />
      {data && <DataTable columns={columns} rows={data.documents} emptyLabel="No documents on file." />}
    </div>
  );
}
