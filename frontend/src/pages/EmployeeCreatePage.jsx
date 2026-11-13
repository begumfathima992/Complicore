import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeesApi } from '../api';
import { ErrorBanner } from '../components/Feedback';
import { ApiError } from '../api/client';
import { normalizeUkPhone, isValidUkPhone } from '../utils/ukValidators';

const EMPTY = {
  employeeNumber: '',
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  email: '',
  telephone: '',
  jobTitle: '',
  startDate: '',
  workLocation: '',
};

export default function EmployeeCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.telephone && !isValidUkPhone(normalizeUkPhone(form.telephone))) {
      setError(new Error('Phone must be a valid UK number, e.g. 07700 900000 or +44 7700 900000'));
      return;
    }

    setSubmitting(true);
    try {
      const { employee } = await employeesApi.create(form);
      navigate(`/employees/${employee.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err : new Error('Create failed'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>New Employee</h1>
          <p className="page-subtitle">Create a new employee profile.</p>
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/employees')}>
          Cancel
        </button>
      </div>

      <ErrorBanner error={error} />

      <form className="card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="field">
            <label>Employee number *</label>
            <input required value={form.employeeNumber} onChange={(e) => setField('employeeNumber', e.target.value)} />
          </div>
          <div className="field">
            <label>First name *</label>
            <input required value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} />
          </div>
          <div className="field">
            <label>Last name *</label>
            <input required value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} />
          </div>
          <div className="field">
            <label>Date of birth</label>
            <input type="date" value={form.dateOfBirth} onChange={(e) => setField('dateOfBirth', e.target.value)} />
          </div>
          <div className="field">
            <label>Email *</label>
            <input type="email" required value={form.email} onChange={(e) => setField('email', e.target.value)} />
          </div>
          <div className="field">
            <label>Phone</label>
            <input value={form.telephone} placeholder="e.g. 07700 900000" onChange={(e) => setField('telephone', e.target.value)} />
          </div>
          <div className="field">
            <label>Job title</label>
            <input value={form.jobTitle} onChange={(e) => setField('jobTitle', e.target.value)} />
          </div>
          <div className="field">
            <label>Start date</label>
            <input type="date" value={form.startDate} onChange={(e) => setField('startDate', e.target.value)} />
          </div>
          <div className="field">
            <label>Work location</label>
            <input value={form.workLocation} onChange={(e) => setField('workLocation', e.target.value)} />
          </div>
        </div>

        <div className="btn-row" style={{ marginTop: 20 }}>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create employee'}
          </button>
        </div>
      </form>
    </div>
  );
}
