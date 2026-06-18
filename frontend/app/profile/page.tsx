'use client';
import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';

const NAV = [
  { id: 'back',     icon: '←',  label: 'Back'          },
  { id: 'profile',  icon: '👤', label: 'My Profile'    },
  { id: 'password', icon: '🔒', label: 'Change Password'},
];

type Tab = 'profile' | 'password';

export default function ProfilePage() {
  const { user: authUser, refetch } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('profile');

  // ── Profile form ──────────────────────────────────────────────────────────
  const [fname,         setFname]         = useState('');
  const [lname,         setLname]         = useState('');
  const [email,         setEmail]         = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved,  setProfileSaved]  = useState(false);
  const [profileError,  setProfileError]  = useState('');

  // ── Password form ─────────────────────────────────────────────────────────
  const [currentPw,  setCurrentPw]  = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [pwSaving,   setPwSaving]   = useState(false);
  const [pwSaved,    setPwSaved]    = useState(false);
  const [pwError,    setPwError]    = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch('/api/user/profile', { credentials: 'include' });
        const data = await res.json();
        if (res.ok) { setFname(data.fname); setLname(data.lname); setEmail(data.email); }
      } catch { /* ignore */ }
    })();
  }, []);

  function backUrl() {
    if (!authUser) return '/';
    if (authUser.role === 'superadmin') return '/superadmin';
    if (authUser.role === 'admin')      return '/admin';
    return '/user';
  }

  function handleNav(id: string) {
    if (id === 'back') { router.push(backUrl()); return; }
    setTab(id as Tab);
    setProfileSaved(false);
    setPwSaved(false);
    setProfileError('');
    setPwError('');
  }

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    setProfileError('');
    setProfileSaving(true);
    setProfileSaved(false);
    try {
      const res  = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fname: fname.trim(), lname: lname.trim(), email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setProfileError(data.error || 'Failed to update profile'); return; }
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
      await refetch();
    } catch { setProfileError('Network error'); }
    finally { setProfileSaving(false); }
  }

  async function handlePasswordSave(e: FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwSaved(false);
    if (newPw !== confirmPw) { setPwError('New passwords do not match'); return; }
    if (newPw.length < 8)    { setPwError('New password must be at least 8 characters'); return; }
    setPwSaving(true);
    try {
      const res  = await fetch('/api/user/profile/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setPwError(data.error || 'Failed to change password'); return; }
      setPwSaved(true);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => setPwSaved(false), 3000);
    } catch { setPwError('Network error'); }
    finally { setPwSaving(false); }
  }

  return (
    <DashboardLayout nav={NAV} activeView={tab} onNavigate={handleNav} allowedRoles={['user', 'admin', 'superadmin']}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Manage your account information and password</p>
        </div>
      </div>

      <div className="page-body" style={{ maxWidth: 560 }}>

        {/* ── PROFILE tab ──────────────────────────────────────────────── */}
        {tab === 'profile' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Personal Information</span>
            </div>
            <div style={{ padding: '0 20px 24px' }}>
              {profileError && <div className="alert alert-error" style={{ marginBottom: 14 }}>{profileError}</div>}
              <form onSubmit={handleProfileSave} noValidate>
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input value={fname} onChange={e => setFname(e.target.value)} required disabled={profileSaving} />
                  </div>
                  <div className="form-group">
                    <label>Last Name</label>
                    <input value={lname} onChange={e => setLname(e.target.value)} required disabled={profileSaving} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={profileSaving} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                  <button type="submit" className="btn btn-primary btn-sm"
                    disabled={profileSaving || !fname.trim() || !lname.trim() || !email.trim()}>
                    {profileSaving ? <><span className="spinner" /> Saving…</> : 'Save Changes'}
                  </button>
                  {profileSaved && <span style={{ fontSize: 13, color: 'var(--color-success)' }}>✓ Profile updated</span>}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── PASSWORD tab ─────────────────────────────────────────────── */}
        {tab === 'password' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">Change Password</span>
            </div>
            <div style={{ padding: '0 20px 24px' }}>
              {pwError  && <div className="alert alert-error"   style={{ marginBottom: 14 }}>{pwError}</div>}
              {pwSaved  && <div className="alert alert-success" style={{ marginBottom: 14 }}>✓ Password changed successfully</div>}
              <form onSubmit={handlePasswordSave} noValidate>
                <div className="form-group">
                  <label>Current Password</label>
                  <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} required disabled={pwSaving} autoComplete="current-password" />
                </div>
                <div className="form-group">
                  <label>New Password</label>
                  <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} required disabled={pwSaving} minLength={8} placeholder="Min. 8 characters" autoComplete="new-password" />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required disabled={pwSaving} autoComplete="new-password" />
                </div>
                <button type="submit" className="btn btn-primary btn-sm"
                  disabled={pwSaving || !currentPw || !newPw || !confirmPw}>
                  {pwSaving ? <><span className="spinner" /> Updating…</> : 'Update Password'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
