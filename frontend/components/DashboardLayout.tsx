'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, AuthUser } from '@/context/AuthContext';

export interface NavItem {
  id: string;
  icon: string;
  label: string;
}

interface Props {
  children: React.ReactNode;
  nav: NavItem[];
  activeView: string;
  onNavigate: (id: string) => void;
  allowedRoles: AuthUser['role'][];
}

export default function DashboardLayout({ children, nav, activeView, onNavigate, allowedRoles }: Props) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace('/login'); return; }
    if (!allowedRoles.includes(user.role)) {
      if (user.role === 'superadmin') router.replace('/superadmin');
      else if (user.role === 'admin') router.replace('/admin');
      else router.replace('/user');
    }
  }, [user, loading, router, allowedRoles]);

  if (loading || !user || !allowedRoles.includes(user.role)) {
    return (
      <div className="page-loading">
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, color: 'var(--color-primary)' }} />
      </div>
    );
  }

  const roleLabel = user.role === 'superadmin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'User';

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="auth-logo" style={{ margin: 0 }}>
            <div className="auth-logo-mark">J</div>
            <span className="auth-logo-text" style={{ color: '#fff' }}>JBoard</span>
          </div>
          <div className="sidebar-role-badge">{roleLabel}</div>
        </div>

        <nav className="sidebar-nav">
          {nav.map(item => (
            <button
              key={item.id}
              className={`sidebar-item${activeView === item.id ? ' active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span style={{ fontSize: 16 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">{user.fname} {user.lname}</div>
          <div className="sidebar-user-email">{user.email}</div>
          <button className="sidebar-signout" onClick={logout}>
            ↩ Sign out
          </button>
        </div>
      </aside>

      <div className="main-content">
        {children}
      </div>
    </div>
  );
}
