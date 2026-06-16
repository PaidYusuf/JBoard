'use client';
import { useEffect, useState, useCallback } from 'react';

interface LogEntry {
  log_id: number;
  log_type: string;
  action: string;
  timestamp: string;
  user_id: number | null;
  email: string | null;
  fname: string | null;
  lname: string | null;
}

const PAGE_SIZE = 50;

const TYPE_LABELS: Record<string, string> = {
  LoginLog: 'Login',
  TaskLog:  'Task',
  GroupLog: 'Group',
};

const TYPE_BADGE: Record<string, string> = {
  LoginLog: 'badge-blue',
  TaskLog:  'badge-purple',
  GroupLog: 'badge-orange',
};

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filterType, setFilterType] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo,   setFilterTo]   = useState('');

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
      if (filterType) params.set('logType', filterType);
      if (filterFrom) params.set('startDate', filterFrom);
      if (filterTo)   params.set('endDate', filterTo);
      const res = await fetch(`/api/superadmin/logs?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to load logs'); return; }
      setLogs(data.logs);
      setTotal(data.total);
    } catch { setError('Failed to load logs'); }
    finally { setLoading(false); }
  }, [filterType, filterFrom, filterTo]);

  useEffect(() => { setPage(1); load(1); }, [load]);

  function handlePageChange(next: number) {
    setPage(next);
    load(next);
  }

  function clearFilters() {
    setFilterType('');
    setFilterFrom('');
    setFilterTo('');
  }

  const hasFilters = filterType || filterFrom || filterTo;

  return (
    <div>
      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-label">Log Type</span>
          <select
            className="filter-select"
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            style={{ width: 'auto', minWidth: 140 }}
          >
            <option value="">All types</option>
            <option value="LoginLog">Login</option>
            <option value="TaskLog">Task</option>
            <option value="GroupLog">Group</option>
          </select>
        </div>

        <div className="filter-group">
          <span className="filter-label">From</span>
          <input
            type="date"
            className="filter-input"
            style={{ width: 'auto' }}
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <span className="filter-label">To</span>
          <input
            type="date"
            className="filter-input"
            style={{ width: 'auto' }}
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
          />
        </div>

        {hasFilters && (
          <button
            className="btn btn-secondary"
            style={{ alignSelf: 'flex-end', padding: '9px 14px', fontSize: 13 }}
            onClick={clearFilters}
          >
            Clear filters
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-text-muted)', alignSelf: 'center' }}>
          {total} {total === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      <div className="card">
        {loading ? (
          <div className="view-loading"><div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, color: 'var(--color-primary)' }} /></div>
        ) : error ? (
          <div className="alert alert-error" style={{ margin: 20 }}>{error}</div>
        ) : (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Type</th>
                    <th>Action</th>
                    <th>User</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className="empty-state">
                          <div className="empty-icon">📄</div>
                          <div className="empty-title">No logs found</div>
                          <div>Try adjusting the filters.</div>
                        </div>
                      </td>
                    </tr>
                  ) : logs.map(l => (
                    <tr key={l.log_id}>
                      <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap', fontSize: 13 }}>
                        {new Date(l.timestamp).toLocaleString()}
                      </td>
                      <td>
                        <span className={`badge ${TYPE_BADGE[l.log_type] ?? 'badge-gray'}`}>
                          {TYPE_LABELS[l.log_type] ?? l.log_type}
                        </span>
                      </td>
                      <td style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.action}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                        {l.email ? `${l.fname} ${l.lname} (${l.email})` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="pagination">
                <span>Page {page} of {totalPages}</span>
                <div className="pagination-controls">
                  <button className="page-btn" disabled={page === 1} onClick={() => handlePageChange(1)}>«</button>
                  <button className="page-btn" disabled={page === 1} onClick={() => handlePageChange(page - 1)}>‹</button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    const n = start + i;
                    return (
                      <button
                        key={n}
                        className={`page-btn${n === page ? ' current' : ''}`}
                        onClick={() => handlePageChange(n)}
                      >
                        {n}
                      </button>
                    );
                  })}
                  <button className="page-btn" disabled={page === totalPages} onClick={() => handlePageChange(page + 1)}>›</button>
                  <button className="page-btn" disabled={page === totalPages} onClick={() => handlePageChange(totalPages)}>»</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
