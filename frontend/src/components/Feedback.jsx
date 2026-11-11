export function Loading({ label = 'Loading…' }) {
  return <div className="feedback feedback-loading">{label}</div>;
}

// Always renders the real backend message (err.message from ApiError),
// never a generic "something went wrong" string.
export function ErrorBanner({ error }) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message || 'Request failed';
  return (
    <div className="feedback feedback-error" role="alert">
      <strong>Error:</strong> {message}
    </div>
  );
}

export function SuccessBanner({ message }) {
  if (!message) return null;
  return (
    <div className="feedback feedback-success" role="status">
      {message}
    </div>
  );
}

export function EmptyState({ label = 'Nothing here yet.' }) {
  return <div className="feedback feedback-empty">{label}</div>;
}
