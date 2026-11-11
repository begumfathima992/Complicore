import { useApiData } from '../hooks/useApiData';
import { employeesApi } from '../api';

/**
 * <select> of employees within the caller's scope (the backend already
 * filters GET /api/employees by role - an Employee sees only themself, a
 * Manager sees their team, HR+ sees the company). Used anywhere a form
 * needs to name "which employee is this for".
 */
export default function EmployeePicker({
  value,
  onChange,
  id = 'employeeId',
  required = true,
  label = 'Employee',
  placeholder,
}) {
  const { data, loading, error } = useApiData(() => employeesApi.list(), []);
  const employees = data?.employees || [];
  const emptyLabel = loading ? 'Loading…' : placeholder || (required ? 'Select an employee' : 'Any employee');

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} required={required} value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={loading}>
        <option value="">{emptyLabel}</option>
        {employees.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.firstName} {emp.lastName} ({emp.employeeNumber})
          </option>
        ))}
      </select>
      {error && <span style={{ color: 'var(--color-danger)', fontSize: 12 }}>{error.message}</span>}
    </div>
  );
}
