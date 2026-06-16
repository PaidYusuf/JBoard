'use client';
import { useEffect, useState } from 'react';

interface Stats {
  total_groups: string;
  total_users: string;
  active_users: string;
  total_tasks: string;
  active_tasks: string;
  completed_tasks: string;
}

export default function Overview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/superadmin/dashboard', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setStats(d); })
      .catch(() => setError('Failed to load dashboard data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="view-loading"><div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, color: 'var(--color-primary)' }} /></div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!stats) return null;

  const cards = [
    { label: 'Company Groups', value: stats.total_groups, icon: '🏢' },
    { label: 'Total Users',    value: stats.total_users,   icon: '👥' },
    { label: 'Active Users',   value: stats.active_users,  icon: '✅' },
    { label: 'Total Tasks',    value: stats.total_tasks,   icon: '📋' },
    { label: 'In Progress',    value: stats.active_tasks,  icon: '⚡' },
    { label: 'Completed',      value: stats.completed_tasks, icon: '🏁' },
  ];

  return (
    <div>
      <div className="stats-grid">
        {cards.map(c => (
          <div key={c.label} className="stat-card">
            <div style={{ fontSize: 24, marginBottom: 8 }}>{c.icon}</div>
            <div className="stat-value">{c.value}</div>
            <div className="stat-label">{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
        Use the sidebar to manage <strong>Groups</strong>, <strong>Plans</strong>, and view <strong>Logs</strong>.
      </div>
    </div>
  );
}
