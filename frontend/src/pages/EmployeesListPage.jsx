import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApiData } from '../hooks/useApiData';
import { employeesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Loading, ErrorBanner } from '../components/Feedback';
import { StatusBadge } from '../components/Badges';
import DataTable from '../components/DataTable';

export default function EmployeesListPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
  const { data, loading, error } = useApiData(() => employeesApi.list(submittedSearch), [submittedSearch]);

  const canCreate = user.role !== 'EMPLOYEE';

  const columns = [
    { key: 'employeeNumber', label: 'Employee #' },
    {
      key: 'name',
      label: 'Name',
      render: (row) => (
        <Link to={`/employees/${row.id}`}>
          {row.firstName} {row.lastName}
        </Link>
      ),
    },
    { key: 'jobTitle', label: 'Job Title' },
    { key: 'department', label: 'Department', render: (row) => row.Department?.name },
    { key: 'employmentStatus', label: 'Status', render: (row) => <StatusBadge status={row.employmentStatus} /> },
    { key: 'workLocation', label: 'Location' },
    { key: 'startDate', label: 'Start Date' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Employees</h1>
          <p className="page-subtitle">Employee directory, scoped to what your role can see.</p>
        </div>
        {canCreate && (
          <Link to="/employees/new" className="btn">
            + New Employee
          </Link>
        )}
      </div>

      <form
        className="filter-bar"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmittedSearch(search);
        }}
      >
        <div className="field">
          <label htmlFor="search">Search</label>
          <input id="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or employee #" />
        </div>
        <button type="submit" className="btn btn-secondary">
          Search
        </button>
      </form>

      {loading && <Loading />}
      <ErrorBanner error={error} />
      {data && <DataTable columns={columns} rows={data.employees} emptyLabel="No employees found." />}
    </div>
  );
}
