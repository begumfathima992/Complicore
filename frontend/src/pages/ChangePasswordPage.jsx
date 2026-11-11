import { useState } from 'react';
import { authApi } from '../api';
import { ErrorBanner, SuccessBanner } from '../components/Feedback';
import { ApiError } from '../api/client';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError(new Error("New password and confirmation don't match."));
      return;
    }

    setSubmitting(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setSuccess('Password updated.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err : new Error('Failed to change password'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Change Password</h1>
          <p className="page-subtitle">Update the password for your own account.</p>
        </div>
      </div>

      <form className="card" style={{ maxWidth: 420 }} onSubmit={handleSubmit}>
        <ErrorBanner error={error} />
        <SuccessBanner message={success} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label>Current password *</label>
            <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>New password *</label>
            <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="field">
            <label>Confirm new password *</label>
            <input type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 18 }}>
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </form>
    </div>
  );
}
