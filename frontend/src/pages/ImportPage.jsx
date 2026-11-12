import { useState } from 'react';
import { importApi, companiesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { useApiData } from '../hooks/useApiData';
import { ErrorBanner, SuccessBanner } from '../components/Feedback';
import { downloadBlob } from '../utils/download';
import { ApiError } from '../api/client';

const SHEETS = [
  { key: 'employees', label: 'Employees (new starters)' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'contracts', label: 'Contract changes' },
  { key: 'visas', label: 'Visas' },
];

export default function ImportPage() {
  const { user } = useAuth();
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const { data: companyData } = useApiData(() => (isSuperAdmin ? companiesApi.list() : Promise.resolve(null)), [isSuperAdmin]);

  const [sheet, setSheet] = useState('employees');
  const [companyId, setCompanyId] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const resetResults = () => {
    setPreview(null);
    setCommitResult(null);
    setError(null);
  };

  const handleTemplate = async () => {
    try {
      const { blob, filename } = await importApi.template();
      downloadBlob(blob, filename);
    } catch (err) {
      setError(err instanceof ApiError ? err : new Error('Template download failed'));
    }
  };

  const handlePreview = async (e) => {
    e.preventDefault();
    if (!file) return;
    setError(null);
    setCommitResult(null);
    setBusy(true);
    try {
      const result = await importApi.preview(sheet, file, companyId);
      setPreview(result);
    } catch (err) {
      setError(err instanceof ApiError ? err : new Error('Preview failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async () => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const result = await importApi.commit(sheet, file, companyId);
      setCommitResult(result);
      setPreview(null);
    } catch (err) {
      setError(err instanceof ApiError ? err : new Error('Import failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Bulk Import</h1>
          <p className="page-subtitle">
            Upload an Excel sheet of employees, attendance, contract changes or visas. Past and present rows are
            applied as actual records; future rows are only accepted for planned items (new starters, scheduled
            contract changes, visas not yet started) - a future row of worked hours is rejected, row by row, without
            failing the rest of the file.
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={handleTemplate}>
          Download template
        </button>
      </div>

      <form className="card" onSubmit={handlePreview}>
        <div className="form-grid">
          {isSuperAdmin && (
            <div className="field">
              <label>Company</label>
              <select
                required
                value={companyId}
                onChange={(e) => {
                  setCompanyId(e.target.value);
                  resetResults();
                }}
              >
                <option value="">Select a company</option>
                {(companyData?.companies || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label>Sheet</label>
            <select
              value={sheet}
              onChange={(e) => {
                setSheet(e.target.value);
                resetResults();
              }}
            >
              {SHEETS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>File (.xlsx, from the template above)</label>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                setFile(e.target.files[0] || null);
                resetResults();
              }}
            />
          </div>
        </div>
        <ErrorBanner error={error} />
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="submit" className="btn btn-secondary" disabled={!file || busy || (isSuperAdmin && !companyId)}>
            {busy ? 'Checking…' : 'Preview (dry run)'}
          </button>
          {preview && (
            <button type="button" className="btn" onClick={handleCommit} disabled={busy || preview.validCount === 0}>
              {busy ? 'Importing…' : `Commit ${preview.validCount} valid row(s)`}
            </button>
          )}
        </div>
      </form>

      {preview && (
        <div className="card">
          <h2>Preview</h2>
          <p>
            {preview.totalRows} row(s) read · {preview.validCount} valid · {preview.errors.length} with errors.
          </p>
          {preview.errors.length > 0 && (
            <ul>
              {preview.errors.map((e, i) => (
                <li key={i}>
                  Row {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {commitResult && (
        <div className="card">
          <SuccessBanner message={`Imported ${commitResult.committed} of ${commitResult.totalRows} row(s).`} />
          {commitResult.errors.length > 0 && (
            <>
              <p>{commitResult.errors.length} row(s) were skipped:</p>
              <ul>
                {commitResult.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
