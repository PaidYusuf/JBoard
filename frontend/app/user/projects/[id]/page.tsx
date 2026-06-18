'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout, { NavItem } from '@/components/DashboardLayout';
import Icon from '@/components/Icon';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Project {
  project_id: number;
  project_name: string;
  start_date: string;
  end_date: string;
}

interface TaskRow {
  task_id: number;
  task_name: string;
  task_details: string | null;
  status: string;
  start_date: string;
  end_date: string;
}

interface FileRecord {
  file_id: number;
  original_name: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
}

interface TaskDetail extends TaskRow {
  task_report: string | null;
  updated_at: string;
  creator_fname: string;
  creator_lname: string;
  files: FileRecord[];
}

interface LogEntry {
  log_id: number;
  log_date: string;
  content: string;
  updated_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started', in_progress: 'In Progress', completed: 'Completed',
};
const STATUS_BADGE: Record<string, string> = {
  not_started: 'badge-gray', in_progress: 'badge-blue', completed: 'badge-green',
};
const MIME_ICON: Record<string, string> = {
  'application/pdf': '📄', 'text/csv': '📊', 'text/plain': '📃',
  'image/jpeg': '🖼️', 'image/png': '🖼️', 'image/gif': '🖼️',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
};

function fmtSize(bytes: number) {
  const b = Number(bytes);
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}
function isOverdue(t: { status: string; end_date: string }) {
  const end   = new Date(t.end_date.slice(0, 10) + 'T12:00:00');
  const today = new Date(new Date().toDateString());
  return t.status !== 'completed' && end < today;
}
function todayStr() { return new Date().toISOString().slice(0, 10); }

const NAV: NavItem[] = [
  { id: 'back',    icon: 'arrow-left',   label: 'Back'      },
  { id: 'tasks',   icon: 'check-square', label: 'My Tasks'  },
  { id: 'log',     icon: 'note',         label: 'Daily Log' },
];

type Tab = 'tasks' | 'log';

// ── Page ──────────────────────────────────────────────────────────────────────
export default function UserProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [project,  setProject]  = useState<Project | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<Tab>('tasks');

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const [tasks,        setTasks]        = useState<TaskRow[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [fStatus,      setFStatus]      = useState('');

  // Detail panel
  const [panel,        setPanel]        = useState<TaskDetail | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);

  // Status update
  const [statusSaving, setStatusSaving] = useState(false);

  // Report
  const [reportText,   setReportText]   = useState('');
  const [reportSaving, setReportSaving] = useState(false);
  const [reportSaved,  setReportSaved]  = useState(false);

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading,   setUploading]   = useState(false);
  const [uploadError, setUploadError] = useState('');

  // ── Daily log ─────────────────────────────────────────────────────────────
  const [logs,        setLogs]        = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [todayLog,    setTodayLog]    = useState('');
  const [todayDraft,  setTodayDraft]  = useState('');
  const [logSaving,   setLogSaving]   = useState(false);
  const [logSaved,    setLogSaved]    = useState(false);
  const [logError,    setLogError]    = useState('');

  // ── Load project ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch('/api/user/projects', { credentials: 'include' });
        const data = await res.json();
        if (res.ok) {
          const found = data.find((p: Project) => String(p.project_id) === id);
          setProject(found ?? null);
        }
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [id]);

  // ── Load tasks ────────────────────────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    const params = new URLSearchParams();
    if (fStatus) params.set('status', fStatus);
    try {
      const res  = await fetch(`/api/user/projects/${id}/tasks?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setTasks(data);
    } catch { /* ignore */ }
    finally { setTasksLoading(false); }
  }, [id, fStatus]);

  useEffect(() => { if (tab === 'tasks' && project) loadTasks(); }, [tab, project, loadTasks]);

  // ── Load logs ─────────────────────────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    if (!project) return;
    setLogsLoading(true);
    try {
      const res  = await fetch(`/api/user/projects/${id}/logs`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setLogs(data);
        const t        = todayStr();
        const existing = data.find((l: LogEntry) => l.log_date.slice(0, 10) === t);
        setTodayLog(existing?.content ?? '');
        setTodayDraft(existing?.content ?? '');
      }
    } catch { /* ignore */ }
    finally { setLogsLoading(false); }
  }, [id, project]);

  useEffect(() => { if (tab === 'log' && project) loadLogs(); }, [tab, project, loadLogs]);

  // ── Task panel ────────────────────────────────────────────────────────────
  async function openPanel(taskId: number) {
    setPanelLoading(true);
    setPanel(null);
    try {
      const res  = await fetch(`/api/user/tasks/${taskId}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setPanel(data);
        setReportText(data.task_report ?? '');
        setReportDraft(data.task_report ?? '');
        setReportSaved(false);
        setUploadError('');
      }
    } catch { /* ignore */ }
    finally { setPanelLoading(false); }
  }

  function closePanel() { setPanel(null); loadTasks(); }

  async function handleStatusUpdate(status: string) {
    if (!panel || statusSaving) return;
    setStatusSaving(true);
    try {
      const res = await fetch(`/api/user/tasks/${panel.task_id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setPanel(p => p ? { ...p, status } : p);
        setTasks(prev => prev.map(t => t.task_id === panel.task_id ? { ...t, status } : t));
      }
    } catch { /* ignore */ }
    finally { setStatusSaving(false); }
  }

  // separate draft state for report so we can detect unsaved changes
  const [reportDraft, setReportDraft] = useState('');

  async function handleSaveReport() {
    if (!panel || reportSaving) return;
    setReportSaving(true);
    setReportSaved(false);
    try {
      const res = await fetch(`/api/user/tasks/${panel.task_id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reportText: reportDraft }),
      });
      if (res.ok) {
        setReportText(reportDraft);
        setPanel(p => p ? { ...p, task_report: reportDraft } : p);
        setReportSaved(true);
        setTimeout(() => setReportSaved(false), 2500);
      }
    } catch { /* ignore */ }
    finally { setReportSaving(false); }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !panel) return;
    setUploadError('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res  = await fetch(`/api/user/tasks/${panel.task_id}/upload`, {
        method: 'POST', credentials: 'include', body: form,
      });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error || 'Upload failed'); return; }
      await refreshFiles();
    } catch { setUploadError('Upload failed'); }
    finally { setUploading(false); e.target.value = ''; }
  }

  async function refreshFiles() {
    if (!panel) return;
    const res  = await fetch(`/api/user/tasks/${panel.task_id}/files`, { credentials: 'include' });
    const data = await res.json();
    if (res.ok) setPanel(p => p ? { ...p, files: data } : p);
  }

  async function handleDeleteFile(fileId: number) {
    if (!panel || !confirm('Delete this file?')) return;
    await fetch(`/api/user/tasks/${panel.task_id}/files/${fileId}`, { method: 'DELETE', credentials: 'include' });
    await refreshFiles();
  }

  // ── Daily log save ────────────────────────────────────────────────────────
  async function handleSaveLog() {
    if (!project || logSaving || !todayDraft.trim()) return;
    setLogSaving(true);
    setLogSaved(false);
    setLogError('');
    try {
      const res  = await fetch(`/api/user/projects/${id}/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: todayDraft }),
      });
      const data = await res.json();
      if (!res.ok) { setLogError(data.error || 'Failed to save'); return; }
      setTodayLog(data.content);
      setLogSaved(true);
      setTimeout(() => setLogSaved(false), 2500);
      await loadLogs();
    } catch { setLogError('Network error'); }
    finally { setLogSaving(false); }
  }

  function handleNav(navId: string) {
    if (navId === 'back') { router.push('/user'); return; }
    setTab(navId as Tab);
    setPanel(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <DashboardLayout nav={NAV} activeView={tab} onNavigate={handleNav} allowedRoles={['user', 'admin', 'superadmin']}>
      <div className="view-loading">
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, color: 'var(--color-primary)' }} />
      </div>
    </DashboardLayout>
  );

  if (!project) return (
    <DashboardLayout nav={NAV} activeView={tab} onNavigate={handleNav} allowedRoles={['user', 'admin', 'superadmin']}>
      <div className="card" style={{ padding: 20 }}>
        <div className="alert alert-error">Project not found or you are not a member.</div>
      </div>
    </DashboardLayout>
  );

  const t          = todayStr();
  const canLog     = project && t >= project.start_date.slice(0, 10) && t <= project.end_date.slice(0, 10);
  const pastLogs   = logs.filter(l => l.log_date.slice(0, 10) !== t);

  return (
    <DashboardLayout nav={NAV} activeView={tab} onNavigate={handleNav} allowedRoles={['user', 'admin', 'superadmin']}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{project.project_name}</h1>
          <p className="page-subtitle">
            {project.start_date.slice(0, 10)} → {project.end_date.slice(0, 10)}
          </p>
        </div>
      </div>

      <div className="page-body">

        {/* ── TASKS tab ──────────────────────────────────────────────────── */}
        {tab === 'tasks' && (
          <>
            <div className="filter-bar" style={{ marginBottom: 16 }}>
              <div className="filter-group">
                <span className="filter-label">Status</span>
                <select className="filter-select" value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ width: 'auto', minWidth: 140 }}>
                  <option value="">All statuses</option>
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              {fStatus && (
                <button className="btn btn-secondary" style={{ alignSelf: 'flex-end', padding: '9px 14px', fontSize: 13 }} onClick={() => setFStatus('')}>Clear</button>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-text-muted)', alignSelf: 'center' }}>
                {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
              </span>
            </div>

            <div className="card">
              {tasksLoading ? (
                <div className="view-loading">
                  <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, color: 'var(--color-primary)' }} />
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr><th>Task</th><th>Status</th><th>Due Date</th><th></th></tr>
                    </thead>
                    <tbody>
                      {tasks.length === 0 ? (
                        <tr><td colSpan={4}>
                          <div className="empty-state">
                            <div className="empty-icon"><Icon name="check-square" size={26} /></div>
                            <div className="empty-title">No tasks assigned to you</div>
                            <div>Your admin hasn't assigned any tasks in this project yet.</div>
                          </div>
                        </td></tr>
                      ) : tasks.map(task => (
                        <tr key={task.task_id}
                          style={{ cursor: 'pointer', background: panel?.task_id === task.task_id ? 'var(--color-bg-subtle)' : undefined }}
                          onClick={() => openPanel(task.task_id)}>
                          <td style={{ fontWeight: 500 }}>
                            {task.task_name}
                            {isOverdue(task) && <span className="badge badge-red" style={{ marginLeft: 8, fontSize: 11 }}>Overdue</span>}
                          </td>
                          <td><span className={`badge ${STATUS_BADGE[task.status] ?? 'badge-gray'}`}>{STATUS_LABELS[task.status] ?? task.status}</span></td>
                          <td style={{ fontSize: 13, color: isOverdue(task) ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
                            {task.end_date.slice(0, 10)}
                          </td>
                          <td>
                            <button className="action-btn action-btn-edit" onClick={e => { e.stopPropagation(); openPanel(task.task_id); }}>
                              Open →
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Detail panel */}
            {panelLoading && !panel && (
              <div className="panel-overlay">
                <div style={{ position: 'fixed', top: '50%', right: 250, transform: 'translateY(-50%)' }}>
                  <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, color: '#fff' }} />
                </div>
              </div>
            )}

            {panel && (
              <>
                <div className="panel-overlay" onClick={closePanel} />
                <div className="detail-panel">
                  <div className="detail-panel-header">
                    <div>
                      <div className="detail-panel-title">{panel.task_name}</div>
                      <div style={{ marginTop: 6 }}>
                        <span className={`badge ${STATUS_BADGE[panel.status] ?? 'badge-gray'}`}>{STATUS_LABELS[panel.status] ?? panel.status}</span>
                        {isOverdue(panel) && <span className="badge badge-red" style={{ marginLeft: 6 }}>Overdue</span>}
                      </div>
                    </div>
                    <button className="modal-close" onClick={closePanel} aria-label="Close">✕</button>
                  </div>

                  <div className="detail-panel-body">
                    {/* Info */}
                    <div className="detail-section">
                      <div className="detail-section-title">Details</div>
                      <div className="detail-meta-grid">
                        <div>
                          <div className="detail-meta-label">Start Date</div>
                          <div className="detail-meta-value">{panel.start_date.slice(0, 10)}</div>
                        </div>
                        <div>
                          <div className="detail-meta-label">Due Date</div>
                          <div className="detail-meta-value" style={{ color: isOverdue(panel) ? 'var(--color-error)' : undefined }}>
                            {panel.end_date.slice(0, 10)}
                          </div>
                        </div>
                        <div>
                          <div className="detail-meta-label">Assigned By</div>
                          <div className="detail-meta-value">{panel.creator_fname} {panel.creator_lname}</div>
                        </div>
                        <div>
                          <div className="detail-meta-label">Last Updated</div>
                          <div className="detail-meta-value" style={{ fontSize: 13 }}>{new Date(panel.updated_at).toLocaleDateString()}</div>
                        </div>
                      </div>
                      {panel.task_details && (
                        <div style={{ marginTop: 14 }}>
                          <div className="detail-meta-label" style={{ marginBottom: 6 }}>Description</div>
                          <div className="detail-text">{panel.task_details}</div>
                        </div>
                      )}
                    </div>

                    {/* Status */}
                    <div className="detail-section">
                      <div className="detail-section-title">Update Status</div>
                      <div className="status-group">
                        {(['not_started', 'in_progress', 'completed'] as const).map(s => (
                          <button key={s}
                            className={`status-opt${panel.status === s ? ` s-active-${s}` : ''}`}
                            onClick={() => handleStatusUpdate(s)}
                            disabled={statusSaving || panel.status === s}>
                            {STATUS_LABELS[s]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Report */}
                    <div className="detail-section">
                      <div className="detail-section-title">Work Report</div>
                      <textarea
                        value={reportDraft}
                        onChange={e => { setReportDraft(e.target.value); setReportSaved(false); }}
                        placeholder="Describe your progress, what you completed, blockers…"
                        style={{ minHeight: 120, marginBottom: 10 }}
                        disabled={reportSaving}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button className="btn btn-primary btn-sm" onClick={handleSaveReport}
                          disabled={reportSaving || reportDraft === reportText}>
                          {reportSaving ? <><span className="spinner" /> Saving…</> : 'Save Report'}
                        </button>
                        {reportSaved && <span style={{ fontSize: 13, color: 'var(--color-success)' }}>✓ Saved</span>}
                      </div>
                    </div>

                    {/* Files */}
                    <div className="detail-section">
                      <div className="detail-section-title">Attachments ({panel.files.length})</div>
                      {uploadError && <div className="alert alert-error" style={{ marginBottom: 10 }}>{uploadError}</div>}
                      {panel.files.map(f => (
                        <div key={f.file_id} className="file-item">
                          <span className="file-icon">{MIME_ICON[f.mime_type] ?? '📎'}</span>
                          <div className="file-info">
                            <div className="file-name">{f.original_name}</div>
                            <div className="file-meta">{fmtSize(f.file_size)} · {f.mime_type.split('/')[1]?.toUpperCase()} · {new Date(f.uploaded_at).toLocaleDateString()}</div>
                          </div>
                          <button className="action-btn action-btn-danger" style={{ flexShrink: 0 }} onClick={() => handleDeleteFile(f.file_id)}>Delete</button>
                        </div>
                      ))}
                      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange}
                        accept=".pdf,.csv,.txt,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx" />
                      <div className="upload-area" onClick={() => !uploading && fileInputRef.current?.click()}>
                        {uploading ? <><span className="spinner" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} /> Uploading…</> : '+ Click to attach a file (PDF, image, Word, Excel, CSV — max 20 MB)'}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── DAILY LOG tab ──────────────────────────────────────────────── */}
        {tab === 'log' && (
          <>
            {/* Today's log */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span className="card-title">Today's Log — {t}</span>
              </div>
              <div style={{ padding: '0 20px 20px' }}>
                {!canLog ? (
                  <div className="alert alert-error">
                    Today is outside this project's date range ({project.start_date.slice(0, 10)} – {project.end_date.slice(0, 10)}).
                  </div>
                ) : (
                  <>
                    {logError && <div className="alert alert-error" style={{ marginBottom: 10 }}>{logError}</div>}
                    <textarea
                      value={todayDraft}
                      onChange={e => { setTodayDraft(e.target.value); setLogSaved(false); }}
                      placeholder="What did you work on today? Describe your progress, what you completed, and any blockers…"
                      style={{ minHeight: 140, marginBottom: 10 }}
                      disabled={logSaving}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button className="btn btn-primary btn-sm" onClick={handleSaveLog}
                        disabled={logSaving || !todayDraft.trim() || todayDraft === todayLog}>
                        {logSaving ? <><span className="spinner" /> Saving…</> : todayLog ? 'Update Log' : 'Save Log'}
                      </button>
                      {logSaved && <span style={{ fontSize: 13, color: 'var(--color-success)' }}>✓ Saved</span>}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Past entries */}
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
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No past entries yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {pastLogs.map(l => (
                      <div key={l.log_id} style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: 12 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{l.log_date.slice(0, 10)}</div>
                        <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{l.content}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
