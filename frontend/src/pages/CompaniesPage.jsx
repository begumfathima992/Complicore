import { useEffect, useState } from 'react';
import { useApiData } from '../hooks/useApiData';
import { companiesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Loading, ErrorBanner, SuccessBanner } from '../components/Feedback';
import { StatusBadge } from '../components/Badges';
import DataTable from '../components/DataTable';
import { ApiError } from '../api/client';

const SPONSOR_TYPES = ['', 'A-rated', 'B-rated'];
const EMPTY_CREATE_FORM = { name: '', sponsorLicenseNumber: '', sponsorType: '', address: '' };

export default function CompaniesPage() {
  const { user } = useAuth();
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  const { data, loading, error, reload } = useApiData(() => companiesApi.list(), []);
  const [selectedId, setSelectedId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState(null);
  const [editSuccess, setEditSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createError, setCreateError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(null);
  const [creating, setCreating] = useState(false);

  const companies = data?.companies || [];
  const canEdit = isSuperAdmin || user.role === 'EMPLOYER_ADMIN';

  // Non-Super-Admin roles only ever have one company - select it
  // automatically rather than making them click a list of one.
  useEffect(() => {
    if (!isSuperAdmin && companies.length === 1 && !selectedId) {
      setSelectedId(companies[0].id);
      setEditForm({ ...companies[0] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companies.length]);

  const selectCompany = (company) => {
    setSelectedId(company.id);
    setEditForm({ ...company });
    setEditError(null);
    setEditSuccess(null);
  };

  const setEditField = (key, value) => setEditForm((prev) => ({ ...prev, [key]: value }));
  const setCreateField = (key, value) => setCreateForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setEditError(null);
    setEditSuccess(null);
    setSaving(true);
    try {
      const payload = isSuperAdmin
        ? { name: editForm.name, sponsorLicenseNumber: editForm.sponsorLicenseNumber, sponsorType: editForm.sponsorType, address: editForm.address, isActive: editForm.isActive }
        : { name: editForm.name, sponsorLicenseNumber: editForm.sponsorLicenseNumber, sponsorType: editForm.sponsorType, address: editForm.address };
      await companiesApi.update(selectedId, payload);
      setEditSuccess('Company updated.');
      reload();
    } catch (err) {
      setEditError(err instanceof ApiError ? err : new Error('Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setCreating(true);
    try {
      const { company } = await companiesApi.create(createForm);
      setCreateSuccess(`Company "${company.name}" created.`);
      setCreateForm(EMPTY_CREATE_FORM);
      reload();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err : new Error('Create failed'));
    } finally {
      setCreating(false);
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <button type="button" className="link-button" onClick={() => selectCompany(row)}>
          {row.name}
        </button>
      ),
    },
    { key: 'sponsorLicenseNumber', label: 'Sponsor Licence #' },
    { key: 'sponsorType', label: 'Sponsor Type' },
    { key: 'isActive', label: 'Status', render: (row) => <StatusBadge status={row.isActive ? 'active' : 'terminated'} /> },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Companies</h1>
          <p className="page-subtitle">
            {isSuperAdmin
              ? 'Sales-assisted onboarding: only Super Admin creates a new tenant company.'
              : 'Your company profile.'}
          </p>
        </div>
      </div>

      {isSuperAdmin && (
        <form className="card" onSubmit={handleCreate}>
          <h2>New company</h2>
          <ErrorBanner error={createError} />
          <SuccessBanner message={createSuccess} />
          <div className="form-grid">
            <div className="field">
              <label>Name *</label>
              <input required value={createForm.name} onChange={(e) => setCreateField('name', e.target.value)} />
            </div>
            <div className="field">
              <label>Sponsor licence number</label>
              <input value={createForm.sponsorLicenseNumber} onChange={(e) => setCreateField('sponsorLicenseNumber', e.target.value)} />
            </div>
            <div className="field">
              <label>Sponsor type</label>
              <select value={createForm.sponsorType} onChange={(e) => setCreateField('sponsorType', e.target.value)}>
                {SPONSOR_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t || '—'}
                  </option>
                ))}
              </select>
            </div>
            <div className="field field-full">
              <label>Address</label>
              <input value={createForm.address} onChange={(e) => setCreateField('address', e.target.value)} />
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button type="submit" className="btn" disabled={creating}>
              {creating ? 'Creating…' : 'Create company'}
            </button>
          </div>
        </form>
      )}

      {loading && <Loading />}
      <ErrorBanner error={error} />

      <div className={isSuperAdmin ? 'two-col' : ''}>
        <div>
          <div className="section-title">{isSuperAdmin ? 'All companies' : 'Your company'}</div>
          {data && <DataTable columns={columns} rows={companies} emptyLabel="No companies found." />}
        </div>

        {editForm && (
          <form className="card" onSubmit={handleSave}>
            <h2>{canEdit ? 'Edit company' : 'Company details'}</h2>
            {!canEdit && <p className="muted" style={{ fontSize: 12.5 }}>Your role has view-only access to company details.</p>}
            <ErrorBanner error={editError} />
            <SuccessBanner message={editSuccess} />
            <div className="form-grid">
              <div className="field">
                <label>Name</label>
                <input disabled={!canEdit} value={editForm.name || ''} onChange={(e) => setEditField('name', e.target.value)} />
              </div>
              <div className="field">
                <label>Sponsor licence number</label>
                <input disabled={!canEdit} value={editForm.sponsorLicenseNumber || ''} onChange={(e) => setEditField('sponsorLicenseNumber', e.target.value)} />
              </div>
              <div className="field">
                <label>Sponsor type</label>
                <select disabled={!canEdit} value={editForm.sponsorType || ''} onChange={(e) => setEditField('sponsorType', e.target.value)}>
                  {SPONSOR_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t || '—'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field field-full">
                <label>Address</label>
                <input disabled={!canEdit} value={editForm.address || ''} onChange={(e) => setEditField('address', e.target.value)} />
              </div>
              {isSuperAdmin && (
                <div className="field">
                  <label>Active</label>
                  <select value={editForm.isActive ? 'true' : 'false'} onChange={(e) => setEditField('isActive', e.target.value === 'true')}>
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                  <span className="muted" style={{ fontSize: 11 }}>
                    Only Super Admin can toggle this - a tenant can't deactivate itself.
                  </span>
                </div>
              )}
            </div>
            {canEdit && (
              <div className="btn-row" style={{ marginTop: 16 }}>
                <button type="submit" className="btn" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
