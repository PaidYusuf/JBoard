'use client';
import { useEffect, useState } from 'react';
import Icon, { IconName } from '@/components/Icon';

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

  const cards: { label: string; value: string; icon: IconName; tint: string }[] = [
    { label: 'Company Groups', value: stats.total_groups,    icon: 'building',     tint: 'is-purple' },
    { label: 'Total Users',    value: stats.total_users,     icon: 'users',        tint: 'is-blue'   },
    { label: 'Active Users',   value: stats.active_users,    icon: 'user-check',   tint: 'is-green'  },
    { label: 'Total Tasks',    value: stats.total_tasks,     icon: 'check-square', tint: 'is-purple' },
    { label: 'In Progress',    value: stats.active_tasks,    icon: 'activity',     tint: 'is-amber'  },
    { label: 'Completed',      value: stats.completed_tasks, icon: 'flag',         tint: 'is-green'  },
  ];

  return (
    <div>
      <div className="stats-grid">
        {cards.map(c => (
          <div key={c.label} className="stat-card">
            <div className={`stat-icon ${c.tint}`}><Icon name={c.icon} size={21} /></div>
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
