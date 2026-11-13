import { useState } from 'react';
import { useApiData } from '../hooks/useApiData';
import { documentsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Loading, ErrorBanner, SuccessBanner } from '../components/Feedback';
import { StatusBadge } from '../components/Badges';
import DataTable from '../components/DataTable';
import EmployeePicker from '../components/EmployeePicker';
import { ApiError, uploadToPresignedUrl } from '../api/client';

const DOCUMENT_TYPES = [
  'passport_id',
  'right_to_work_evidence',
  'visa',
  'employment_contract',
  'payslip',
  'dbs_check',
  'qualification',
  'certificate',
  'training_record',
  'other',
];
const STATUSES = ['valid', 'expiring_soon', 'expired', 'pending_review'];

// Mirrors services/storageService.js's ALLOWED_MIME_TYPES / MAX_FILE_SIZE_BYTES -
// this is just the client-side half; the server re-validates independently.
const ALLOWED_TYPES = { 'application/pdf': 'PDF', 'image/jpeg': 'JPG', 'image/png': 'PNG' };
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const EMPTY_FORM = { employeeId: '', documentType: 'passport_id', expiryDate: '', periodMonth: '' };

export default function DocumentsPage() {
  const { user } = useAuth();
  const canEditStatus = user.role !== 'EMPLOYEE';
  const canDelete = ['SUPER_ADMIN', 'EMPLOYER_ADMIN', 'HR_MANAGER'].includes(user.role);

  const [showSuperseded, setShowSuperseded] = useState(false);
  const { data, loading, error, reload } = useApiData(
    () => documentsApi.list({ includeSuperseded: showSuperseded ? 'true' : 'false' }),
    [showSuperseded]
  );

  const [form, setForm] = useState(EMPTY_FORM);
  const [file, setFile] = useState(null);
  const [formError, setFormError] = useState(null);
  const [formSuccess, setFormSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStage, setUploadStage] = useState(null); // 'requesting' | 'uploading' | 'registering'

  const [rowUpdating, setRowUpdating] = useState(null);
  const [rowError, setRowError] = useState(null);
  const [rowBusy, setRowBusy] = useState(null);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0] || null;
    setFormError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!ALLOWED_TYPES[selected.type]) {
      setFormError(new Error('Only PDF, JPG, or PNG files are allowed.'));
      setFile(null);
      e.target.value = '';
      return;
    }
    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setFormError(new Error('File exceeds the 10 MB limit.'));
      setFile(null);
      e.target.value = '';
      return;
    }
    setFile(selected);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    if (!file) {
      setFormError(new Error('Choose a PDF, JPG, or PNG file first.'));
      return;
    }
    if (form.documentType === 'payslip' && !form.periodMonth) {
      setFormError(new Error('Month/year is required for a payslip.'));
      return;
    }
    // <input type="month"> gives 'YYYY-MM' - the backend's periodMonth
    // column is a full date, first-of-month by convention.
    const periodMonth = form.documentType === 'payslip' ? `${form.periodMonth}-01` : undefined;

    setSubmitting(true);
    try {
      setUploadStage('requesting');
      const { documentId, uploadUrl, key, version } = await documentsApi.getUploadUrl({
        employeeId: form.employeeId,
        documentType: form.documentType,
        fileName: file.name,
        contentType: file.type,
        fileSizeBytes: file.size,
        periodMonth,
      });

      setUploadStage('uploading');
      await uploadToPresignedUrl(uploadUrl, file, file.type);

      setUploadStage('registering');
      await documentsApi.create({
        documentId,
        employeeId: form.employeeId,
        documentType: form.documentType,
        fileKey: key,
        fileName: file.name,
        version,
        expiryDate: form.expiryDate || undefined,
        periodMonth,
      });

      setFormSuccess('Document uploaded.');
      setForm(EMPTY_FORM);
      setFile(null);
      document.getElementById('document-file-input').value = '';
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err : new Error('Upload failed'));
    } finally {
      setSubmitting(false);
      setUploadStage(null);
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

  const openDocument = async (doc, mode) => {
    setRowError(null);
    setRowBusy(`${doc.id}:${mode}`);
    try {
      const { url } = mode === 'view' ? await documentsApi.getViewUrl(doc.id) : await documentsApi.getDownloadUrl(doc.id);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setRowError(err instanceof ApiError ? err : new Error(`Failed to open document`));
    } finally {
      setRowBusy(null);
    }
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Permanently delete this ${doc.documentType.replace(/_/g, ' ')} (v${doc.version})? This cannot be undone.`)) {
      return;
    }
    setRowError(null);
    setRowBusy(`${doc.id}:delete`);
    try {
      await documentsApi.remove(doc.id);
      reload();
    } catch (err) {
      setRowError(err instanceof ApiError ? err : new Error('Delete failed'));
    } finally {
      setRowBusy(null);
    }
  };

  const columns = [
    { key: 'employee', label: 'Employee', render: (row) => (row.Employee ? `${row.Employee.firstName} ${row.Employee.lastName}` : '—') },
    { key: 'documentType', label: 'Type', render: (row) => row.documentType.replace(/_/g, ' ') },
    { key: 'version', label: 'Version', render: (row) => `v${row.version}${row.isCurrent ? '' : ' (superseded)'}` },
    { key: 'periodMonth', label: 'Period', render: (row) => row.periodMonth || '—' },
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
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="btn-row">
          <button type="button" className="btn btn-small btn-secondary" disabled={rowBusy === `${row.id}:view`} onClick={() => openDocument(row, 'view')}>
            {rowBusy === `${row.id}:view` ? '…' : 'View'}
          </button>
          <button type="button" className="btn btn-small btn-secondary" disabled={rowBusy === `${row.id}:download`} onClick={() => openDocument(row, 'download')}>
            {rowBusy === `${row.id}:download` ? '…' : 'Download'}
          </button>
          {canDelete && (
            <button type="button" className="btn btn-small btn-danger" disabled={rowBusy === `${row.id}:delete`} onClick={() => handleDelete(row)}>
              {rowBusy === `${row.id}:delete` ? '…' : 'Delete'}
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
          <h1>Documents</h1>
          <p className="page-subtitle">
            Re-uploading a document of the same type creates a new version rather than overwriting the old one.
            Files are stored privately - View/Download issue a short-lived link, never a public URL.
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
          <div className="field field-full">
            <label>File * (PDF, JPG or PNG, max 10 MB)</label>
            <input id="document-file-input" type="file" required accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={handleFileChange} />
          </div>
          <div className="field">
            <label>Expiry date</label>
            <input type="date" value={form.expiryDate} onChange={(e) => setField('expiryDate', e.target.value)} />
          </div>
          {form.documentType === 'payslip' && (
            <div className="field">
              <label>Payslip month/year *</label>
              <input type="month" required value={form.periodMonth} onChange={(e) => setField('periodMonth', e.target.value)} />
            </div>
          )}
        </div>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting
              ? { requesting: 'Preparing upload…', uploading: 'Uploading…', registering: 'Saving…' }[uploadStage] || 'Uploading…'
              : 'Upload document'}
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
