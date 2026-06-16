'use client';
import { useEffect, useState } from 'react';

interface MemberStats {
  user_id: number;
  fname: string;
  lname: string;
  email: string;
  total_tasks: number;
  completed: number;
  in_progress: number;
  not_started: number;
  overdue: number;
}

export default function Statistics() {
  const [stats,   setStats]   = useState<MemberStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch('/api/admin/statistics', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setStats(d); })
      .catch(() => setError('Failed to load statistics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="view-loading"><div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, color: 'var(--color-primary)' }} /></div>;
  if (error)   return <div className="alert alert-error">{error}</div>;

  const totalTasks     = stats.reduce((s, m) => s + m.total_tasks, 0);
  const totalCompleted = stats.reduce((s, m) => s + m.completed,   0);
  const totalOverdue   = stats.reduce((s, m) => s + m.overdue,     0);

  return (
    <div>
      {/* Summary row */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value">{stats.length}</div>
          <div className="stat-label">Team Members</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalTasks}</div>
          <div className="stat-label">Total Tasks</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalCompleted}</div>
          <div className="stat-label">Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: totalOverdue > 0 ? 'var(--color-error)' : undefined }}>
            {totalOverdue}
          </div>
          <div className="stat-label">Overdue</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Per-Member Breakdown</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Member</th>
                <th>Total</th>
                <th>Completed</th>
                <th>In Progress</th>
                <th>Not Started</th>
                <th>Overdue</th>
                <th>Completion</th>
              </tr>
            </thead>
            <tbody>
              {stats.length === 0 ? (
                <tr><td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    <div className="empty-title">No members found</div>
                  </div>
                </td></tr>
              ) : stats.map(m => {
                const pct = m.total_tasks > 0 ? Math.round((m.completed / m.total_tasks) * 100) : 0;
                return (
                  <tr key={m.user_id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{m.fname} {m.lname}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{m.email}</div>
                    </td>
                    <td>{m.total_tasks}</td>
                    <td>
                      <span className="badge badge-green">{m.completed}</span>
                    </td>
                    <td>
                      {m.in_progress > 0
                        ? <span className="badge badge-blue">{m.in_progress}</span>
                        : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td>
                      {m.not_started > 0
                        ? <span className="badge badge-gray">{m.not_started}</span>
                        : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td>
                      {m.overdue > 0
                        ? <span className="badge badge-red">{m.overdue}</span>
                        : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-wrap">
                          <div className="progress-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
