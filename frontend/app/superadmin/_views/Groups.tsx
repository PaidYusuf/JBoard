'use client';
import { useEffect, useState, FormEvent } from 'react';
import Modal from '@/components/Modal';
import Icon from '@/components/Icon';

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
const EMPTY_ADMIN  = { email: '', password: '', fname: '', lname: '' };

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

  const [adminGroup,  setAdminGroup]  = useState<Group | null>(null);
  const [adminForm,   setAdminForm]   = useState(EMPTY_ADMIN);
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminError,  setAdminError]  = useState('');
  const [adminDone,   setAdminDone]   = useState(false);

  const [usersGroup,   setUsersGroup]   = useState<Group | null>(null);
  const [groupUsers,   setGroupUsers]   = useState<{user_id:number;fname:string;lname:string;email:string;role:string;is_active:boolean}[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

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

  function openAdminModal(g: Group) {
    setAdminGroup(g);
    setAdminForm(EMPTY_ADMIN);
    setAdminError('');
    setAdminDone(false);
  }

  async function openUsersModal(g: Group) {
    setUsersGroup(g);
    setUsersLoading(true);
    setGroupUsers([]);
    try {
      const res  = await fetch(`/api/superadmin/groups/${g.group_id}/users`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setGroupUsers(data);
    } catch { /* ignore */ }
    finally { setUsersLoading(false); }
  }

  async function handleDeleteUser(userId: number, name: string) {
    if (!confirm(`Permanently delete ${name}?\n\nThis cannot be undone.`)) return;
    try {
      const res  = await fetch(`/api/superadmin/users/${userId}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to delete user'); return; }
      setGroupUsers(prev => prev.filter(u => u.user_id !== userId));
      load();
    } catch { alert('Network error'); }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (!adminGroup) return;
    setAdminError('');
    setAdminSaving(true);
    try {
      const res  = await fetch(`/api/superadmin/groups/${adminGroup.group_id}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(adminForm),
      });
      const data = await res.json();
      if (!res.ok) { setAdminError(data.error || 'Failed to create admin'); return; }
      setAdminDone(true);
      load();
    } catch { setAdminError('Network error'); }
    finally { setAdminSaving(false); }
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
                      <div className="empty-icon"><Icon name="building" size={26} /></div>
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
                      <button className="action-btn action-btn-edit" onClick={() => openUsersModal(g)}>Users</button>
                      <button className="action-btn action-btn-success" onClick={() => openAdminModal(g)}>+ Admin</button>
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

      {/* Users modal */}
      <Modal open={!!usersGroup} title={`Users — ${usersGroup?.group_name}`} onClose={() => setUsersGroup(null)}>
        {usersLoading ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, color: 'var(--color-primary)', display: 'inline-block' }} />
          </div>
        ) : groupUsers.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '8px 0' }}>No users in this group yet.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groupUsers.map(u => (
              <div key={u.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{u.fname} {u.lname}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{u.email}</div>
                </div>
                <span className={`badge ${u.role === 'admin' ? 'badge-purple' : 'badge-gray'}`}>{u.role}</span>
                <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>{u.is_active ? 'Active' : 'Inactive'}</span>
                <button className="action-btn action-btn-danger" onClick={() => handleDeleteUser(u.user_id, `${u.fname} ${u.lname}`)}>Delete</button>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn btn-secondary" onClick={() => setUsersGroup(null)}>Close</button>
        </div>
      </Modal>

      {/* Create Admin modal */}
      <Modal open={!!adminGroup} title={`Create Admin — ${adminGroup?.group_name}`} onClose={() => setAdminGroup(null)}>
        {adminDone ? (
          <div>
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              Admin account created successfully!
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
              Share these credentials with the admin securely. They should change their password on first login.
            </div>
            <div className="modal-actions">
              <button className="btn btn-primary btn-sm" onClick={() => setAdminGroup(null)}>Done</button>
            </div>
          </div>
        ) : (
          <>
            {adminError && <div className="alert alert-error">{adminError}</div>}
            <form onSubmit={handleCreateAdmin} noValidate>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input value={adminForm.fname} onChange={e => setAdminForm(p => ({ ...p, fname: e.target.value }))} required disabled={adminSaving} />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input value={adminForm.lname} onChange={e => setAdminForm(p => ({ ...p, lname: e.target.value }))} required disabled={adminSaving} />
                </div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={adminForm.email} onChange={e => setAdminForm(p => ({ ...p, email: e.target.value }))} required disabled={adminSaving} />
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type="password" value={adminForm.password} onChange={e => setAdminForm(p => ({ ...p, password: e.target.value }))} required disabled={adminSaving} minLength={8} placeholder="Min. 8 characters" />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setAdminGroup(null)} disabled={adminSaving}>Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm"
                  disabled={adminSaving || !adminForm.email || !adminForm.password || !adminForm.fname || !adminForm.lname}>
                  {adminSaving ? <><span className="spinner" /> Creating…</> : 'Create Admin'}
                </button>
              </div>
            </form>
          </>
        )}
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
