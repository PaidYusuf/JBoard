'use client';
import { useEffect, useState } from 'react';

interface GanttTask {
  task_id: number;
  task_name: string;
  status: string;
  start_date: string;
  end_date: string;
  user_id: number;
  fname: string;
  lname: string;
}

const STATUS_COLOR: Record<string, string> = {
  not_started: '#94a3b8',
  in_progress: '#3b82f6',
  completed:   '#22c55e',
};

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed:   'Completed',
};

const MS_PER_DAY = 86_400_000;

function toDay(dateStr: string) {
  // pg returns DATE as a full ISO string — slice to YYYY-MM-DD first
  // Use local noon to avoid UTC midnight flipping to the previous local day
  return new Date(dateStr.slice(0, 10) + 'T12:00:00');
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

function fmtDate(d: Date) {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Gantt() {
  const [tasks,   setTasks]   = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    fetch('/api/admin/gantt', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setTasks(d); })
      .catch(() => setError('Failed to load Gantt data'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="view-loading"><div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, color: 'var(--color-primary)' }} /></div>;
  if (error)   return <div className="alert alert-error">{error}</div>;

  if (tasks.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <div className="empty-title">No tasks to display</div>
          <div>Create tasks in the Tasks tab to see them here.</div>
        </div>
      </div>
    );
  }

  // Calculate date range with 2-day padding on each side
  const allDates = tasks.flatMap(t => [toDay(t.start_date), toDay(t.end_date)]);
  const rawMin   = new Date(Math.min(...allDates.map(d => d.getTime())));
  const rawMax   = new Date(Math.max(...allDates.map(d => d.getTime())));
  const minDate  = new Date(rawMin.getTime() - 2 * MS_PER_DAY);
  const maxDate  = new Date(rawMax.getTime() + 2 * MS_PER_DAY);
  const totalDays = Math.max(daysBetween(minDate, maxDate), 1);

  const today = new Date(new Date().toDateString());
  const todayPct = (daysBetween(minDate, today) / totalDays) * 100;
  const showToday = todayPct >= 0 && todayPct <= 100;

  function leftPct(d: string) {
    return Math.max(0, (daysBetween(minDate, toDay(d)) / totalDays) * 100);
  }
  function widthPct(start: string, end: string) {
    const days = Math.max(daysBetween(toDay(start), toDay(end)), 1);
    return Math.min((days / totalDays) * 100, 100);
  }

  function barColor(task: GanttTask) {
    if (task.status !== 'completed' && toDay(task.end_date) < today) return '#ef4444'; // overdue
    return STATUS_COLOR[task.status] ?? '#94a3b8';
  }

  // Legend
  const legend = [
    { label: 'Not Started', color: '#94a3b8' },
    { label: 'In Progress', color: '#3b82f6' },
    { label: 'Completed',   color: '#22c55e' },
    { label: 'Overdue',     color: '#ef4444' },
  ];

  return (
    <div>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        {legend.map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-muted)' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: l.color, display: 'inline-block' }} />
            {l.label}
          </div>
        ))}
      </div>

      <div className="card">
        <div className="gantt-outer">
          {/* Header */}
          <div className="gantt-header">
            <div className="gantt-label-col">Task / Member</div>
            <div className="gantt-timeline-col">
              <span className="gantt-date-label">{fmtDate(minDate)}</span>
              <span className="gantt-date-label">{fmtDate(new Date((minDate.getTime() + maxDate.getTime()) / 2))}</span>
              <span className="gantt-date-label">{fmtDate(maxDate)}</span>
            </div>
          </div>

          {/* Rows */}
          {tasks.map(t => {
            const left  = leftPct(t.start_date);
            const width = widthPct(t.start_date, t.end_date);
            const color = barColor(t);
            const tip   = `${t.task_name} | ${STATUS_LABEL[t.status] ?? t.status} | ${t.start_date.slice(0,10)} → ${t.end_date.slice(0,10)}`;

            return (
              <div key={t.task_id} className="gantt-row">
                <div className="gantt-row-label">
                  <div className="gantt-row-label-name">{t.task_name}</div>
                  <div className="gantt-row-label-sub">{t.fname} {t.lname}</div>
                </div>
                <div className="gantt-row-timeline">
                  {showToday && (
                    <div className="gantt-today-line" style={{ left: `${todayPct}%` }} />
                  )}
                  <div
                    className="gantt-bar"
                    style={{ left: `${left}%`, width: `${width}%`, background: color }}
                    title={tip}
                  >
                    {width > 8 ? t.task_name : ''}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Today marker label below the chart */}
          {showToday && (
            <div style={{ position: 'relative', height: 20 }}>
              <div style={{ position: 'absolute', left: `calc(220px + ${todayPct}% * (100% - 220px) / 100)`, transform: 'translateX(-50%)', fontSize: 11, color: '#ef4444', fontWeight: 600 }}>
                Today
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
