'use client';
import { useEffect, useState, useCallback, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import Icon from '@/components/Icon';

interface Project {
  project_id: number;
  project_name: string;
  start_date: string;
  end_date: string;
  member_count: number;
}

const EMPTY = { projectName: '', startDate: '', endDate: '' };

function statusOf(p: Project) {
  const t = new Date().toISOString().slice(0, 10);
  if (t < p.start_date.slice(0, 10)) return { label: 'Upcoming', cls: 'badge-gray' };
  if (t > p.end_date.slice(0, 10))   return { label: 'Ended',    cls: 'badge-gray' };
  return { label: 'Active', cls: 'badge-green' };
}

export default function Projects() {
  const router = useRouter();
  const [projects,     setProjects]     = useState<Project[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');

  const [showCreate,   setShowCreate]   = useState(false);
  const [cForm,        setCForm]        = useState(EMPTY);
  const [creating,     setCreating]     = useState(false);
  const [createError,  setCreateError]  = useState('');

  const [editProject,  setEditProject]  = useState<Project | null>(null);
  const [eForm,        setEForm]        = useState(EMPTY);
  const [saving,       setSaving]       = useState(false);
  const [editError,    setEditError]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/admin/projects', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to load'); return; }
      setProjects(data);
    } catch { setError('Failed to load projects'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

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
      setCForm(EMPTY);
      load();
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
      load();
    } catch { setEditError('Network error'); }
    finally { setSaving(false); }
  }

  async function handleDelete(p: Project) {
    if (!confirm(`Delete project "${p.project_name}"? All tasks and logs will be lost.`)) return;
    await fetch(`/api/admin/projects/${p.project_id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  if (loading) return (
    <div className="view-loading">
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, color: 'var(--color-primary)' }} />
    </div>
  );

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          {projects.length} {projects.length === 1 ? 'project' : 'projects'} — click one to open
        </span>
        <button className="btn btn-primary btn-sm"
          onClick={() => { setCreateError(''); setCForm(EMPTY); setShowCreate(true); }}>
          + New Project
        </button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {projects.length === 0 ? (
        <div className="card" style={{ padding: 20 }}>
          <div className="empty-state">
            <div className="empty-icon"><Icon name="folder" size={26} /></div>
            <div className="empty-title">No projects yet</div>
            <div>Create a project, add members, then assign tasks to them.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {projects.map(p => {
            const status = statusOf(p);
            return (
              <div
                key={p.project_id}
                className="card card-clickable"
                style={{ padding: '20px' }}
                onClick={() => router.push(`/admin/projects/${p.project_id}`)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, flex: 1, marginRight: 8 }}>{p.project_name}</div>
                  <span className={`badge ${status.cls}`}>{status.label}</span>
                </div>

                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 14 }}>
                  {p.start_date.slice(0, 10)} → {p.end_date.slice(0, 10)}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Icon name="users" size={15} /> {p.member_count} member{p.member_count !== 1 ? 's' : ''}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
                    <button className="action-btn action-btn-edit"
                      onClick={() => { setEForm({ projectName: p.project_name, startDate: p.start_date.slice(0, 10), endDate: p.end_date.slice(0, 10) }); setEditError(''); setEditProject(p); }}>
                      Edit
                    </button>
                    <button className="action-btn action-btn-danger" onClick={() => handleDelete(p)}>Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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
