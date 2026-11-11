import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { navItemsForRole } from '../config/nav';

export default function Layout() {
  const { user, logout } = useAuth();
  const items = navItemsForRole(user.role);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-title">HRMS Compliance</div>
        </div>
        <nav className="sidebar-nav">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => 'sidebar-link' + (isActive ? ' active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-email">{user.email}</div>
            <div className="sidebar-user-role">{user.role.replace(/_/g, ' ')}</div>
          </div>
          <Link to="/change-password" className="btn btn-secondary btn-block" style={{ marginBottom: 8 }}>
            Change Password
          </Link>
          <button type="button" className="btn btn-secondary btn-block" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
