'use client';
import { useEffect, useState, FormEvent } from 'react';
import Modal from '@/components/Modal';

interface Plan {
  plan_id: number;
  plan_name: string;
  max_user: number;
}

interface Group {
  group_id: number;
  group_name: string;
  type: string;
  status: string;
  created_at: string;
  plan_id: number;
  plan_name: string;
  max_user: number;
  user_count: number;
}

const EMPTY_CREATE = { name: '', planId: '', type: 'company' };

export default function Groups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [create, setCreate] = useState(EMPTY_CREATE);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [editName, setEditName] = useState('');
  const [editPlanId, setEditPlanId] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [gRes, pRes] = await Promise.all([
        fetch('/api/superadmin/groups', { credentials: 'include' }),
        fetch('/api/superadmin/plans',  { credentials: 'include' }),
      ]);
      setGroups(await gRes.json());
      setPlans(await pRes.json());
    } catch { setError('Failed to load groups'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const res = await fetch('/api/superadmin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ groupName: create.name, planId: Number(create.planId), type: create.type }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || 'Failed to create group'); return; }
      setShowCreate(false);
      setCreate(EMPTY_CREATE);
      load();
    } catch { setCreateError('Network error'); }
    finally { setCreating(false); }
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editGroup) return;
    setEditError('');
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (editName !== editGroup.group_name) body.groupName = editName;
      if (Number(editPlanId) !== editGroup.plan_id) body.planId = Number(editPlanId);
      if (!Object.keys(body).length) { setEditGroup(null); return; }
      const res = await fetch(`/api/superadmin/groups/${editGroup.group_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || 'Failed to update'); return; }
      setEditGroup(null);
      load();
    } catch { setEditError('Network error'); }
    finally { setSaving(false); }
  }

  async function handleToggleStatus(g: Group) {
    const next = g.status === 'active' ? 'suspended' : 'active';
    if (!confirm(`${next === 'suspended' ? 'Suspend' : 'Reactivate'} "${g.group_name}"?`)) return;
    try {
      await fetch(`/api/superadmin/groups/${g.group_id}/suspend`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: next }),
      });
      load();
    } catch { alert('Failed to update status'); }
  }

  function openEdit(g: Group) {
    setEditName(g.group_name);
    setEditPlanId(String(g.plan_id));
    setEditError('');
    setEditGroup(g);
  }

  if (loading) return <div className="view-loading"><div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, color: 'var(--color-primary)' }} /></div>;

  return (
    <>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Groups ({groups.length})</span>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setCreateError(''); setCreate(EMPTY_CREATE); setShowCreate(true); }}
          >
            + New Group
          </button>
        </div>

        {error && <div className="alert alert-error" style={{ margin: '16px 20px 0' }}>{error}</div>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Plan</th>
                <th>Users</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state">
                      <div className="empty-icon">🏢</div>
                      <div className="empty-title">No groups yet</div>
                      <div>Create the first group to get started.</div>
                    </div>
                  </td>
                </tr>
              ) : groups.map(g => (
                <tr key={g.group_id}>
                  <td style={{ fontWeight: 500 }}>{g.group_name}</td>
                  <td><span className={`badge ${g.type === 'company' ? 'badge-blue' : 'badge-gray'}`}>{g.type}</span></td>
                  <td style={{ color: 'var(--color-text-muted)' }}>{g.plan_name}</td>
                  <td>{g.user_count} / {g.max_user}</td>
                  <td>
                    <span className={`badge ${g.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                      {g.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--color-text-muted)' }}>{new Date(g.created_at).toLocaleDateString()}</td>
                  <td>
                    <div className="actions-cell">
                      <button className="action-btn action-btn-edit" onClick={() => openEdit(g)}>Edit</button>
                      {g.status === 'active'
                        ? <button className="action-btn action-btn-warning" onClick={() => handleToggleStatus(g)}>Suspend</button>
                        : <button className="action-btn action-btn-success" onClick={() => handleToggleStatus(g)}>Activate</button>
                      }
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create modal */}
      <Modal open={showCreate} title="Create Group" onClose={() => setShowCreate(false)}>
        {createError && <div className="alert alert-error">{createError}</div>}
        <form onSubmit={handleCreate} noValidate>
          <div className="form-group">
            <label>Group Name</label>
            <input
              value={create.name}
              onChange={e => setCreate(p => ({ ...p, name: e.target.value }))}
              placeholder="Acme Corp"
              required
              disabled={creating}
            />
          </div>
          <div className="form-group">
            <label>Plan</label>
            <select
              value={create.planId}
              onChange={e => setCreate(p => ({ ...p, planId: e.target.value }))}
              required
            >
              <option value="">Select a plan…</option>
              {plans.map(p => (
                <option key={p.plan_id} value={p.plan_id}>
                  {p.plan_name} (up to {p.max_user} users)
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Type</label>
            <select value={create.type} onChange={e => setCreate(p => ({ ...p, type: e.target.value }))}>
              <option value="company">Company</option>
              <option value="personal">Personal</option>
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)} disabled={creating}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={creating || !create.name.trim() || !create.planId}
            >
              {creating ? <><span className="spinner" /> Creating…</> : 'Create Group'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editGroup} title={`Edit: ${editGroup?.group_name}`} onClose={() => setEditGroup(null)}>
        {editError && <div className="alert alert-error">{editError}</div>}
        <form onSubmit={handleEdit} noValidate>
          <div className="form-group">
            <label>Group Name</label>
            <input value={editName} onChange={e => setEditName(e.target.value)} required disabled={saving} />
          </div>
          <div className="form-group">
            <label>Plan</label>
            <select value={editPlanId} onChange={e => setEditPlanId(e.target.value)}>
              {plans.map(p => (
                <option key={p.plan_id} value={p.plan_id}>
                  {p.plan_name} (up to {p.max_user} users)
                </option>
              ))}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setEditGroup(null)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving || !editName.trim()}>
              {saving ? <><span className="spinner" /> Saving…</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
