'use client';
import { useEffect, useState, useCallback, FormEvent } from 'react';
import Modal from '@/components/Modal';
import Icon from '@/components/Icon';

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
  email: string;
  creator_fname: string;
  creator_lname: string;
  created_at: string;
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

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed:   'Completed',
};
const STATUS_BADGE: Record<string, string> = {
  not_started: 'badge-gray',
  in_progress: 'badge-blue',
  completed:   'badge-green',
};

const MIME_ICON: Record<string, string> = {
  'application/pdf': '📄',
  'text/csv': '📊',
  'text/plain': '📃',
  'image/jpeg': '🖼️',
  'image/png': '🖼️',
  'image/gif': '🖼️',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
};

function fmtSize(bytes: number) {
  const b = Number(bytes);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

const EMPTY_FORM = { assignedUserId: '', taskName: '', taskDetails: '', startDate: '', endDate: '' };

function isOverdue(task: Task) {
  const end   = new Date(task.end_date.slice(0, 10) + 'T12:00:00');
  const today = new Date(new Date().toDateString());
  return task.status !== 'completed' && end < today;
}

export default function Tasks() {
  const [tasks,   setTasks]   = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // Filters
  const [fStatus, setFStatus] = useState('');
  const [fUser,   setFUser]   = useState('');
  const [fFrom,   setFFrom]   = useState('');
  const [fTo,     setFTo]     = useState('');

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [cForm, setCForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edit modal
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [eForm, setEForm] = useState({ taskName: '', taskDetails: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Detail panel (read-only)
  const [panel,        setPanel]        = useState<TaskDetail | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fStatus) params.set('status', fStatus);
    if (fUser)   params.set('userId', fUser);
    if (fFrom)   params.set('startDate', fFrom);
    if (fTo)     params.set('endDate', fTo);
    try {
      const res = await fetch(`/api/admin/tasks?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to load tasks'); return; }
      setTasks(data);
    } catch { setError('Failed to load tasks'); }
    finally { setLoading(false); }
  }, [fStatus, fUser, fFrom, fTo]);

  async function loadMembers() {
    const res = await fetch('/api/admin/members', { credentials: 'include' });
    setMembers(await res.json());
  }

  useEffect(() => { loadMembers(); }, []);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  async function openPanel(taskId: number) {
    setPanelLoading(true);
    setPanel(null);
    try {
      const res  = await fetch(`/api/admin/tasks/${taskId}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setPanel(data);
    } catch { /* ignore */ }
    finally { setPanelLoading(false); }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          assignedUserId: Number(cForm.assignedUserId),
          taskName:   cForm.taskName,
          taskDetails: cForm.taskDetails || undefined,
          startDate:  cForm.startDate,
          endDate:    cForm.endDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || 'Failed to create task'); return; }
      setShowCreate(false);
      setCForm(EMPTY_FORM);
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
      if (eForm.taskName    !== editTask.task_name)    body.taskName    = eForm.taskName;
      if (eForm.taskDetails !== (editTask.task_details ?? '')) body.taskDetails = eForm.taskDetails || null;
      if (eForm.startDate   !== editTask.start_date.slice(0, 10)) body.startDate = eForm.startDate;
      if (eForm.endDate     !== editTask.end_date.slice(0, 10))   body.endDate   = eForm.endDate;
      if (!Object.keys(body).length) { setEditTask(null); return; }
      const res = await fetch(`/api/admin/tasks/${editTask.task_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || 'Failed to update'); return; }
      setEditTask(null);
      loadTasks();
    } catch { setEditError('Network error'); }
    finally { setSaving(false); }
  }

  async function handleDelete(t: Task) {
    if (!confirm(`Delete task "${t.task_name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/admin/tasks/${t.task_id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) { const d = await res.json(); alert(d.error || 'Failed to delete'); return; }
      if (panel?.task_id === t.task_id) setPanel(null);
      loadTasks();
    } catch { alert('Network error'); }
  }

  function openEdit(t: Task) {
    setEForm({
      taskName:    t.task_name,
      taskDetails: t.task_details ?? '',
      startDate:   t.start_date.slice(0, 10),
      endDate:     t.end_date.slice(0, 10),
    });
    setEditError('');
    setEditTask(t);
  }

  const hasFilters = fStatus || fUser || fFrom || fTo;

  return (
    <>
      {/* Filter bar */}
      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-label">Status</span>
          <select className="filter-select" value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ width: 'auto', minWidth: 130 }}>
            <option value="">All statuses</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">Member</span>
          <select className="filter-select" value={fUser} onChange={e => setFUser(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
            <option value="">All members</option>
            {members.map(m => <option key={m.user_id} value={m.user_id}>{m.fname} {m.lname}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">From</span>
          <input type="date" style={{ width: 'auto' }} value={fFrom} onChange={e => setFFrom(e.target.value)} />
        </div>
        <div className="filter-group">
          <span className="filter-label">To</span>
          <input type="date" style={{ width: 'auto' }} value={fTo} onChange={e => setFTo(e.target.value)} />
        </div>
        {hasFilters && (
          <button className="btn btn-secondary" style={{ alignSelf: 'flex-end', padding: '9px 14px', fontSize: 13 }}
            onClick={() => { setFStatus(''); setFUser(''); setFFrom(''); setFTo(''); }}>
            Clear
          </button>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Tasks ({tasks.length})</span>
          <button className="btn btn-primary btn-sm" onClick={() => { setCreateError(''); setCForm(EMPTY_FORM); setShowCreate(true); }}>
            + New Task
          </button>
        </div>

        {error && <div className="alert alert-error" style={{ margin: '16px 20px 0' }}>{error}</div>}

        {loading ? (
          <div className="view-loading"><div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, color: 'var(--color-primary)' }} /></div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Task Name</th>
                  <th>Assigned To</th>
                  <th>Status</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Created By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr><td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-icon"><Icon name="check-square" size={26} /></div>
                      <div className="empty-title">No tasks found</div>
                      <div>Create a task or adjust the filters.</div>
                    </div>
                  </td></tr>
                ) : tasks.map(t => (
                  <tr
                    key={t.task_id}
                    style={{ cursor: 'pointer', background: panel?.task_id === t.task_id ? 'var(--color-bg-subtle)' : undefined }}
                    onClick={() => openPanel(t.task_id)}
                  >
                    <td style={{ fontWeight: 500, maxWidth: 220 }}>
                      {t.task_name}
                      {isOverdue(t) && <span className="badge badge-red" style={{ marginLeft: 8, fontSize: 11 }}>Overdue</span>}
                    </td>
                    <td style={{ fontSize: 13 }}>{t.fname} {t.lname}</td>
                    <td><span className={`badge ${STATUS_BADGE[t.status] ?? 'badge-gray'}`}>{STATUS_LABELS[t.status] ?? t.status}</span></td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{t.start_date.slice(0, 10)}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{t.end_date.slice(0, 10)}</td>
                    <td style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{t.creator_fname} {t.creator_lname}</td>
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

      {/* Detail panel — read-only view of user's work */}
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
              <button className="modal-close" onClick={() => setPanel(null)} aria-label="Close">✕</button>
            </div>

            <div className="detail-panel-body">

              {/* Meta */}
              <div className="detail-section">
                <div className="detail-section-title">Task Info</div>
                <div className="detail-meta-grid">
                  <div>
                    <div className="detail-meta-label">Status</div>
                    <div className="detail-meta-value">
                      <span className={`badge ${STATUS_BADGE[panel.status] ?? 'badge-gray'}`}>
                        {STATUS_LABELS[panel.status] ?? panel.status}
                      </span>
                      {isOverdue(panel) && <span className="badge badge-red" style={{ marginLeft: 6 }}>Overdue</span>}
                    </div>
                  </div>
                  <div>
                    <div className="detail-meta-label">Last Updated</div>
                    <div className="detail-meta-value" style={{ fontSize: 13 }}>
                      {new Date(panel.updated_at).toLocaleDateString()}
                    </div>
                  </div>
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
                </div>

                {panel.task_details && (
                  <div style={{ marginTop: 14 }}>
                    <div className="detail-meta-label" style={{ marginBottom: 6 }}>Description</div>
                    <div className="detail-text">{panel.task_details}</div>
                  </div>
                )}
              </div>

              {/* Report */}
              <div className="detail-section">
                <div className="detail-section-title">User's Work Report</div>
                {panel.task_report ? (
                  <div className="detail-text">{panel.task_report}</div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    No report submitted yet.
                  </div>
                )}
              </div>

              {/* Files */}
              <div className="detail-section">
                <div className="detail-section-title">Attachments ({panel.files.length})</div>

                {panel.files.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    No files uploaded yet.
                  </div>
                ) : panel.files.map(f => (
                  <div key={f.file_id} className="file-item">
                    <span className="file-icon">{MIME_ICON[f.mime_type] ?? '📎'}</span>
                    <div className="file-info">
                      <div className="file-name">{f.original_name}</div>
                      <div className="file-meta">
                        {fmtSize(f.file_size)} · {f.mime_type.split('/')[1]?.toUpperCase()} · {new Date(f.uploaded_at).toLocaleDateString()}
                      </div>
                    </div>
                    <a
                      href={`/api/admin/tasks/${panel.task_id}/files/${f.file_id}/download`}
                      download={f.original_name}
                      className="action-btn action-btn-edit"
                      style={{ flexShrink: 0, textDecoration: 'none' }}
                    >
                      ↓ Download
                    </a>
                  </div>
                ))}
              </div>

              {/* Quick-action buttons */}
              <div className="detail-section" style={{ borderBottom: 'none', paddingBottom: 0 }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setPanel(null); openEdit(panel); }}
                  >
                    Edit Task
                  </button>
                  <button
                    className="action-btn action-btn-danger"
                    style={{ padding: '8px 14px', fontSize: 13, borderRadius: 6 }}
                    onClick={() => handleDelete(panel)}
                  >
                    Delete Task
                  </button>
                </div>
              </div>

            </div>
          </div>
        </>
      )}

      {/* Create task modal */}
      <Modal open={showCreate} title="Create Task" onClose={() => setShowCreate(false)}>
        {createError && <div className="alert alert-error">{createError}</div>}
        <form onSubmit={handleCreate} noValidate>
          <div className="form-group">
            <label>Assign To</label>
            <select value={cForm.assignedUserId} onChange={e => setCForm(p => ({ ...p, assignedUserId: e.target.value }))} required>
              <option value="">Select a member…</option>
              {members.map(m => <option key={m.user_id} value={m.user_id}>{m.fname} {m.lname} ({m.email})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Task Name</label>
            <input value={cForm.taskName} onChange={e => setCForm(p => ({ ...p, taskName: e.target.value }))} placeholder="e.g. Design homepage layout" required disabled={creating} />
          </div>
          <div className="form-group">
            <label>Details <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <textarea value={cForm.taskDetails} onChange={e => setCForm(p => ({ ...p, taskDetails: e.target.value }))} placeholder="Additional context…" disabled={creating} />
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
    </>
  );
}
