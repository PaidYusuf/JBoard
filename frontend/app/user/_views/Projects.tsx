'use client';
import { useEffect, useState, useCallback } from 'react';

interface Project {
  project_id: number;
  project_name: string;
  start_date: string;
  end_date: string;
}

interface LogEntry {
  log_id: number;
  log_date: string;
  content: string;
  updated_at: string;
}

function today() { return new Date().toISOString().slice(0, 10); }

function isActive(p: Project) {
  const t = today();
  return t >= p.start_date.slice(0, 10) && t <= p.end_date.slice(0, 10);
}

export default function Projects() {
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  const [selected,     setSelected]     = useState<Project | null>(null);
  const [logs,         setLogs]         = useState<LogEntry[]>([]);
  const [logsLoading,  setLogsLoading]  = useState(false);

  // today's log entry
  const [todayLog,   setTodayLog]   = useState('');
  const [todayDraft, setTodayDraft] = useState('');
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [saveError,  setSaveError]  = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch('/api/user/projects', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Failed to load projects'); return; }
        setProjects(data);
      } catch { setError('Failed to load projects'); }
      finally { setLoading(false); }
    })();
  }, []);

  const loadLogs = useCallback(async (projectId: number) => {
    setLogsLoading(true);
    try {
      const res  = await fetch(`/api/user/projects/${projectId}/logs`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) return;
      setLogs(data);
      // Pre-fill today's draft if a log already exists for today
      const t = today();
      const existing = data.find((l: LogEntry) => l.log_date.slice(0, 10) === t);
      setTodayLog(existing?.content ?? '');
      setTodayDraft(existing?.content ?? '');
    } catch { /* ignore */ }
    finally { setLogsLoading(false); }
  }, []);

  async function openProject(p: Project) {
    setSelected(p);
    setSaved(false);
    setSaveError('');
    await loadLogs(p.project_id);
  }

  async function handleSave() {
    if (!selected || saving || !todayDraft.trim()) return;
    setSaving(true);
    setSaved(false);
    setSaveError('');
    try {
      const res  = await fetch(`/api/user/projects/${selected.project_id}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: todayDraft }),
      });
      const data = await res.json();
      if (!res.ok) { setSaveError(data.error || 'Failed to save'); return; }
      setTodayLog(data.content);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await loadLogs(selected.project_id);
    } catch { setSaveError('Network error'); }
    finally { setSaving(false); }
  }

  const t = today();
  const canLogToday = selected ? (t >= selected.start_date.slice(0, 10) && t <= selected.end_date.slice(0, 10)) : false;
  const pastLogs = logs.filter(l => l.log_date.slice(0, 10) !== t);

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

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

      {/* Project list */}
      <div style={{ flex: selected ? '0 0 300px' : '1' }}>
        {projects.length === 0 ? (
          <div className="card" style={{ padding: 20 }}>
            <div className="empty-state">
              <div className="empty-icon">📁</div>
              <div className="empty-title">No projects yet</div>
              <div>Ask your admin to create a project and add you as a member.</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {projects.map(p => {
              const active = isActive(p);
              return (
                <div
                  key={p.project_id}
                  className="card"
                  style={{
                    padding: '16px 20px',
                    cursor: 'pointer',
                    border: selected?.project_id === p.project_id ? '2px solid var(--color-primary)' : undefined,
                  }}
                  onClick={() => openProject(p)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{p.project_name}</div>
                    <span className={`badge ${active ? 'badge-green' : 'badge-gray'}`}>
                      {active ? 'Active' : (t > p.end_date.slice(0, 10) ? 'Ended' : 'Upcoming')}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>
                    {p.start_date.slice(0, 10)} → {p.end_date.slice(0, 10)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log panel */}
      {selected && (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Header */}
          <div className="card" style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17 }}>{selected.project_name}</div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {selected.start_date.slice(0, 10)} → {selected.end_date.slice(0, 10)}
              </div>
            </div>
            <button className="modal-close" onClick={() => setSelected(null)} aria-label="Close">✕</button>
          </div>

          {/* Today's log */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Today's Log — {t}</span>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              {!canLogToday ? (
                <div className="alert alert-error">
                  Today is outside this project's date range. You can only log within {selected.start_date.slice(0, 10)} – {selected.end_date.slice(0, 10)}.
                </div>
              ) : (
                <>
                  {saveError && <div className="alert alert-error" style={{ marginBottom: 10 }}>{saveError}</div>}
                  <textarea
                    value={todayDraft}
                    onChange={e => { setTodayDraft(e.target.value); setSaved(false); }}
                    placeholder="What did you work on today? Describe your progress, what you completed, and any blockers…"
                    style={{ minHeight: 140, marginBottom: 10 }}
                    disabled={saving}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleSave}
                      disabled={saving || !todayDraft.trim() || todayDraft === todayLog}
                    >
                      {saving ? <><span className="spinner" /> Saving…</> : todayLog ? 'Update Log' : 'Save Log'}
                    </button>
                    {saved && (
                      <span style={{ fontSize: 13, color: 'var(--color-success)' }}>✓ Saved</span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Past logs */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Past Entries ({pastLogs.length})</span>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              {logsLoading ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <div className="spinner" style={{ width: 24, height: 24, borderWidth: 3, color: 'var(--color-primary)', display: 'inline-block' }} />
                </div>
              ) : pastLogs.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  No past entries yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {pastLogs.map(l => (
                    <div key={l.log_id} style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: 12 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                        {l.log_date.slice(0, 10)}
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>
                        {l.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
