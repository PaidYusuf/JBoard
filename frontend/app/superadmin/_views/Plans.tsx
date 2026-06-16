'use client';
import { useEffect, useState, FormEvent } from 'react';
import Modal from '@/components/Modal';

interface Plan {
  plan_id: number;
  plan_name: string;
  max_user: number;
  max_projects: number;
  price: string;
  group_count: number;
}

const EMPTY = { name: '', maxUser: '', maxProjects: '', price: '' };

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [editForm, setEditForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/superadmin/plans', { credentials: 'include' });
      setPlans(await res.json());
    } catch { setError('Failed to load plans'); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const res = await fetch('/api/superadmin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          planName:    form.name,
          maxUser:     Number(form.maxUser),
          maxProjects: Number(form.maxProjects),
          price:       Number(form.price),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setCreateError(data.error || 'Failed to create plan'); return; }
      setShowCreate(false);
      setForm(EMPTY);
      load();
    } catch { setCreateError('Network error'); }
    finally { setCreating(false); }
  }

  async function handleEdit(e: FormEvent) {
    e.preventDefault();
    if (!editPlan) return;
    setEditError('');
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (editForm.name    !== editPlan.plan_name)                    body.planName    = editForm.name;
      if (Number(editForm.maxUser)     !== editPlan.max_user)         body.maxUser     = Number(editForm.maxUser);
      if (Number(editForm.maxProjects) !== editPlan.max_projects)     body.maxProjects = Number(editForm.maxProjects);
      if (Number(editForm.price)       !== Number(editPlan.price))    body.price       = Number(editForm.price);
      if (!Object.keys(body).length) { setEditPlan(null); return; }
      const res = await fetch(`/api/superadmin/plans/${editPlan.plan_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setEditError(data.error || 'Failed to update'); return; }
      setEditPlan(null);
      load();
    } catch { setEditError('Network error'); }
    finally { setSaving(false); }
  }

  async function handleDelete(p: Plan) {
    if (!confirm(`Delete plan "${p.plan_name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/superadmin/plans/${p.plan_id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Cannot delete plan'); return; }
      load();
    } catch { alert('Network error'); }
  }

  function openEdit(p: Plan) {
    setEditForm({ name: p.plan_name, maxUser: String(p.max_user), maxProjects: String(p.max_projects), price: String(p.price) });
    setEditError('');
    setEditPlan(p);
  }

  if (loading) return <div className="view-loading"><div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, color: 'var(--color-primary)' }} /></div>;

  return (
    <>
      <div className="card">
        <div className="card-header">
          <span className="card-title">Plans ({plans.length})</span>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => { setCreateError(''); setForm(EMPTY); setShowCreate(true); }}
          >
            + New Plan
          </button>
        </div>

        {error && <div className="alert alert-error" style={{ margin: '16px 20px 0' }}>{error}</div>}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Plan Name</th>
                <th>Max Users</th>
                <th>Max Projects</th>
                <th>Price / mo</th>
                <th>Groups Using</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className="empty-state">
                      <div className="empty-icon">💳</div>
                      <div className="empty-title">No plans yet</div>
                    </div>
                  </td>
                </tr>
              ) : plans.map(p => (
                <tr key={p.plan_id}>
                  <td style={{ fontWeight: 500 }}>{p.plan_name}</td>
                  <td>{p.max_user}</td>
                  <td>{p.max_projects}</td>
                  <td>${Number(p.price).toFixed(2)}</td>
                  <td>
                    <span className={`badge ${p.group_count > 0 ? 'badge-blue' : 'badge-gray'}`}>
                      {p.group_count} {p.group_count === 1 ? 'group' : 'groups'}
                    </span>
                  </td>
                  <td>
                    <div className="actions-cell">
                      <button className="action-btn action-btn-edit" onClick={() => openEdit(p)}>Edit</button>
                      {p.group_count === 0 && (
                        <button className="action-btn action-btn-danger" onClick={() => handleDelete(p)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create modal */}
      <Modal open={showCreate} title="Create Plan" onClose={() => setShowCreate(false)}>
        {createError && <div className="alert alert-error">{createError}</div>}
        <form onSubmit={handleCreate} noValidate>
          <div className="form-group">
            <label>Plan Name</label>
            <input
              value={form.name}
              onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              placeholder="Enterprise"
              required
              disabled={creating}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Max Users</label>
              <input
                type="number"
                min={1}
                value={form.maxUser}
                onChange={e => setForm(p => ({ ...p, maxUser: e.target.value }))}
                placeholder="100"
                required
                disabled={creating}
              />
            </div>
            <div className="form-group">
              <label>Max Projects</label>
              <input
                type="number"
                min={1}
                value={form.maxProjects}
                onChange={e => setForm(p => ({ ...p, maxProjects: e.target.value }))}
                placeholder="5"
                required
                disabled={creating}
              />
            </div>
            <div className="form-group">
              <label>Price / mo ($)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                placeholder="99.99"
                required
                disabled={creating}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)} disabled={creating}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={creating || !form.name.trim() || !form.maxUser || !form.maxProjects || form.price === ''}
            >
              {creating ? <><span className="spinner" /> Creating…</> : 'Create Plan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editPlan} title={`Edit: ${editPlan?.plan_name}`} onClose={() => setEditPlan(null)}>
        {editError && <div className="alert alert-error">{editError}</div>}
        <form onSubmit={handleEdit} noValidate>
          <div className="form-group">
            <label>Plan Name</label>
            <input
              value={editForm.name}
              onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
              required
              disabled={saving}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Max Users</label>
              <input
                type="number"
                min={1}
                value={editForm.maxUser}
                onChange={e => setEditForm(p => ({ ...p, maxUser: e.target.value }))}
                required
                disabled={saving}
              />
            </div>
            <div className="form-group">
              <label>Max Projects</label>
              <input
                type="number"
                min={1}
                value={editForm.maxProjects}
                onChange={e => setEditForm(p => ({ ...p, maxProjects: e.target.value }))}
                required
                disabled={saving}
              />
            </div>
            <div className="form-group">
              <label>Price / mo ($)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={editForm.price}
                onChange={e => setEditForm(p => ({ ...p, price: e.target.value }))}
                required
                disabled={saving}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setEditPlan(null)} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={saving || !editForm.name.trim()}
            >
              {saving ? <><span className="spinner" /> Saving…</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
