'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, AuthUser } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import Icon, { IconName } from '@/components/Icon';

export interface NavItem {
  id: string;
  icon: IconName;
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
  const { theme, toggleTheme } = useTheme();
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

  const initials = `${user.fname?.[0] ?? ''}${user.lname?.[0] ?? ''}`.toUpperCase() || 'U';
  const roleLabel = user.role === 'superadmin' ? 'Super Admin' : user.role === 'admin' ? 'Admin' : 'User';

  const mainNav = nav.filter(n => n.id !== 'back');
  const backItem = nav.find(n => n.id === 'back');

  return (
    <div className="dashboard">
      <aside className="sidebar">

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="auth-logo-mark" style={{ width: 34, height: 34, fontSize: 15, borderRadius: 9, flexShrink: 0 }}>J</div>
          <div className="sidebar-logo-text">
            JBoard
            <span style={{
              display: 'block',
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-primary)',
              marginTop: 1,
            }}>
              {roleLabel}
            </span>
          </div>
        </div>

        {/* Back button */}
        {backItem && (
          <div style={{ width: '100%', paddingTop: 8, paddingBottom: 4 }}>
            <button
              className="sidebar-item"
              onClick={() => onNavigate(backItem.id)}
            >
              <span className="sidebar-item-icon"><Icon name={backItem.icon} size={19} /></span>
              <span className="sidebar-item-label">{backItem.label}</span>
            </button>
          </div>
        )}

        {/* Nav */}
        <nav className="sidebar-nav">
          {mainNav.map(item => (
            <button
              key={item.id}
              className={`sidebar-item${activeView === item.id ? ' active' : ''}`}
              onClick={() => onNavigate(item.id)}
            >
              <span className="sidebar-item-icon"><Icon name={item.icon} size={19} /></span>
              <span className="sidebar-item-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {/* Profile */}
          <button
            className="sidebar-footer-row"
            onClick={() => router.push('/profile')}
            title={`${user.fname} ${user.lname}`}
          >
            <div className="sidebar-avatar">{initials}</div>
            <span className="sidebar-footer-row-label">
              {user.fname} {user.lname}
              <span style={{ display: 'block', fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 400 }}>
                {user.email}
              </span>
            </span>
          </button>

          {/* Theme toggle */}
          <button
            className="sidebar-footer-row"
            onClick={toggleTheme}
            aria-label="Toggle theme"
          >
            <div className="theme-toggle"><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={17} /></div>
            <span className="sidebar-footer-row-label">
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </span>
          </button>

          {/* Sign out */}
          <button
            className="sidebar-footer-row"
            onClick={logout}
            aria-label="Sign out"
          >
            <div className="sidebar-signout"><Icon name="log-out" size={17} /></div>
            <span className="sidebar-footer-row-label" style={{ color: '#f87171' }}>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="main-content">
        {children}
      </div>
    </div>
  );
}
