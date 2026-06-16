'use client';
import { useEffect, useState } from 'react';

interface GanttTask {
  task_id: number;
  task_name: string;
  status: string;
  start_date: string;
  end_date: string;
}

const STATUS_COLOR: Record<string, string> = {
  not_started: '#94a3b8',
  in_progress:  '#3b82f6',
  completed:    '#22c55e',
};

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress:  'In Progress',
  completed:    'Completed',
};

const PADDING = 2; // days of padding on each side

function toDay(dateStr: string) {
  return new Date(dateStr.slice(0, 10) + 'T12:00:00');
}

function diffDays(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Gantt() {
  const [tasks,   setTasks]   = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch('/api/user/gantt', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Failed to load'); return; }
        setTasks(data);
      } catch { setError('Failed to load Gantt data'); }
      finally   { setLoading(false); }
    })();
  }, []);

  if (loading) return (
    <div className="view-loading">
      <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, color: 'var(--color-primary)' }} />
    </div>
  );

  if (error) return (
    <div className="card" style={{ padding: 20 }}>
      <div className="alert alert-error">{error}</div>
    </div>
  );

  if (tasks.length === 0) return (
    <div className="card" style={{ padding: 20 }}>
      <div className="empty-state">
        <div className="empty-icon">📅</div>
        <div className="empty-title">No tasks yet</div>
        <div>Tasks assigned to you will appear on the Gantt chart.</div>
      </div>
    </div>
  );

  // Build timeline range
  const starts = tasks.map(t => toDay(t.start_date));
  const ends   = tasks.map(t => toDay(t.end_date));
  const rangeStart = new Date(Math.min(...starts.map(d => d.getTime())));
  const rangeEnd   = new Date(Math.max(...ends.map(d => d.getTime())));
  rangeStart.setDate(rangeStart.getDate() - PADDING);
  rangeEnd.setDate(rangeEnd.getDate() + PADDING);
  const totalDays = diffDays(rangeStart, rangeEnd) || 1;

  const today = new Date(new Date().toDateString());
  const todayPct = Math.max(0, Math.min(100, (diffDays(rangeStart, today) / totalDays) * 100));
  const showTodayLine = today >= rangeStart && today <= rangeEnd;

  // Build month labels
  const months: { label: string; leftPct: number }[] = [];
  const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
  while (cursor <= rangeEnd) {
    const offset = diffDays(rangeStart, cursor);
    if (offset >= 0) {
      months.push({
        label:   cursor.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        leftPct: (offset / totalDays) * 100,
      });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, padding: '14px 20px 10px', flexWrap: 'wrap', borderBottom: '1px solid var(--color-border)' }}>
        {Object.entries(STATUS_LABEL).map(([k, label]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: STATUS_COLOR[k], display: 'inline-block' }} />
            {label}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-secondary)' }}>
          <span style={{ width: 2, height: 14, background: '#ef4444', display: 'inline-block' }} />
          Today
        </span>
      </div>

      <div className="gantt-outer" style={{ overflowX: 'auto', padding: '0 20px 20px' }}>
        {/* Month header */}
        <div className="gantt-header" style={{ position: 'relative', height: 28, marginBottom: 4 }}>
          {months.map((m, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${m.leftPct}%`,
                fontSize: 11,
                color: 'var(--color-text-muted)',
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              {m.label}
            </div>
          ))}

          {/* Range info */}
          <div style={{ position: 'absolute', right: 0, top: 0, fontSize: 11, color: 'var(--color-text-muted)' }}>
            {fmtDate(rangeStart)} – {fmtDate(rangeEnd)}
          </div>
        </div>

        {/* Task rows */}
        <div style={{ position: 'relative', minWidth: 600 }}>
          {showTodayLine && (
            <div
              className="gantt-today-line"
              style={{ left: `${todayPct}%`, zIndex: 5 }}
              title={`Today: ${today.toLocaleDateString()}`}
            />
          )}

          {tasks.map(task => {
            const s    = toDay(task.start_date);
            const e    = toDay(task.end_date);
            const left = (diffDays(rangeStart, s) / totalDays) * 100;
            const w    = Math.max(1, (diffDays(s, e) + 1) / totalDays * 100);
            const overdue = task.status !== 'completed' && e < today;
            const color = overdue ? '#ef4444' : (STATUS_COLOR[task.status] ?? '#94a3b8');

            return (
              <div key={task.task_id} className="gantt-row">
                {/* Label side (fixed 220px) */}
                <div
                  style={{
                    width: 220,
                    minWidth: 220,
                    paddingRight: 12,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    fontSize: 13,
                    color: 'var(--color-text-primary)',
                    fontWeight: 500,
                  }}
                  title={task.task_name}
                >
                  {task.task_name}
                </div>

                {/* Chart side */}
                <div style={{ flex: 1, position: 'relative', height: 28 }}>
                  <div
                    className="gantt-bar"
                    style={{
                      left:             `${left}%`,
                      width:            `${w}%`,
                      background:       color,
                      minWidth:         8,
                      height:           '100%',
                      borderRadius:     4,
                    }}
                    title={`${task.task_name}: ${task.start_date.slice(0, 10)} → ${task.end_date.slice(0, 10)}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
