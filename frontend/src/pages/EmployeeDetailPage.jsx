import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useApiData } from '../hooks/useApiData';
import { employeesApi, emergencyContactsApi, contractHistoryApi, visaRecordsApi, identityDocumentsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Loading, ErrorBanner, SuccessBanner } from '../components/Feedback';
import { StatusBadge } from '../components/Badges';
import DataTable from '../components/DataTable';
import HistoryRecordCard from '../components/HistoryRecordCard';
import { ApiError } from '../api/client';

const EMPLOYMENT_STATUSES = ['active', 'on_leave', 'suspended', 'terminated'];

const CONTACT_FIELDS = ['telephone', 'addressLine1', 'addressLine2', 'city', 'postcode'];

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useApiData(() => employeesApi.get(id), [id]);

  const [form, setForm] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [saving, setSaving] = useState(false);

  // Hook calls must stay unconditional (before the loading/error early
  // returns below), even though the values they produce are only used
  // further down once `employee` is available.
  const {
    data: contactsData,
    loading: contactsLoading,
    error: contactsError,
    reload: reloadContacts,
  } = useApiData(() => emergencyContactsApi.list(id), [id]);
  const [contactForm, setContactForm] = useState({ name: '', relationship: '', telephone: '', address: '' });
  const [contactFormError, setContactFormError] = useState(null);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [editingContactId, setEditingContactId] = useState(null);
  const [editingContact, setEditingContact] = useState(null);
  const [contactActionError, setContactActionError] = useState(null);

  const canEditContracts = ['SUPER_ADMIN', 'EMPLOYER_ADMIN', 'HR_MANAGER', 'MANAGER'].includes(user.role);
  const {
    data: contractData,
    loading: contractLoading,
    error: contractError,
    reload: reloadContracts,
  } = useApiData(() => contractHistoryApi.list(id), [id]);

  const { data: visaData } = useApiData(() => visaRecordsApi.list(id), [id]);
  const { data: passportData } = useApiData(() => identityDocumentsApi.list(id), [id]);
  const currentVisa = visaData?.records?.find((r) => r.isCurrent);
  const currentPassport = passportData?.documents?.find((d) => d.isCurrent);

  useEffect(() => {
    if (data?.employee) setForm({ ...data.employee });
  }, [data]);

  if (loading) return <Loading />;
  if (error) return <ErrorBanner error={error} />;
  if (!form) return null;

  const employee = data.employee;
  const isOwnRecordAsEmployee = user.role === 'EMPLOYEE' && user.employeeId === employee.id;
  // Only 'full' access roles can delete/terminate per the backend (Manager has
  // 'limited': read/create/update but never delete).
  const canTerminate = ['SUPER_ADMIN', 'EMPLOYER_ADMIN', 'HR_MANAGER'].includes(user.role);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);
    setSaving(true);
    try {
      // Employees editing their own record: only contact fields are sent -
      // the backend would silently ignore the rest anyway, but there's no
      // reason to pretend the others are editable in the UI.
      const payload = isOwnRecordAsEmployee
        ? Object.fromEntries(CONTACT_FIELDS.map((key) => [key, form[key]]))
        : {
            firstName: form.firstName,
            lastName: form.lastName,
            dateOfBirth: form.dateOfBirth,
            addressLine1: form.addressLine1,
            addressLine2: form.addressLine2,
            city: form.city,
            postcode: form.postcode,
            telephone: form.telephone,
            email: form.email,
            jobTitle: form.jobTitle,
            startDate: form.startDate,
            employmentStatus: form.employmentStatus,
            terminationDate: form.terminationDate,
            salary: form.salary,
            workLocation: form.workLocation,
            probationEndDate: form.probationEndDate,
            contractEndDate: form.contractEndDate,
          };
      await employeesApi.update(id, payload);
      setSaveSuccess('Employee updated.');
      reload();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err : new Error('Save failed'));
    } finally {
      setSaving(false);
    }
  };

  // --- Next of kin / emergency contacts -------------------------------------
  // Decision: an employee can fully manage their own next-of-kin entries
  // (FEATURES.EMERGENCY_CONTACTS grants EMPLOYEE 'self_full' on the
  // backend) rather than this being HR-only, mirroring the existing
  // "employee edits own contact fields" pattern above - it's personal,
  // low-stakes data with no compliance/audit need, so there's no reason to
  // make HR a bottleneck for someone updating their sister's phone number.
  const canDeleteContacts = isOwnRecordAsEmployee || ['SUPER_ADMIN', 'EMPLOYER_ADMIN', 'HR_MANAGER'].includes(user.role);

  const setContactField = (key, value) => setContactForm((prev) => ({ ...prev, [key]: value }));

  const handleAddContact = async (e) => {
    e.preventDefault();
    setContactFormError(null);
    setContactSubmitting(true);
    try {
      await emergencyContactsApi.create({ ...contactForm, employeeId: id });
      setContactForm({ name: '', relationship: '', telephone: '', address: '' });
      reloadContacts();
    } catch (err) {
      setContactFormError(err instanceof ApiError ? err : new Error('Failed to add contact'));
    } finally {
      setContactSubmitting(false);
    }
  };

  const startEditContact = (contact) => {
    setEditingContactId(contact.id);
    setEditingContact({ name: contact.name, relationship: contact.relationship, telephone: contact.telephone, address: contact.address });
  };

  const handleSaveContact = async (contactId) => {
    setContactActionError(null);
    try {
      await emergencyContactsApi.update(contactId, editingContact);
      setEditingContactId(null);
      reloadContacts();
    } catch (err) {
      setContactActionError(err instanceof ApiError ? err : new Error('Failed to save contact'));
    }
  };

  const handleDeleteContact = async (contactId) => {
    if (!window.confirm('Remove this next-of-kin entry?')) return;
    setContactActionError(null);
    try {
      await emergencyContactsApi.remove(contactId);
      reloadContacts();
    } catch (err) {
      setContactActionError(err instanceof ApiError ? err : new Error('Failed to delete contact'));
    }
  };

  const contactColumns = [
    {
      key: 'name',
      label: 'Name',
      render: (row) => (editingContactId === row.id ? <input value={editingContact.name} onChange={(e) => setEditingContact((p) => ({ ...p, name: e.target.value }))} /> : row.name),
    },
    {
      key: 'relationship',
      label: 'Relationship',
      render: (row) =>
        editingContactId === row.id ? (
          <input value={editingContact.relationship || ''} onChange={(e) => setEditingContact((p) => ({ ...p, relationship: e.target.value }))} />
        ) : (
          row.relationship || '—'
        ),
    },
    {
      key: 'telephone',
      label: 'Telephone',
      render: (row) =>
        editingContactId === row.id ? (
          <input value={editingContact.telephone || ''} onChange={(e) => setEditingContact((p) => ({ ...p, telephone: e.target.value }))} />
        ) : (
          row.telephone || '—'
        ),
    },
    {
      key: 'address',
      label: 'Address',
      render: (row) =>
        editingContactId === row.id ? (
          <input value={editingContact.address || ''} onChange={(e) => setEditingContact((p) => ({ ...p, address: e.target.value }))} />
        ) : (
          row.address || '—'
        ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => (
        <div className="btn-row">
          {editingContactId === row.id ? (
            <>
              <button type="button" className="btn btn-small btn-success" onClick={() => handleSaveContact(row.id)}>
                Save
              </button>
              <button type="button" className="btn btn-small btn-secondary" onClick={() => setEditingContactId(null)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-small btn-secondary" onClick={() => startEditContact(row)}>
                Edit
              </button>
              {canDeleteContacts && (
                <button type="button" className="btn btn-small btn-danger" onClick={() => handleDeleteContact(row.id)}>
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      ),
    },
  ];

  const handleTerminate = async () => {
    if (!window.confirm(`Terminate ${employee.firstName} ${employee.lastName}? This soft-deletes the record.`)) return;
    setSaveError(null);
    try {
      await employeesApi.terminate(id);
      setSaveSuccess('Employee marked as terminated.');
      reload();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err : new Error('Terminate failed'));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>
            {employee.firstName} {employee.lastName}
          </h1>
          <p className="page-subtitle">
            {employee.employeeNumber} · {employee.jobTitle || 'No job title'} ·{' '}
            <StatusBadge status={employee.employmentStatus} />
            {employee.effectiveStatus === 'starting_soon' && (
              <>
                {' '}
                <StatusBadge status="starting_soon" /> <span className="muted">(starts {employee.startDate})</span>
              </>
            )}
          </p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/employees')}>
          ← Back to list
        </button>
      </div>

      <ErrorBanner error={saveError} />
      <SuccessBanner message={saveSuccess} />

      <form className="card" onSubmit={handleSave}>
        <h2>Personal details</h2>
        <div className="form-grid">
          <div className="field">
            <label>First name</label>
            <input value={form.firstName || ''} disabled={isOwnRecordAsEmployee} onChange={(e) => setField('firstName', e.target.value)} />
          </div>
          <div className="field">
            <label>Last name</label>
            <input value={form.lastName || ''} disabled={isOwnRecordAsEmployee} onChange={(e) => setField('lastName', e.target.value)} />
          </div>
          <div className="field">
            <label>Date of birth</label>
            <input type="date" value={form.dateOfBirth || ''} disabled={isOwnRecordAsEmployee} onChange={(e) => setField('dateOfBirth', e.target.value)} />
          </div>
          <div className="field">
            <label>Email</label>
            <input type="email" value={form.email || ''} disabled={isOwnRecordAsEmployee} onChange={(e) => setField('email', e.target.value)} />
          </div>
          <div className="field">
            <label>Telephone</label>
            <input value={form.telephone || ''} onChange={(e) => setField('telephone', e.target.value)} />
          </div>
          <div className="field">
            <label>Address line 1</label>
            <input value={form.addressLine1 || ''} onChange={(e) => setField('addressLine1', e.target.value)} />
          </div>
          <div className="field">
            <label>Address line 2</label>
            <input value={form.addressLine2 || ''} onChange={(e) => setField('addressLine2', e.target.value)} />
          </div>
          <div className="field">
            <label>City</label>
            <input value={form.city || ''} onChange={(e) => setField('city', e.target.value)} />
          </div>
          <div className="field">
            <label>Postcode</label>
            <input value={form.postcode || ''} onChange={(e) => setField('postcode', e.target.value)} />
          </div>
        </div>

        <h2 style={{ marginTop: 24 }}>Employment details</h2>
        <div className="form-grid">
          <div className="field">
            <label>Job title</label>
            <input value={form.jobTitle || ''} disabled={isOwnRecordAsEmployee} onChange={(e) => setField('jobTitle', e.target.value)} />
          </div>
          <div className="field">
            <label>Employment status</label>
            <select value={form.employmentStatus || ''} disabled={isOwnRecordAsEmployee} onChange={(e) => setField('employmentStatus', e.target.value)}>
              {EMPLOYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Start date</label>
            <input type="date" value={form.startDate || ''} disabled={isOwnRecordAsEmployee} onChange={(e) => setField('startDate', e.target.value)} />
          </div>
          <div className="field">
            <label>Termination date</label>
            <input type="date" value={form.terminationDate || ''} disabled={isOwnRecordAsEmployee} onChange={(e) => setField('terminationDate', e.target.value)} />
          </div>
          <div className="field">
            <label>Work location</label>
            <input value={form.workLocation || ''} disabled={isOwnRecordAsEmployee} onChange={(e) => setField('workLocation', e.target.value)} />
          </div>
          <div className="field">
            <label>Salary</label>
            <input type="number" value={form.salary || ''} disabled={isOwnRecordAsEmployee} onChange={(e) => setField('salary', e.target.value)} />
          </div>
          <div className="field">
            <label>Probation end date</label>
            <input type="date" value={form.probationEndDate || ''} disabled={isOwnRecordAsEmployee} onChange={(e) => setField('probationEndDate', e.target.value)} />
          </div>
          <div className="field">
            <label>Contract end date</label>
            <input type="date" value={form.contractEndDate || ''} disabled={isOwnRecordAsEmployee} onChange={(e) => setField('contractEndDate', e.target.value)} />
          </div>
          <div className="field">
            <label>Manager</label>
            <input value={employee.manager ? `${employee.manager.firstName} ${employee.manager.lastName}` : '—'} disabled />
          </div>
        </div>

        {employee.ImmigrationDetail && (
          <>
            <h2 style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
              Right-to-work / compliance
              <Link to="/right-to-work" style={{ fontSize: 12, fontWeight: 500 }}>
                Edit on the Right to Work page →
              </Link>
            </h2>
            {/* Read-only here: this record is gated by the RIGHT_TO_WORK
                permission (view for Manager, edit for HR+), a different -
                and stricter - gate than the EMPLOYEES permission this form
                otherwise uses, so editing lives on the Right to Work page. */}
            <div className="form-grid">
              <div className="field">
                <label>Nationality</label>
                <input value={employee.ImmigrationDetail.nationality || '—'} disabled />
              </div>
              <div className="field">
                <label>Right-to-work status</label>
                <input value={employee.ImmigrationDetail.rightToWorkStatus || '—'} disabled />
              </div>
              <div className="field">
                <label>Current visa expiry</label>
                <input value={currentVisa?.expiryDate || '—'} disabled />
              </div>
              <div className="field">
                <label>Current passport expiry</label>
                <input value={currentPassport?.expiryDate || '—'} disabled />
              </div>
              <div className="field">
                <label>EU Settlement Scheme status</label>
                <input value={(employee.ImmigrationDetail.settlementStatus || 'not_applicable').replace(/_/g, ' ')} disabled />
              </div>
              <div className="field">
                <label>Compliance status</label>
                <input value={employee.ImmigrationDetail.complianceStatus || '—'} disabled />
              </div>
            </div>
          </>
        )}

        <div className="btn-row" style={{ marginTop: 20 }}>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          {canTerminate && employee.employmentStatus !== 'terminated' && (
            <button type="button" className="btn btn-danger" onClick={handleTerminate}>
              Terminate employee
            </button>
          )}
        </div>
      </form>

      <HistoryRecordCard
        title="Contract history"
        hint="Past, current and scheduled future versions of this employee's job title, salary, hours and contract end date. A change with a future effective date shows as Scheduled and doesn't affect the current record until that date arrives."
        records={contractData?.versions?.map((v) => ({
          ...v,
          statusLabel: v.isCurrent ? 'Current' : v.effectiveFrom > new Date().toISOString().slice(0, 10) ? 'Scheduled' : 'Past',
        }))}
        loading={contractLoading}
        error={contractError}
        canEdit={canEditContracts}
        emptyForm={{ effectiveFrom: '', jobTitle: '', salary: '', contractedHoursPerWeek: '', contractEndDate: '', workLocation: '', changeReason: '' }}
        submitLabel="Add contract change"
        columns={[
          { key: 'effectiveFrom', label: 'Effective From' },
          { key: 'effectiveTo', label: 'Effective To', render: (r) => r.effectiveTo || '—' },
          { key: 'jobTitle', label: 'Job Title' },
          { key: 'salary', label: 'Salary' },
          { key: 'contractedHoursPerWeek', label: 'Hours/Week' },
          { key: 'statusLabel', label: 'Status', render: (r) => <StatusBadge status={r.isCurrent ? 'active' : r.statusLabel === 'Scheduled' ? 'pending' : 'closed'} /> },
        ]}
        formFields={[
          { key: 'effectiveFrom', label: 'Effective from', type: 'date' },
          { key: 'jobTitle', label: 'Job title' },
          { key: 'salary', label: 'Salary', type: 'number' },
          { key: 'contractedHoursPerWeek', label: 'Contracted hours/week', type: 'number' },
          { key: 'contractEndDate', label: 'Contract end date', type: 'date' },
          { key: 'workLocation', label: 'Work location' },
          { key: 'changeReason', label: 'Reason for change' },
        ]}
        onSubmit={async (values) => {
          await contractHistoryApi.create(id, values);
          reloadContracts();
          reload();
        }}
      />

      <div className="card">
        <h2>Next of kin / emergency contacts</h2>
        {contactsLoading && <Loading />}
        <ErrorBanner error={contactsError} />
        <ErrorBanner error={contactActionError} />
        {contactsData && (
          <DataTable columns={contactColumns} rows={contactsData.contacts} emptyLabel="No next-of-kin details on file." />
        )}

        <form onSubmit={handleAddContact} style={{ marginTop: 16 }}>
          <ErrorBanner error={contactFormError} />
          <div className="form-grid">
            <div className="field">
              <label>Name *</label>
              <input required value={contactForm.name} onChange={(e) => setContactField('name', e.target.value)} />
            </div>
            <div className="field">
              <label>Relationship</label>
              <input value={contactForm.relationship} onChange={(e) => setContactField('relationship', e.target.value)} placeholder="e.g. Spouse, Parent" />
            </div>
            <div className="field">
              <label>Telephone</label>
              <input value={contactForm.telephone} onChange={(e) => setContactField('telephone', e.target.value)} />
            </div>
            <div className="field">
              <label>Address</label>
              <input value={contactForm.address} onChange={(e) => setContactField('address', e.target.value)} />
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button type="submit" className="btn btn-secondary" disabled={contactSubmitting}>
              {contactSubmitting ? 'Adding…' : '+ Add next of kin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
