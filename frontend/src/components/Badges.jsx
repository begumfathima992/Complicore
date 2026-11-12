const SEVERITY_CLASS = {
  info: 'badge-info',
  low: 'badge-low',
  medium: 'badge-medium',
  high: 'badge-high',
  critical: 'badge-critical',
};

export function SeverityBadge({ severity }) {
  if (!severity) return null;
  return <span className={`badge ${SEVERITY_CLASS[severity] || 'badge-default'}`}>{severity}</span>;
}

export function StatusBadge({ status }) {
  if (!status) return null;
  // Generic status colouring: green-ish for positive terminal states, amber
  // for pending, red for negative terminal states, grey otherwise.
  const positive = ['active', 'approved', 'verified', 'valid', 'resolved', 'published', 'closed'];
  const negative = ['terminated', 'rejected', 'expired', 'critical', 'cancelled', 'not_verified'];
  const pending = ['pending', 'pending_manager', 'pending_hr', 'pending_review', 'expiring_soon', 'open', 'draft', 'starting_soon'];

  let cls = 'badge-default';
  if (positive.includes(status)) cls = 'badge-low';
  else if (negative.includes(status)) cls = 'badge-critical';
  else if (pending.includes(status)) cls = 'badge-medium';

  return <span className={`badge ${cls}`}>{status.replace(/_/g, ' ')}</span>;
}
