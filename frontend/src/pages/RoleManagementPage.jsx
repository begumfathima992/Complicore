import { useState } from 'react';
import { useApiData } from '../hooks/useApiData';
import { rolesApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Loading, ErrorBanner, SuccessBanner } from '../components/Feedback';
import { ApiError } from '../api/client';

export default function RoleManagementPage() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState(user.companyId || '');
  const effectiveCompanyId = user.role === 'SUPER_ADMIN' ? companyId : user.companyId;

  const { data: roleList, loading, error, reload: reloadRoleList } = useApiData(
    () => rolesApi.list(effectiveCompanyId),
    [effectiveCompanyId]
  );

  const [selectedRole, setSelectedRole] = useState(null);
  const {
    data: detail,
    loading: detailLoading,
    error: detailError,
    reload: reloadDetail,
  } = useApiData(
    () => (selectedRole ? rolesApi.permissions(selectedRole, effectiveCompanyId) : Promise.resolve(null)),
    [selectedRole, effectiveCompanyId]
  );

  const [toggleError, setToggleError] = useState(null);
  const [toggleSuccess, setToggleSuccess] = useState(null);
  const [togglingKey, setTogglingKey] = useState(null);

  const myLevel = roleList?.roles.find((r) => r.key === user.role)?.level ?? 0;

  const handleToggle = async (permissionKey, currentlyAllowed) => {
    setToggleError(null);
    setToggleSuccess(null);
    setTogglingKey(permissionKey);
    try {
      await rolesApi.updatePermission(selectedRole, permissionKey, !currentlyAllowed, effectiveCompanyId);
      setToggleSuccess(`'${permissionKey}' ${!currentlyAllowed ? 'restored' : 'restricted'} for ${selectedRole}.`);
      reloadDetail();
      reloadRoleList();
    } catch (err) {
      setToggleError(err instanceof ApiError ? err : new Error('Failed to update permission'));
    } finally {
      setTogglingKey(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Role Management</h1>
          <p className="page-subtitle">
            Restrict or restore a role's permissions within your company. This can only narrow a role below the
            platform default - never grant it something outside its built-in ceiling. A role can only manage roles
            strictly below its own seniority.
          </p>
        </div>
      </div>

      {user.role === 'SUPER_ADMIN' && (
        <div className="card">
          <div className="field">
            <label>Company ID (Super Admin must specify a target company)</label>
            <input value={companyId} onChange={(e) => setCompanyId(e.target.value)} placeholder="Paste a company UUID" />
          </div>
        </div>
      )}

      {loading && <Loading />}
      <ErrorBanner error={error} />

      {roleList && (
        <div className="two-col">
          <div className="card">
            <h2>Roles</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {roleList.roles.map((role) => (
                <button
                  key={role.key}
                  type="button"
                  className={`btn btn-small ${selectedRole === role.key ? '' : 'btn-secondary'}`}
                  style={{ justifyContent: 'flex-start' }}
                  onClick={() => setSelectedRole(role.key)}
                >
                  {role.name} · {role.permissions.length} permission(s)
                </button>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>{selectedRole ? `${selectedRole} permissions` : 'Select a role'}</h2>
            {toggleError && <ErrorBanner error={toggleError} />}
            <SuccessBanner message={toggleSuccess} />

            {detailLoading && <Loading />}
            {detailError && <ErrorBanner error={detailError} />}

            {detail && (
              <>
                {myLevel <= (roleList.roles.find((r) => r.key === selectedRole)?.level ?? 100) && (
                  <p className="muted" style={{ fontSize: 12.5 }}>
                    Your role cannot modify permissions for a role at or above its own seniority - toggles below are
                    read-only.
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  {detail.ceiling.map((key) => {
                    const allowed = detail.effective.includes(key);
                    const canManage =
                      myLevel > (roleList.roles.find((r) => r.key === selectedRole)?.level ?? 100);
                    return (
                      <label
                        key={key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '6px 8px',
                          borderRadius: 4,
                          background: allowed ? 'transparent' : '#fef3f2',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={allowed}
                          disabled={!canManage || togglingKey === key}
                          onChange={() => handleToggle(key, allowed)}
                        />
                        <span style={{ fontFamily: 'monospace', fontSize: 13 }}>{key}</span>
                        {!allowed && <span className="badge badge-critical">restricted</span>}
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
