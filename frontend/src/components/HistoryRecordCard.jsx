import { useState } from 'react';
import { Loading, ErrorBanner, SuccessBanner } from './Feedback';
import DataTable from './DataTable';
import { ApiError } from '../api/client';

/**
 * Generic past/current/future history list + "add a new record" form,
 * shared by the Visa history and Passport/identity-document history
 * sections (see RightToWorkPage.jsx and EmployeeDetailPage.jsx) - both are
 * "a list of dated records, exactly one of which may be current" with
 * different field sets, so only the field config differs between them.
 *
 * `formFields`: [{ key, label, type: 'text'|'date'|'checkbox', placeholder? }]
 * `columns`: DataTable columns for the history list.
 */
export default function HistoryRecordCard({ title, hint, records, loading, error, columns, formFields, emptyForm, onSubmit, submitLabel, canEdit }) {
  const [form, setForm] = useState(emptyForm);
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
      await onSubmit(form);
      setForm(emptyForm);
      setFormSuccess('Saved.');
    } catch (err) {
      setFormError(err instanceof ApiError ? err : new Error('Save failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card">
      <h2>{title}</h2>
      {hint && <p className="page-subtitle">{hint}</p>}

      {loading && <Loading />}
      <ErrorBanner error={error} />
      {records && <DataTable columns={columns} rows={records} emptyLabel="No history recorded yet." />}

      {canEdit && (
        <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
          <ErrorBanner error={formError} />
          <SuccessBanner message={formSuccess} />
          <div className="form-grid">
            {formFields.map((f) => (
              <div className="field" key={f.key}>
                <label>{f.label}</label>
                {f.type === 'checkbox' ? (
                  <input type="checkbox" checked={!!form[f.key]} onChange={(e) => setField(f.key, e.target.checked)} />
                ) : (
                  <input
                    type={f.type || 'text'}
                    placeholder={f.placeholder}
                    value={form[f.key] || ''}
                    onChange={(e) => setField(f.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button type="submit" className="btn btn-secondary" disabled={submitting}>
              {submitting ? 'Saving…' : submitLabel}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
