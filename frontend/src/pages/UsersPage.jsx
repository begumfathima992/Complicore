import { useState } from 'react';
import { useApiData } from '../hooks/useApiData';
import { usersApi, companiesApi, employeesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Loading, ErrorBanner, SuccessBanner } from '../components/Feedback';
import { StatusBadge } from '../components/Badges';
import DataTable from '../components/DataTable';
import EmployeePicker from '../components/EmployeePicker';
import { ApiError } from '../api/client';

// Frontend-only UX hint of which roles an actor can typically grant - the
// backend's canManageRole() (seniority-based) is the real, authoritative
// check; this just avoids offering obviously-doomed options in the <select>.
const GRANTABLE_ROLES = {
  SUPER_ADMIN: ['SUPER_ADMIN', 'EMPLOYER_ADMIN', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE'],
  EMPLOYER_ADMIN: ['HR_MANAGER', 'MANAGER', 'EMPLOYEE'],
  HR_MANAGER: ['MANAGER', 'EMPLOYEE'],
};

const EMPTY_FORM = { email: '', roleKey: '', employeeId: '', companyId: '' };

export default function UsersPage() {
  const { user } = useAuth();
  const isSuperAdmin = user.role === 'SUPER_ADMIN';
  const roleOptions = GRANTABLE_ROLES[user.role] || [];

  const { data, loading, error, reload } = useApiData(() => usersApi.list(), []);
  const { data: companyData } = useApiData(() => (isSuperAdmin ? companiesApi.list() : Promise.resolve(null)), [isSuperAdmin]);

  // Always starts at "Select a role" - including for Super Admin, who must
  // not have SUPER_ADMIN pre-selected by virtue of being first in the list.
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);
  const [createdCredential, setCreatedCredential] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ roleKey: '', employeeId: '' });

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setCreatedCredential(null);

    if (form.roleKey === 'SUPER_ADMIN') {
      const ok = window.confirm(
        `Grant Super Admin access to ${form.email}? This gives full access across every company. This action cannot be undone from here.`
      );
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      const payload = { email: form.email, roleKey: form.roleKey, employeeId: form.employeeId || undefined };
      if (isSuperAdmin) payload.companyId = form.companyId;
      if (form.roleKey === 'SUPER_ADMIN') payload.confirmSuperAdmin = true;
      const { user: newUser, temporaryPassword } = await usersApi.create(payload);
      setCreatedCredential({ email: newUser.email, temporaryPassword });
      setForm(EMPTY_FORM);
      reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err : new Error('Failed to create user'));
    } finally {
      setSubmitting(false);
    }
  };

  const act = async (fn) => {
    setActionError(null);
    try {
      await fn();
      reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err : new Error('Action failed'));
    }
  };

  const startEdit = (row) => {
    setActionError(null);
    setEditingId(row.id);
    setEditForm({ roleKey: row.Role?.key || '', employeeId: row.employeeId || '' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ roleKey: '', employeeId: '' });
  };

  const saveEdit = async (row) => {
    const payload = {};
    if (editForm.roleKey && editForm.roleKey !== row.Role?.key) {
      payload.roleKey = editForm.roleKey;
      if (editForm.roleKey === 'SUPER_ADMIN') {
        const ok = window.confirm(
          `Assign Super Admin to ${row.email}? This gives full access across every company. This action cannot be undone from here.`
        );
        if (!ok) return;
        payload.confirmSuperAdmin = true;
      }
    }
    if (editForm.employeeId !== (row.employeeId || '')) {
      payload.employeeId = editForm.employeeId || null;
    }
    await act(() => usersApi.update(row.id, payload));
    cancelEdit();
  };

  const { data: employeeData } = useApiData(() => (editingId ? employeesApi.list() : Promise.resolve(null)), [editingId]);
  const employees = employeeData?.employees || [];

  const columns = [
    { key: 'email', label: 'Email' },
    {
      key: 'role',
      label: 'Role',
      render: (row) => {
        if (editingId !== row.id) return row.Role?.name;
        const editRoleOptions = Array.from(new Set([row.Role?.key, ...roleOptions].filter(Boolean)));
        return (
          <select value={editForm.roleKey} onChange={(e) => setEditForm((prev) => ({ ...prev, roleKey: e.target.value }))}>
            {editRoleOptions.map((r) => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        );
      },
    },
    ...(isSuperAdmin ? [{ key: 'company', label: 'Company', render: (row) => row.Company?.name || '—' }] : []),
    {
      key: 'employee',
      label: 'Linked Employee',
      render: (row) => {
        if (editingId !== row.id) return row.Employee ? `${row.Employee.firstName} ${row.Employee.lastName}` : '—';
        return (
          <select value={editForm.employeeId} onChange={(e) => setEditForm((prev) => ({ ...prev, employeeId: e.target.value }))}>
            <option value="">Not linked</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName} ({emp.employeeNumber})
              </option>
            ))}
          </select>
        );
      },
    },
    { key: 'isActive', label: 'Status', render: (row) => <StatusBadge status={row.isActive ? 'active' : 'terminated'} /> },
    { key: 'lastLoginAt', label: 'Last Login', render: (row) => (row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString() : 'Never') },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => {
        if (editingId === row.id) {
          return (
            <div className="btn-row">
              <button type="button" className="btn btn-small" onClick={() => saveEdit(row)}>
                Save
              </button>
              <button type="button" className="btn btn-small btn-secondary" onClick={cancelEdit}>
                Cancel
              </button>
            </div>
          );
        }
        return row.id === user.id ? (
          <span className="muted">(you)</span>
        ) : (
          <div className="btn-row">
            <button type="button" className="btn btn-small btn-secondary" onClick={() => startEdit(row)}>
              Edit
            </button>
            {row.isActive ? (
              <button type="button" className="btn btn-small btn-danger" onClick={() => act(() => usersApi.deactivate(row.id))}>
                Deactivate
              </button>
            ) : (
              <button type="button" className="btn btn-small btn-success" onClick={() => act(() => usersApi.reactivate(row.id))}>
                Reactivate
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>User Management</h1>
          <p className="page-subtitle">
            {isSuperAdmin ? 'Create and manage login accounts across every company.' : 'Create and manage login accounts within your company.'}
          </p>
        </div>
      </div>

      <form className="card" onSubmit={handleSubmit}>
        <h2>New user</h2>
        <ErrorBanner error={formError} />
        {createdCredential && (
          <div className="feedback feedback-success">
            Account created for <strong>{createdCredential.email}</strong>. Temporary password (shown once - relay
            it to them out of band):
            <div style={{ fontFamily: 'monospace', fontSize: 16, marginTop: 6, userSelect: 'all' }}>
              {createdCredential.temporaryPassword}
            </div>
          </div>
        )}
        <div className="form-grid">
          <div className="field">
            <label>Email *</label>
            <input type="email" required value={form.email} onChange={(e) => setField('email', e.target.value)} />
          </div>
          <div className="field">
            <label>Role *</label>
            <select required value={form.roleKey} onChange={(e) => setField('roleKey', e.target.value)}>
              <option value="">Select a role</option>
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          {isSuperAdmin && (
            <div className="field">
              <label>Company *</label>
              <select required value={form.companyId} onChange={(e) => setField('companyId', e.target.value)}>
                <option value="">Select a company</option>
                {(companyData?.companies || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <EmployeePicker
            value={form.employeeId}
            onChange={(v) => setField('employeeId', v)}
            required={false}
            label="Link to employee (optional)"
          />
        </div>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create user'}
          </button>
        </div>
      </form>

      <div className="section-title">Users</div>
      <ErrorBanner error={actionError} />
      {loading && <Loading />}
      <ErrorBanner error={error} />
      {data && <DataTable columns={columns} rows={data.users} emptyLabel="No users found." />}
    </div>
  );
}
