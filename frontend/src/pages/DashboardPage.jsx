import { useApiData } from '../hooks/useApiData';
import { dashboardApi } from '../api';
import { Loading, ErrorBanner } from '../components/Feedback';

const TILES = [
  { key: 'employees', label: 'Employees' },
  { key: 'verified', label: 'Verified' },
  { key: 'expiring', label: 'Expiring' },
  { key: 'missingDocs', label: 'Missing Docs' },
  { key: 'expired', label: 'Expired' },
  { key: 'openAlerts', label: 'Open Alerts' },
];

export default function DashboardPage() {
  const { data, loading, error } = useApiData(() => dashboardApi.compliance(), []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Compliance Overview</h1>
          <p className="page-subtitle">A snapshot of employee and sponsor compliance status.</p>
        </div>
      </div>

      {loading && <Loading />}
      <ErrorBanner error={error} />

      {data && (
        <>
          <div className="tile-grid">
            {TILES.map((tile) => (
              <div className="tile" key={tile.key}>
                <div className="tile-value">{data[tile.key]}</div>
                <div className="tile-label">{tile.label}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>Compliance Score</h2>
            <div className="score-bar-track">
              <div className="score-bar-fill" style={{ width: `${data.internalComplianceScore}%` }} />
            </div>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 12 }}>{data.internalComplianceScore}%</div>
            {/* Disclaimer is always visible inline - never hidden behind a tooltip. */}
            <div className="disclaimer">{data.disclaimer}</div>
          </div>
        </>
      )}
    </div>
  );
}
