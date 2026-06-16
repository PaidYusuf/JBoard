'use client';
import { useEffect, useState, useCallback, FormEvent } from 'react';
import Modal from '@/components/Modal';

interface Project {
  project_id: number;
  project_name: string;
  start_date: string;
  end_date: string;
  created_at: string;
  member_count: number;
}

interface Member { user_id: number; fname: string; lname: string; email: string; }

interface LogEntry {
  log_id: number;
  log_date: string;
  content: string;
  updated_at: string;
  user_id: number;
  fname: string;
  lname: string;
}

const EMPTY_FORM = { projectName: '', startDate: '', endDate: '' };

function today() { return new Date().toISOString().slice(0, 10); }

export default function Projects() {
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [members,   setMembers]   = useState<Member[]>([]);   // all group members
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  // create / edit modals
  const [showCreate,   setShowCreate]   = useState(false);
  const [cForm,        setCForm]        = useState(EMPTY_FORM);
  const [creating,     setCreating]     = useState(false);
  const [createError,  setCreateError]  = useState('');

  const [editProject,  setEditProject]  = useState<Project | null>(null);
  const [eForm,        setEForm]        = useState(EMPTY_FORM);
  const [saving,       setSaving]       = useState(false);
  const [editError,    setEditError]    = useState('');

  // selected project (for member + log panel)
  const [selected,     setSelected]     = useState<Project | null>(null);
  const [projMembers,  setProjMembers]  = useState<Member[]>([]);
  const [addingUser,   setAddingUser]   = useState('');
  const [memberError,  setMemberError]  = useState('');

  // logs panel
  const [logTab,    setLogTab]    = useState<'date' | 'member'>('date');
  const [logDate,   setLogDate]   = useState(today());
  const [logUser,   setLogUser]   = useState('');
  const [logs,      setLogs]      = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/projects', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to load projects'); return; }
      setProjects(data);
    } catch { setError('Failed to load projects'); }
    finally { setLoading(false); }
  }, []);

  async function loadGroupMembers() {
    const res = await fetch('/api/admin/members', { credentials: 'include' });
    if (res.ok) setMembers(await res.json());
  }

  useEffect(() => { loadProjects(); loadGroupMembers(); }, [loadProjects]);

  async function loadProjMembers(projectId: number) {
    const res  = await fetch(`/api/admin/projects/${projectId}/members`, { credentials: 'include' });
    const data = await res.json();
    if (res.ok) setProjMembers(data);
  }

  const loadLogs = useCallback(async (projectId: number) => {
    setLogsLoading(true);
    const params = new URLSearchParams();
    if (logTab === 'date'   && logDate) params.set('date',   logDate);
    if (logTab === 'member' && logUser) params.set('userId', logUser);
    try {
      const res  = await fetch(`/api/admin/projects/${projectId}/logs?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setLogs(data);
    } catch { /* ignore */ }
    finally { setLogsLoading(false); }
  }, [logTab, logDate, logUser]);

  useEffect(() => {
    if (selected) loadLogs(selected.project_id);
  }, [selected, logTab, logDate, logUser, loadLogs]);

  async function openProject(p: Project) {
    setSelected(p);
    setMemberError('');
    setAddingUser('');
    setLogTab('date');
    setLogDate(today());
    setLogUser('');
    await loadProjMembers(p.project_id);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const res  = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectName: cForm.projectName, startDate: cForm.startDate, endDate: cForm.endDate }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || 'Failed to create'); return; }
      setShowCreate(false);
      setCForm(EMPTY_FORM);
      loadProjects();
    } catch { setCreateError('Network error'); }
    finally { setCreating(false); }
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editProject) return;
    setEditError('');
    setSaving(true);
    try {
      const res  = await fetch(`/api/admin/projects/${editProject.project_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ projectName: eForm.projectName, startDate: eForm.startDate, endDate: eForm.endDate }),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || 'Failed to update'); return; }
      setEditProject(null);
      if (selected?.project_id === editProject.project_id) setSelected(data);
      loadProjects();
    } catch { setEditError('Network error'); }
    finally { setSaving(false); }
  }

  async function handleDelete(p: Project) {
    if (!confirm(`Delete project "${p.project_name}"? All logs will be lost.`)) return;
    await fetch(`/api/admin/projects/${p.project_id}`, { method: 'DELETE', credentials: 'include' });
    if (selected?.project_id === p.project_id) setSelected(null);
    loadProjects();
  }

  async function handleAddMember() {
    if (!selected || !addingUser) return;
    setMemberError('');
    const res  = await fetch(`/api/admin/projects/${selected.project_id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId: Number(addingUser) }),
    });
    const data = await res.json();
    if (!res.ok) { setMemberError(data.error || 'Failed to add'); return; }
    setAddingUser('');
    loadProjMembers(selected.project_id);
    loadProjects();
  }

  async function handleRemoveMember(userId: number) {
    if (!selected) return;
    await fetch(`/api/admin/projects/${selected.project_id}/members/${userId}`, {
      method: 'DELETE', credentials: 'include',
    });
    loadProjMembers(selected.project_id);
    loadProjects();
  }

  const nonMembers = members.filter(m => !projMembers.find(pm => pm.user_id === m.user_id));

  return (
    <>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* Project list */}
        <div style={{ flex: selected ? '0 0 380px' : '1' }}>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Projects ({projects.length})</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => { setCreateError(''); setCForm(EMPTY_FORM); setShowCreate(true); }}
              >
                + New Project
              </button>
            </div>

            {error && <div className="alert alert-error" style={{ margin: '16px 20px 0' }}>{error}</div>}

            {loading ? (
              <div className="view-loading">
                <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, color: 'var(--color-primary)' }} />
              </div>
            ) : projects.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📁</div>
                <div className="empty-title">No projects yet</div>
                <div>Create a project and assign members to get started.</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Timeline</th>
                      <th>Members</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map(p => (
                      <tr
                        key={p.project_id}
                        style={{ cursor: 'pointer', background: selected?.project_id === p.project_id ? 'var(--color-bg-subtle)' : undefined }}
                        onClick={() => openProject(p)}
                      >
                        <td style={{ fontWeight: 500 }}>{p.project_name}</td>
                        <td style={{ fontSize: 13, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                          {p.start_date.slice(0, 10)} → {p.end_date.slice(0, 10)}
                        </td>
                        <td style={{ fontSize: 13 }}>{p.member_count}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className="actions-cell">
                            <button
                              className="action-btn action-btn-edit"
                              onClick={() => { setEForm({ projectName: p.project_name, startDate: p.start_date.slice(0, 10), endDate: p.end_date.slice(0, 10) }); setEditError(''); setEditProject(p); }}
                            >Edit</button>
                            <button className="action-btn action-btn-danger" onClick={() => handleDelete(p)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Project detail panel */}
        {selected && (
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Header */}
            <div className="card" style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 18 }}>{selected.project_name}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                    {selected.start_date.slice(0, 10)} → {selected.end_date.slice(0, 10)}
                  </div>
                </div>
                <button className="modal-close" onClick={() => setSelected(null)} aria-label="Close">✕</button>
              </div>
            </div>

            {/* Members */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Members ({projMembers.length})</span>
              </div>
              <div style={{ padding: '0 20px 16px' }}>
                {memberError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{memberError}</div>}

                {projMembers.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    {projMembers.map(m => (
                      <div key={m.user_id} className="file-item" style={{ padding: '8px 0' }}>
                        <div className="file-info">
                          <div className="file-name">{m.fname} {m.lname}</div>
                          <div className="file-meta">{m.email}</div>
                        </div>
                        <button className="action-btn action-btn-danger" style={{ flexShrink: 0 }} onClick={() => handleRemoveMember(m.user_id)}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {nonMembers.length > 0 && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={addingUser}
                      onChange={e => setAddingUser(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">Add a member…</option>
                      {nonMembers.map(m => (
                        <option key={m.user_id} value={m.user_id}>{m.fname} {m.lname} ({m.email})</option>
                      ))}
                    </select>
                    <button className="btn btn-primary btn-sm" onClick={handleAddMember} disabled={!addingUser}>
                      Add
                    </button>
                  </div>
                )}

                {nonMembers.length === 0 && projMembers.length > 0 && (
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                    All group members are already in this project.
                  </div>
                )}
              </div>
            </div>

            {/* Logs */}
            <div className="card">
              <div className="card-header">
                <span className="card-title">Daily Logs</span>
                <div className="tab-group" style={{ marginBottom: 0 }}>
                  <button className={`tab-btn${logTab === 'date' ? ' active' : ''}`} onClick={() => setLogTab('date')}>By Date</button>
                  <button className={`tab-btn${logTab === 'member' ? ' active' : ''}`} onClick={() => setLogTab('member')}>By Member</button>
                </div>
              </div>

              <div style={{ padding: '0 20px 16px' }}>
                {/* Filter controls */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center' }}>
                  {logTab === 'date' ? (
                    <>
                      <span className="filter-label">Date</span>
                      <input
                        type="date"
                        value={logDate}
                        min={selected.start_date.slice(0, 10)}
                        max={selected.end_date.slice(0, 10)}
                        onChange={e => setLogDate(e.target.value)}
                        style={{ width: 'auto' }}
                      />
                    </>
                  ) : (
                    <>
                      <span className="filter-label">Member</span>
                      <select value={logUser} onChange={e => setLogUser(e.target.value)} style={{ width: 'auto', minWidth: 180 }}>
                        <option value="">All members</option>
                        {projMembers.map(m => (
                          <option key={m.user_id} value={m.user_id}>{m.fname} {m.lname}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>

                {logsLoading ? (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <div className="spinner" style={{ width: 24, height: 24, borderWidth: 3, color: 'var(--color-primary)', display: 'inline-block' }} />
                  </div>
                ) : logs.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                    No logs found for this filter.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {logs.map(l => (
                      <div key={l.log_id} style={{ borderLeft: '3px solid var(--color-primary)', paddingLeft: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>
                            {logTab === 'date' ? `${l.fname} ${l.lname}` : l.log_date.slice(0, 10)}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                            {logTab === 'member' ? l.log_date.slice(0, 10) : ''}
                          </span>
                        </div>
                        <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
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

      {/* Create modal */}
      <Modal open={showCreate} title="New Project" onClose={() => setShowCreate(false)}>
        {createError && <div className="alert alert-error">{createError}</div>}
        <form onSubmit={handleCreate} noValidate>
          <div className="form-group">
            <label>Project Name</label>
            <input value={cForm.projectName} onChange={e => setCForm(p => ({ ...p, projectName: e.target.value }))} placeholder="e.g. Website Redesign" required disabled={creating} />
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
            <button type="submit" className="btn btn-primary btn-sm" disabled={creating || !cForm.projectName || !cForm.startDate || !cForm.endDate}>
              {creating ? <><span className="spinner" /> Creating…</> : 'Create Project'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editProject} title="Edit Project" onClose={() => setEditProject(null)}>
        {editError && <div className="alert alert-error">{editError}</div>}
        <form onSubmit={handleEdit} noValidate>
          <div className="form-group">
            <label>Project Name</label>
            <input value={eForm.projectName} onChange={e => setEForm(p => ({ ...p, projectName: e.target.value }))} required disabled={saving} />
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
            <button type="button" className="btn btn-secondary" onClick={() => setEditProject(null)} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !eForm.projectName}>
              {saving ? <><span className="spinner" /> Saving…</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
