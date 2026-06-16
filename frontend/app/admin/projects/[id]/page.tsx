'use client';
import { useEffect, useState, useCallback, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import Modal from '@/components/Modal';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Project {
  project_id: number;
  project_name: string;
  start_date: string;
  end_date: string;
}

interface Member { user_id: number; fname: string; lname: string; email: string; }

interface Task {
  task_id: number;
  task_name: string;
  task_details: string | null;
  status: string;
  start_date: string;
  end_date: string;
  fname: string;
  lname: string;
  creator_fname: string;
  creator_lname: string;
}

interface FileRecord {
  file_id: number;
  original_name: string;
  mime_type: string;
  file_size: number;
  uploaded_at: string;
}

interface TaskDetail extends Task {
  task_report: string | null;
  updated_at: string;
  files: FileRecord[];
}

interface LogEntry {
  log_id: number;
  log_date: string;
  content: string;
  updated_at: string;
  user_id: number;
  fname: string;
  lname: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress:  'In Progress',
  completed:    'Completed',
};
const STATUS_BADGE: Record<string, string> = {
  not_started: 'badge-gray',
  in_progress:  'badge-blue',
  completed:    'badge-green',
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

const TASK_EMPTY = { assignedUserId: '', taskName: '', taskDetails: '', startDate: '', endDate: '' };

// ── Nav (same as admin dashboard) ─────────────────────────────────────────────
const NAV = [
  { id: 'back',       icon: '←',  label: 'Back'       },
  { id: 'tasks',      icon: '📋', label: 'Tasks'      },
  { id: 'members',    icon: '👥', label: 'Members'    },
  { id: 'logs',       icon: '📝', label: 'Daily Logs' },
];

type Tab = 'tasks' | 'members' | 'logs';

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [project,  setProject]  = useState<Project | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<Tab>('tasks');

  // ── Members ──────────────────────────────────────────────────────────────────
  const [projMembers,   setProjMembers]   = useState<Member[]>([]);
  const [groupMembers,  setGroupMembers]  = useState<Member[]>([]);
  const [addingUser,    setAddingUser]    = useState('');
  const [memberError,   setMemberError]   = useState('');

  // ── Tasks ─────────────────────────────────────────────────────────────────────
  const [tasks,        setTasks]        = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [fStatus,      setFStatus]      = useState('');

  // Task create modal
  const [showCreate,  setShowCreate]  = useState(false);
  const [cForm,       setCForm]       = useState(TASK_EMPTY);
  const [creating,    setCreating]    = useState(false);
  const [createError, setCreateError] = useState('');

  // Task edit modal
  const [editTask,  setEditTask]  = useState<Task | null>(null);
  const [eForm,     setEForm]     = useState({ taskName: '', taskDetails: '', startDate: '', endDate: '' });
  const [saving,    setSaving]    = useState(false);
  const [editError, setEditError] = useState('');

  // Task detail panel
  const [panel,        setPanel]        = useState<TaskDetail | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);

  // ── Logs ──────────────────────────────────────────────────────────────────────
  const [logTab,      setLogTab]      = useState<'date' | 'member'>('date');
  const [logDate,     setLogDate]     = useState(todayStr());
  const [logUser,     setLogUser]     = useState('');
  const [logs,        setLogs]        = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // ── Load project + members ───────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [projRes, membersRes, groupRes] = await Promise.all([
          fetch(`/api/admin/projects`, { credentials: 'include' }),
          fetch(`/api/admin/projects/${id}/members`, { credentials: 'include' }),
          fetch(`/api/admin/members`, { credentials: 'include' }),
        ]);
        const projects = await projRes.json();
        const found    = projects.find((p: Project) => String(p.project_id) === id);
        setProject(found ?? null);
        if (membersRes.ok) setProjMembers(await membersRes.json());
        if (groupRes.ok)   setGroupMembers(await groupRes.json());
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [id]);

  // ── Load tasks ────────────────────────────────────────────────────────────────
  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    const params = new URLSearchParams();
    if (fStatus) params.set('status', fStatus);
    try {
      const res  = await fetch(`/api/admin/projects/${id}/tasks?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setTasks(data);
    } catch { /* ignore */ }
    finally { setTasksLoading(false); }
  }, [id, fStatus]);

  useEffect(() => { if (tab === 'tasks') loadTasks(); }, [tab, loadTasks]);

  // ── Load logs ─────────────────────────────────────────────────────────────────
  const loadLogs = useCallback(async () => {
    if (!project) return;
    setLogsLoading(true);
    const params = new URLSearchParams();
    if (logTab === 'date'   && logDate) params.set('date',   logDate);
    if (logTab === 'member' && logUser) params.set('userId', logUser);
    try {
      const res  = await fetch(`/api/admin/projects/${id}/logs?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setLogs(data);
    } catch { /* ignore */ }
    finally { setLogsLoading(false); }
  }, [id, project, logTab, logDate, logUser]);

  useEffect(() => { if (tab === 'logs') loadLogs(); }, [tab, logTab, logDate, logUser, loadLogs]);

  // ── Task handlers ─────────────────────────────────────────────────────────────
  async function openPanel(taskId: number) {
    setPanelLoading(true);
    setPanel(null);
    const res  = await fetch(`/api/admin/tasks/${taskId}`, { credentials: 'include' });
    const data = await res.json();
    if (res.ok) setPanel(data);
    setPanelLoading(false);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const res  = await fetch(`/api/admin/projects/${id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          assignedUserId: Number(cForm.assignedUserId),
          taskName:       cForm.taskName,
          taskDetails:    cForm.taskDetails || undefined,
          startDate:      cForm.startDate,
          endDate:        cForm.endDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || 'Failed to create task'); return; }
      setShowCreate(false);
      setCForm(TASK_EMPTY);
      loadTasks();
    } catch { setCreateError('Network error'); }
    finally { setCreating(false); }
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editTask) return;
    setEditError('');
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (eForm.taskName    !== editTask.task_name)                  body.taskName    = eForm.taskName;
      if (eForm.taskDetails !== (editTask.task_details ?? ''))       body.taskDetails = eForm.taskDetails || null;
      if (eForm.startDate   !== editTask.start_date.slice(0, 10))   body.startDate   = eForm.startDate;
      if (eForm.endDate     !== editTask.end_date.slice(0, 10))     body.endDate     = eForm.endDate;
      if (!Object.keys(body).length) { setEditTask(null); return; }
      const res  = await fetch(`/api/admin/tasks/${editTask.task_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || 'Failed to update'); return; }
      setEditTask(null);
      if (panel?.task_id === editTask.task_id) setPanel(null);
      loadTasks();
    } catch { setEditError('Network error'); }
    finally { setSaving(false); }
  }

  async function handleDelete(t: Task) {
    if (!confirm(`Delete "${t.task_name}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/tasks/${t.task_id}`, { method: 'DELETE', credentials: 'include' });
    if (panel?.task_id === t.task_id) setPanel(null);
    loadTasks();
  }

  function openEdit(t: Task) {
    setEForm({ taskName: t.task_name, taskDetails: t.task_details ?? '', startDate: t.start_date.slice(0, 10), endDate: t.end_date.slice(0, 10) });
    setEditError('');
    setEditTask(t);
  }

  // ── Member handlers ───────────────────────────────────────────────────────────
  async function handleAddMember() {
    if (!addingUser) return;
    setMemberError('');
    const res  = await fetch(`/api/admin/projects/${id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId: Number(addingUser) }),
    });
    const data = await res.json();
    if (!res.ok) { setMemberError(data.error || 'Failed to add'); return; }
    setAddingUser('');
    const r = await fetch(`/api/admin/projects/${id}/members`, { credentials: 'include' });
    if (r.ok) setProjMembers(await r.json());
  }

  async function handleRemoveMember(userId: number) {
    await fetch(`/api/admin/projects/${id}/members/${userId}`, { method: 'DELETE', credentials: 'include' });
    setProjMembers(prev => prev.filter(m => m.user_id !== userId));
  }

  // ── Navigation handler ────────────────────────────────────────────────────────
  function handleNav(navId: string) {
    if (navId === 'back') { router.push('/admin'); return; }
    setTab(navId as Tab);
    setPanel(null);
  }

  const nonMembers = groupMembers.filter(m => !projMembers.find(pm => pm.user_id === m.user_id));

  if (loading) return (
    <DashboardLayout nav={NAV} activeView={tab} onNavigate={handleNav} allowedRoles={['admin', 'superadmin']}>
      <div className="view-loading">
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, color: 'var(--color-primary)' }} />
      </div>
    </DashboardLayout>
  );

  if (!project) return (
    <DashboardLayout nav={NAV} activeView={tab} onNavigate={handleNav} allowedRoles={['admin', 'superadmin']}>
      <div className="card" style={{ padding: 20 }}>
        <div className="alert alert-error">Project not found.</div>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout nav={NAV} activeView={tab} onNavigate={handleNav} allowedRoles={['admin', 'superadmin']}>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{project.project_name}</h1>
          <p className="page-subtitle">
            {project.start_date.slice(0, 10)} → {project.end_date.slice(0, 10)} · {projMembers.length} member{projMembers.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="page-body">

        {/* ── TASKS tab ──────────────────────────────────────────────────────── */}
        {tab === 'tasks' && (
          <>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="filter-group">
                <span className="filter-label">Status</span>
                <select className="filter-select" value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ width: 'auto', minWidth: 130 }}>
                  <option value="">All statuses</option>
                  <option value="not_started">Not Started</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
              <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}
                onClick={() => { setCreateError(''); setCForm(TASK_EMPTY); setShowCreate(true); }}>
                + New Task
              </button>
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
                      <tr>
                        <th>Task</th>
                        <th>Assigned To</th>
                        <th>Status</th>
                        <th>Start</th>
                        <th>Due</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.length === 0 ? (
                        <tr><td colSpan={6}>
                          <div className="empty-state">
                            <div className="empty-icon">📋</div>
                            <div className="empty-title">No tasks yet</div>
                            <div>Create the first task for this project.</div>
                          </div>
                        </td></tr>
                      ) : tasks.map(t => (
                        <tr key={t.task_id} style={{ cursor: 'pointer', background: panel?.task_id === t.task_id ? 'var(--color-bg-subtle)' : undefined }}
                          onClick={() => openPanel(t.task_id)}>
                          <td style={{ fontWeight: 500, maxWidth: 220 }}>
                            {t.task_name}
                            {isOverdue(t) && <span className="badge badge-red" style={{ marginLeft: 8, fontSize: 11 }}>Overdue</span>}
                          </td>
                          <td style={{ fontSize: 13 }}>{t.fname} {t.lname}</td>
                          <td><span className={`badge ${STATUS_BADGE[t.status] ?? 'badge-gray'}`}>{STATUS_LABELS[t.status] ?? t.status}</span></td>
                          <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{t.start_date.slice(0, 10)}</td>
                          <td style={{ fontSize: 13, color: isOverdue(t) ? 'var(--color-error)' : 'var(--color-text-muted)' }}>{t.end_date.slice(0, 10)}</td>
                          <td onClick={e => e.stopPropagation()}>
                            <div className="actions-cell">
                              <button className="action-btn action-btn-edit" onClick={() => openEdit(t)}>Edit</button>
                              <button className="action-btn action-btn-danger" onClick={() => handleDelete(t)}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Task detail panel */}
            {panelLoading && !panel && (
              <div className="panel-overlay">
                <div style={{ position: 'fixed', top: '50%', right: 250, transform: 'translateY(-50%)' }}>
                  <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, color: '#fff' }} />
                </div>
              </div>
            )}
            {panel && (
              <>
                <div className="panel-overlay" onClick={() => setPanel(null)} />
                <div className="detail-panel">
                  <div className="detail-panel-header">
                    <div>
                      <div className="detail-panel-title">{panel.task_name}</div>
                      <div style={{ marginTop: 6, fontSize: 13, color: 'var(--color-text-muted)' }}>
                        Assigned to <strong>{panel.fname} {panel.lname}</strong>
                      </div>
                    </div>
                    <button className="modal-close" onClick={() => setPanel(null)}>✕</button>
                  </div>
                  <div className="detail-panel-body">
                    <div className="detail-section">
                      <div className="detail-section-title">Task Info</div>
                      <div className="detail-meta-grid">
                        <div>
                          <div className="detail-meta-label">Status</div>
                          <div className="detail-meta-value">
                            <span className={`badge ${STATUS_BADGE[panel.status] ?? 'badge-gray'}`}>{STATUS_LABELS[panel.status] ?? panel.status}</span>
                            {isOverdue(panel) && <span className="badge badge-red" style={{ marginLeft: 6 }}>Overdue</span>}
                          </div>
                        </div>
                        <div>
                          <div className="detail-meta-label">Last Updated</div>
                          <div className="detail-meta-value" style={{ fontSize: 13 }}>{new Date(panel.updated_at).toLocaleDateString()}</div>
                        </div>
                        <div>
                          <div className="detail-meta-label">Start Date</div>
                          <div className="detail-meta-value">{panel.start_date.slice(0, 10)}</div>
                        </div>
                        <div>
                          <div className="detail-meta-label">Due Date</div>
                          <div className="detail-meta-value" style={{ color: isOverdue(panel) ? 'var(--color-error)' : undefined }}>{panel.end_date.slice(0, 10)}</div>
                        </div>
                      </div>
                      {panel.task_details && (
                        <div style={{ marginTop: 14 }}>
                          <div className="detail-meta-label" style={{ marginBottom: 6 }}>Description</div>
                          <div className="detail-text">{panel.task_details}</div>
                        </div>
                      )}
                    </div>

                    <div className="detail-section">
                      <div className="detail-section-title">User's Work Report</div>
                      {panel.task_report
                        ? <div className="detail-text">{panel.task_report}</div>
                        : <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No report submitted yet.</div>}
                    </div>

                    <div className="detail-section">
                      <div className="detail-section-title">Attachments ({panel.files.length})</div>
                      {panel.files.length === 0
                        ? <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No files uploaded yet.</div>
                        : panel.files.map(f => (
                          <div key={f.file_id} className="file-item">
                            <span className="file-icon">{MIME_ICON[f.mime_type] ?? '📎'}</span>
                            <div className="file-info">
                              <div className="file-name">{f.original_name}</div>
                              <div className="file-meta">{fmtSize(f.file_size)} · {f.mime_type.split('/')[1]?.toUpperCase()} · {new Date(f.uploaded_at).toLocaleDateString()}</div>
                            </div>
                            <a href={`/api/admin/tasks/${panel.task_id}/files/${f.file_id}/download`} download={f.original_name}
                              className="action-btn action-btn-edit" style={{ flexShrink: 0, textDecoration: 'none' }}>
                              ↓ Download
                            </a>
                          </div>
                        ))}
                    </div>

                    <div className="detail-section" style={{ borderBottom: 'none' }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setPanel(null); openEdit(panel); }}>Edit Task</button>
                        <button className="action-btn action-btn-danger" style={{ padding: '8px 14px', fontSize: 13, borderRadius: 6 }}
                          onClick={() => handleDelete(panel)}>Delete Task</button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── MEMBERS tab ────────────────────────────────────────────────────── */}
        {tab === 'members' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Project Members ({projMembers.length})</span>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              {memberError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{memberError}</div>}

              {projMembers.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Name</th><th>Email</th><th></th></tr></thead>
                      <tbody>
                        {projMembers.map(m => (
                          <tr key={m.user_id}>
                            <td style={{ fontWeight: 500 }}>{m.fname} {m.lname}</td>
                            <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{m.email}</td>
                            <td>
                              <button className="action-btn action-btn-danger" onClick={() => handleRemoveMember(m.user_id)}>Remove</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {nonMembers.length > 0 ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <select value={addingUser} onChange={e => setAddingUser(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Add a member…</option>
                    {nonMembers.map(m => <option key={m.user_id} value={m.user_id}>{m.fname} {m.lname} ({m.email})</option>)}
                  </select>
                  <button className="btn btn-primary btn-sm" onClick={handleAddMember} disabled={!addingUser}>Add</button>
                </div>
              ) : (
                projMembers.length > 0 && (
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>All group members are already in this project.</div>
                )
              )}

              {projMembers.length === 0 && nonMembers.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">👥</div>
                  <div className="empty-title">No group members yet</div>
                  <div>Invite members to your group first from the main admin dashboard.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── LOGS tab ───────────────────────────────────────────────────────── */}
        {tab === 'logs' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Daily Logs</span>
              <div className="tab-group" style={{ marginBottom: 0 }}>
                <button className={`tab-btn${logTab === 'date' ? ' active' : ''}`} onClick={() => setLogTab('date')}>By Date</button>
                <button className={`tab-btn${logTab === 'member' ? ' active' : ''}`} onClick={() => setLogTab('member')}>By Member</button>
              </div>
            </div>
            <div style={{ padding: '0 20px 20px' }}>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                {logTab === 'date' ? (
                  <>
                    <span className="filter-label">Date</span>
                    <input type="date" value={logDate}
                      min={project.start_date.slice(0, 10)} max={project.end_date.slice(0, 10)}
                      onChange={e => setLogDate(e.target.value)} style={{ width: 'auto' }} />
                  </>
                ) : (
                  <>
                    <span className="filter-label">Member</span>
                    <select value={logUser} onChange={e => setLogUser(e.target.value)} style={{ width: 'auto', minWidth: 180 }}>
                      <option value="">All members</option>
                      {projMembers.map(m => <option key={m.user_id} value={m.user_id}>{m.fname} {m.lname}</option>)}
                    </select>
                  </>
                )}
              </div>

              {logsLoading ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <div className="spinner" style={{ width: 24, height: 24, borderWidth: 3, color: 'var(--color-primary)', display: 'inline-block' }} />
                </div>
              ) : logs.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No logs found for this filter.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {logs.map(l => (
                    <div key={l.log_id} style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 13 }}>{logTab === 'date' ? `${l.fname} ${l.lname}` : l.log_date.slice(0, 10)}</span>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{logTab === 'member' ? l.log_date.slice(0, 10) : ''}</span>
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{l.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create task modal */}
      <Modal open={showCreate} title="Create Task" onClose={() => setShowCreate(false)}>
        {createError && <div className="alert alert-error">{createError}</div>}
        <form onSubmit={handleCreate} noValidate>
          <div className="form-group">
            <label>Assign To</label>
            <select value={cForm.assignedUserId} onChange={e => setCForm(p => ({ ...p, assignedUserId: e.target.value }))} required>
              <option value="">Select a project member…</option>
              {projMembers.map(m => <option key={m.user_id} value={m.user_id}>{m.fname} {m.lname}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Task Name</label>
            <input value={cForm.taskName} onChange={e => setCForm(p => ({ ...p, taskName: e.target.value }))} placeholder="e.g. Design landing page" required disabled={creating} />
          </div>
          <div className="form-group">
            <label>Details <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <textarea value={cForm.taskDetails} onChange={e => setCForm(p => ({ ...p, taskDetails: e.target.value }))} disabled={creating} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Start Date</label>
              <input type="date" value={cForm.startDate} onChange={e => setCForm(p => ({ ...p, startDate: e.target.value }))} required disabled={creating} />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input type="date" value={cForm.endDate} onChange={e => setCForm(p => ({ ...p, endDate: e.target.value }))} required disabled={creating} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm"
              disabled={creating || !cForm.assignedUserId || !cForm.taskName || !cForm.startDate || !cForm.endDate}>
              {creating ? <><span className="spinner" /> Creating…</> : 'Create Task'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit task modal */}
      <Modal open={!!editTask} title="Edit Task" onClose={() => setEditTask(null)}>
        {editError && <div className="alert alert-error">{editError}</div>}
        <form onSubmit={handleEdit} noValidate>
          <div className="form-group">
            <label>Task Name</label>
            <input value={eForm.taskName} onChange={e => setEForm(p => ({ ...p, taskName: e.target.value }))} required disabled={saving} />
          </div>
          <div className="form-group">
            <label>Details</label>
            <textarea value={eForm.taskDetails} onChange={e => setEForm(p => ({ ...p, taskDetails: e.target.value }))} disabled={saving} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Start Date</label>
              <input type="date" value={eForm.startDate} onChange={e => setEForm(p => ({ ...p, startDate: e.target.value }))} required disabled={saving} />
            </div>
            <div className="form-group">
              <label>End Date</label>
              <input type="date" value={eForm.endDate} onChange={e => setEForm(p => ({ ...p, endDate: e.target.value }))} required disabled={saving} />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setEditTask(null)} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !eForm.taskName}>
              {saving ? <><span className="spinner" /> Saving…</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
