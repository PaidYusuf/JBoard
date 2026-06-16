'use client';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import Modal from '@/components/Modal';

interface Member {
  user_id: number;
  fname: string;
  lname: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

interface InviteCode {
  code_id: number;
  is_used: boolean;
  expires_at: string;
  created_at: string;
  created_by_fname: string;
  created_by_lname: string;
  used_by_email: string | null;
  status: 'active' | 'expired' | 'used';
}

interface GeneratedCode { code: string; expiresAt: string; }

const CODE_BADGE: Record<string, string> = {
  active:  'badge-green',
  expired: 'badge-gray',
  used:    'badge-blue',
};

export default function Members() {
  const { user: me } = useAuth();
  const [members,     setMembers]     = useState<Member[]>([]);
  const [codes,       setCodes]       = useState<InviteCode[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [generating,  setGenerating]  = useState(false);
  const [shownCode,   setShownCode]   = useState<GeneratedCode | null>(null);
  const [copied,      setCopied]      = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, cRes] = await Promise.all([
        fetch('/api/admin/members',      { credentials: 'include' }),
        fetch('/api/admin/invite-codes', { credentials: 'include' }),
      ]);
      setMembers(await mRes.json());
      setCodes(await cRes.json());
    } catch { setError('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleRemove(m: Member) {
    if (!confirm(`Remove ${m.fname} ${m.lname} from the group?\n\nThis will deactivate their account immediately.`)) return;
    try {
      const res = await fetch(`/api/admin/members/${m.user_id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to remove member'); return; }
      load();
    } catch { alert('Network error'); }
  }

  async function generateCode() {
    setGenerating(true);
    try {
      const res = await fetch('/api/admin/invite-codes', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to generate code'); return; }
      setShownCode({ code: data.code, expiresAt: data.expiresAt });
      setCopied(false);
      load();
    } catch { alert('Network error'); }
    finally { setGenerating(false); }
  }

  function handleCopy() {
    if (!shownCode) return;
    navigator.clipboard.writeText(shownCode.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) return <div className="view-loading"><div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, color: 'var(--color-primary)' }} /></div>;

  return (
    <>
      {error && <div className="alert alert-error">{error}</div>}

      {/* Members table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Team Members ({members.length})</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className="empty-state">
                    <div className="empty-icon">👥</div>
                    <div className="empty-title">No members yet</div>
                    <div>Generate an invite code to add your first team member.</div>
                  </div>
                </td></tr>
              ) : members.map(m => (
                <tr key={m.user_id}>
                  <td style={{ fontWeight: 500 }}>
                    {m.fname} {m.lname}
                    {m.user_id === me?.userId && (
                      <span className="badge badge-purple" style={{ marginLeft: 8, fontSize: 11 }}>You</span>
                    )}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{m.email}</td>
                  <td><span className={`badge ${m.role === 'admin' ? 'badge-purple' : 'badge-gray'}`}>{m.role}</span></td>
                  <td>
                    <span className={`badge ${m.is_active ? 'badge-green' : 'badge-red'}`}>
                      {m.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {new Date(m.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    {m.user_id !== me?.userId && (
                      <button className="action-btn action-btn-danger" onClick={() => handleRemove(m)}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite codes */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Invite Codes ({codes.length})</span>
          <button className="btn btn-primary btn-sm" onClick={generateCode} disabled={generating}>
            {generating ? <><span className="spinner" /> Generating…</> : '+ Generate Code'}
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Created By</th>
                <th>Created</th>
                <th>Expires</th>
                <th>Used By</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr><td colSpan={5}>
                  <div className="empty-state">
                    <div className="empty-icon">🔑</div>
                    <div className="empty-title">No invite codes yet</div>
                    <div>Generate a code to invite team members.</div>
                  </div>
                </td></tr>
              ) : codes.map(c => (
                <tr key={c.code_id}>
                  <td><span className={`badge ${CODE_BADGE[c.status]}`}>{c.status}</span></td>
                  <td style={{ fontSize: 13 }}>{c.created_by_fname} {c.created_by_lname}</td>
                  <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {new Date(c.created_at).toLocaleString()}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {new Date(c.expires_at).toLocaleString()}
                  </td>
                  <td style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    {c.used_by_email ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reveal modal — shown once after generation */}
      <Modal open={!!shownCode} title="Invite Code Generated" onClose={() => setShownCode(null)}>
        <div className="alert alert-success" style={{ marginBottom: 12 }}>
          Share this code with your team member. It can only be shown once.
        </div>
        <div className="code-box">{shownCode?.code}</div>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
          Expires: {shownCode?.expiresAt && new Date(shownCode.expiresAt).toLocaleString()}
        </p>
        <div className="modal-actions" style={{ justifyContent: 'stretch' }}>
          <button
            className="btn btn-secondary"
            style={{ flex: 1 }}
            onClick={handleCopy}
          >
            {copied ? '✓ Copied!' : 'Copy to Clipboard'}
          </button>
          <button
            className="btn btn-primary btn-sm"
            style={{ flex: 1 }}
            onClick={() => setShownCode(null)}
          >
            Done
          </button>
        </div>
      </Modal>
    </>
  );
}
