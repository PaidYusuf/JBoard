'use client';
import { useEffect, useState, useCallback, useRef } from 'react';

interface TaskRow {
  task_id: number;
  task_name: string;
  task_details: string | null;
  status: string;
  start_date: string;
  end_date: string;
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

interface TaskDetail extends TaskRow {
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

function isOverdue(t: TaskRow) {
  const end   = new Date(t.end_date.slice(0, 10) + 'T12:00:00');
  const today = new Date(new Date().toDateString());
  return t.status !== 'completed' && end < today;
}

export default function Tasks() {
  const [tasks,    setTasks]    = useState<TaskRow[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [fStatus,  setFStatus]  = useState('');

  // Detail panel
  const [panel,       setPanel]       = useState<TaskDetail | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);

  // Status update
  const [statusSaving, setStatusSaving] = useState(false);

  // Report
  const [reportText,  setReportText]  = useState('');
  const [reportSaving, setReportSaving] = useState(false);
  const [reportSaved, setReportSaved] = useState(false);

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading,  setUploading]  = useState(false);
  const [uploadError, setUploadError] = useState('');

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (fStatus) params.set('status', fStatus);
    try {
      const res  = await fetch(`/api/user/tasks?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to load tasks'); return; }
      setTasks(data);
    } catch { setError('Failed to load tasks'); }
    finally { setLoading(false); }
  }, [fStatus]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  async function openPanel(taskId: number) {
    setPanelLoading(true);
    setPanel(null);
    try {
      const res  = await fetch(`/api/user/tasks/${taskId}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) return;
      setPanel(data);
      setReportText(data.task_report ?? '');
      setReportSaved(false);
      setUploadError('');
    } catch { /* ignore */ }
    finally { setPanelLoading(false); }
  }

  function closePanel() {
    setPanel(null);
    loadTasks(); // refresh list in case status changed
  }

  async function handleStatusUpdate(status: string) {
    if (!panel || statusSaving) return;
    setStatusSaving(true);
    try {
      const res  = await fetch(`/api/user/tasks/${panel.task_id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (!res.ok) return;
      setPanel(p => p ? { ...p, status } : p);
      setTasks(prev => prev.map(t => t.task_id === panel.task_id ? { ...t, status } : t));
    } catch { /* ignore */ }
    finally { setStatusSaving(false); }
  }

  async function handleSaveReport() {
    if (!panel || reportSaving) return;
    setReportSaving(true);
    setReportSaved(false);
    try {
      const res = await fetch(`/api/user/tasks/${panel.task_id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reportText }),
      });
      if (!res.ok) return;
      setPanel(p => p ? { ...p, task_report: reportText } : p);
      setReportSaved(true);
      setTimeout(() => setReportSaved(false), 2500);
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
        method: 'POST',
        credentials: 'include',
        body: form,
        // No Content-Type — browser sets multipart boundary automatically
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
    if (!panel) return;
    if (!confirm('Delete this file?')) return;
    try {
      await fetch(`/api/user/tasks/${panel.task_id}/files/${fileId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      await refreshFiles();
    } catch { /* ignore */ }
  }

  return (
    <>
      {/* Filter bar */}
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <div className="filter-group">
          <span className="filter-label">Status</span>
          <select
            className="filter-select"
            value={fStatus}
            onChange={e => setFStatus(e.target.value)}
            style={{ width: 'auto', minWidth: 140 }}
          >
            <option value="">All statuses</option>
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        {fStatus && (
          <button
            className="btn btn-secondary"
            style={{ alignSelf: 'flex-end', padding: '9px 14px', fontSize: 13 }}
            onClick={() => setFStatus('')}
          >
            Clear
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-text-muted)', alignSelf: 'center' }}>
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </span>
      </div>

      {/* Task table */}
      <div className="card">
        {error && <div className="alert alert-error" style={{ margin: '16px 20px 0' }}>{error}</div>}

        {loading ? (
          <div className="view-loading">
            <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, color: 'var(--color-primary)' }} />
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Status</th>
                  <th>Due Date</th>
                  <th>Assigned By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr><td colSpan={5}>
                    <div className="empty-state">
                      <div className="empty-icon">📋</div>
                      <div className="empty-title">No tasks assigned</div>
                      <div>Tasks assigned to you by your admin will appear here.</div>
                    </div>
                  </td></tr>
                ) : tasks.map(t => (
                  <tr key={t.task_id} style={{ cursor: 'pointer' }} onClick={() => openPanel(t.task_id)}>
                    <td style={{ fontWeight: 500, maxWidth: 240 }}>
                      {t.task_name}
                      {isOverdue(t) && (
                        <span className="badge badge-red" style={{ marginLeft: 8, fontSize: 11 }}>Overdue</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[t.status] ?? 'badge-gray'}`}>
                        {STATUS_LABELS[t.status] ?? t.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: isOverdue(t) ? 'var(--color-error)' : 'var(--color-text-muted)' }}>
                      {t.end_date.slice(0, 10)}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      {t.creator_fname} {t.creator_lname}
                    </td>
                    <td>
                      <button
                        className="action-btn action-btn-edit"
                        onClick={e => { e.stopPropagation(); openPanel(t.task_id); }}
                      >
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

      {/* Panel loading spinner (before panel opens) */}
      {panelLoading && !panel && (
        <div className="panel-overlay">
          <div style={{ position: 'fixed', top: '50%', right: 250, transform: 'translateY(-50%)' }}>
            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, color: '#fff' }} />
          </div>
        </div>
      )}

      {/* Detail panel */}
      {panel && (
        <>
          <div className="panel-overlay" onClick={closePanel} />
          <div className="detail-panel">
            {/* Header */}
            <div className="detail-panel-header">
              <div>
                <div className="detail-panel-title">{panel.task_name}</div>
                <div style={{ marginTop: 6 }}>
                  <span className={`badge ${STATUS_BADGE[panel.status] ?? 'badge-gray'}`}>
                    {STATUS_LABELS[panel.status] ?? panel.status}
                  </span>
                  {isOverdue(panel) && (
                    <span className="badge badge-red" style={{ marginLeft: 6 }}>Overdue</span>
                  )}
                </div>
              </div>
              <button
                className="modal-close"
                onClick={closePanel}
                style={{ marginTop: 2 }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Scrollable body */}
            <div className="detail-panel-body">

              {/* Meta */}
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
                    <div className="detail-meta-value" style={{ fontSize: 13 }}>
                      {new Date(panel.updated_at).toLocaleDateString()}
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

              {/* Status update */}
              <div className="detail-section">
                <div className="detail-section-title">Update Status</div>
                <div className="status-group">
                  {(['not_started', 'in_progress', 'completed'] as const).map(s => (
                    <button
                      key={s}
                      className={`status-opt${panel.status === s ? ` s-active-${s}` : ''}`}
                      onClick={() => handleStatusUpdate(s)}
                      disabled={statusSaving || panel.status === s}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Report */}
              <div className="detail-section">
                <div className="detail-section-title">Work Report</div>
                <textarea
                  value={reportText}
                  onChange={e => { setReportText(e.target.value); setReportSaved(false); }}
                  placeholder="Describe what you've done, progress, blockers…"
                  style={{ minHeight: 120, marginBottom: 10 }}
                  disabled={reportSaving}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveReport}
                    disabled={reportSaving || reportText === (panel.task_report ?? '')}
                  >
                    {reportSaving ? <><span className="spinner" /> Saving…</> : 'Save Report'}
                  </button>
                  {reportSaved && (
                    <span style={{ fontSize: 13, color: 'var(--color-success)' }}>✓ Saved</span>
                  )}
                </div>
              </div>

              {/* Files */}
              <div className="detail-section">
                <div className="detail-section-title">
                  Attachments ({panel.files.length})
                </div>

                {uploadError && (
                  <div className="alert alert-error" style={{ marginBottom: 12 }}>{uploadError}</div>
                )}

                {panel.files.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    {panel.files.map(f => (
                      <div key={f.file_id} className="file-item">
                        <span className="file-icon">{MIME_ICON[f.mime_type] ?? '📎'}</span>
                        <div className="file-info">
                          <div className="file-name">{f.original_name}</div>
                          <div className="file-meta">
                            {fmtSize(f.file_size)} · {f.mime_type.split('/')[1]?.toUpperCase()} · {new Date(f.uploaded_at).toLocaleDateString()}
                          </div>
                        </div>
                        <button
                          className="action-btn action-btn-danger"
                          onClick={() => handleDeleteFile(f.file_id)}
                          style={{ flexShrink: 0 }}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                  accept=".pdf,.csv,.txt,.jpg,.jpeg,.png,.gif,.doc,.docx,.xls,.xlsx"
                />
                <div
                  className="upload-area"
                  onClick={() => !uploading && fileInputRef.current?.click()}
                >
                  {uploading
                    ? <><span className="spinner" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }} /> Uploading…</>
                    : '+ Click to attach a file (PDF, image, Word, Excel, CSV — max 20 MB)'}
                </div>
              </div>

            </div>
          </div>
        </>
      )}
    </>
  );
}
