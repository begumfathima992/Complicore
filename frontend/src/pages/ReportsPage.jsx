import { useState } from 'react';
import { useApiData } from '../hooks/useApiData';
import { reportsApi } from '../api';
import { Loading, ErrorBanner, EmptyState } from '../components/Feedback';
import DataTable from '../components/DataTable';
import EmployeePicker from '../components/EmployeePicker';
import { ApiError } from '../api/client';
import { downloadBlob } from '../utils/download';

const CATEGORY_LABELS = { employee: 'Employee Reports', compliance: 'Compliance Reports', hr: 'HR Reports' };
const EMPTY_FILTERS = { from: '', to: '', departmentId: '', employeeId: '', status: '', location: '', managerId: '' };

export default function ReportsPage() {
  const { data: reportList, loading: listLoading, error: listError } = useApiData(() => reportsApi.list(), []);

  const [selectedKey, setSelectedKey] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const runReport = async () => {
    if (!selectedKey) return;
    setRunning(true);
    setRunError(null);
    try {
      const data = await reportsApi.run(selectedKey, filters);
      setResult(data);
    } catch (err) {
      setRunError(err instanceof ApiError ? err : new Error('Failed to run report'));
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  const handleDownload = async (format) => {
    if (!selectedKey) return;
    setDownloading(format);
    setRunError(null);
    try {
      const { blob, filename } = await reportsApi.download(selectedKey, format, filters);
      downloadBlob(blob, filename);
    } catch (err) {
      setRunError(err instanceof ApiError ? err : new Error('Download failed'));
    } finally {
      setDownloading(null);
    }
  };

  const selectReport = (key) => {
    setSelectedKey(key);
    setResult(null);
    setRunError(null);
  };

  const grouped = (reportList?.reports || []).reduce((acc, r) => {
    (acc[r.category] = acc[r.category] || []).push(r);
    return acc;
  }, {});

  const selectedDef = reportList?.reports.find((r) => r.key === selectedKey);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reports</h1>
          <p className="page-subtitle">Run a report on demand as a table, or export it as CSV, Excel, or PDF.</p>
        </div>
      </div>

      {listLoading && <Loading />}
      <ErrorBanner error={listError} />

      <div className="two-col">
        <div>
          {Object.entries(CATEGORY_LABELS).map(([cat, label]) =>
            grouped[cat]?.length ? (
              <div className="card" key={cat}>
                <h2>{label}</h2>
                <div className="tag-row">
                  {grouped[cat].map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      className={`btn btn-small ${selectedKey === r.key ? '' : 'btn-secondary'}`}
                      disabled={!r.available}
                      title={!r.available ? 'You do not have permission for this report' : undefined}
                      onClick={() => selectReport(r.key)}
                    >
                      {r.label}
                      {!r.available ? ' 🔒' : ''}
                    </button>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>

        <div className="card">
          <h2>Filters</h2>
          {!selectedKey && <p className="muted">Select a report on the left to configure filters and run it.</p>}
          {selectedKey && (
            <>
              <div className="form-grid">
                <div className="field">
                  <label>From</label>
                  <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
                </div>
                <div className="field">
                  <label>To</label>
                  <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
                </div>
                <EmployeePicker
                  value={filters.employeeId}
                  onChange={(v) => setFilter('employeeId', v)}
                  required={false}
                  label="Employee"
                />
                <EmployeePicker
                  value={filters.managerId}
                  onChange={(v) => setFilter('managerId', v)}
                  required={false}
                  label="Manager"
                  placeholder="Any manager"
                />
                <div className="field">
                  <label>Department ID</label>
                  <input value={filters.departmentId} onChange={(e) => setFilter('departmentId', e.target.value)} />
                </div>
                <div className="field">
                  <label>Status</label>
                  <input value={filters.status} onChange={(e) => setFilter('status', e.target.value)} placeholder="e.g. active, approved" />
                </div>
                <div className="field">
                  <label>Location</label>
                  <input value={filters.location} onChange={(e) => setFilter('location', e.target.value)} />
                </div>
              </div>

              <div className="btn-row" style={{ marginTop: 16 }}>
                <button type="button" className="btn" onClick={runReport} disabled={running}>
                  {running ? 'Running…' : 'Run report'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => handleDownload('csv')} disabled={downloading === 'csv'}>
                  {downloading === 'csv' ? 'Downloading…' : 'Download CSV'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => handleDownload('excel')} disabled={downloading === 'excel'}>
                  {downloading === 'excel' ? 'Downloading…' : 'Download Excel'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => handleDownload('pdf')} disabled={downloading === 'pdf'}>
                  {downloading === 'pdf' ? 'Downloading…' : 'Download PDF'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <ErrorBanner error={runError} />

      {selectedDef && result && (
        <div className="card">
          <h2>{selectedDef.label} results</h2>
          {result.rows.length === 0 ? (
            <EmptyState label="This report returned no rows for the selected filters." />
          ) : (
            <DataTable columns={result.columns} rows={result.rows} rowKey={result.columns[0]?.key} />
          )}
        </div>
      )}
    </div>
  );
}
