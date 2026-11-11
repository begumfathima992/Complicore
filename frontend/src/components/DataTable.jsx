import { EmptyState } from './Feedback';

/**
 * Generic table: columns = [{ key, label, render? }], rows = plain objects.
 * `render(row)` lets a caller customise a cell (badges, links, buttons)
 * without needing a bespoke table component per page.
 */
export default function DataTable({ columns, rows, emptyLabel, rowKey = 'id' }) {
  if (!rows || rows.length === 0) return <EmptyState label={emptyLabel} />;

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row[rowKey] ?? i}>
              {columns.map((col) => (
                <td key={col.key}>{col.render ? col.render(row) : row[col.key] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
