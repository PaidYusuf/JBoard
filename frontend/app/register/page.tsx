'use client';
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';

type AccountType = 'company' | 'solo';

// Company flow has two steps: validate invite code → fill details
type Step = 'invite' | 'details';

export default function RegisterPage() {
  const router = useRouter();
  const [accountType, setAccountType] = useState<AccountType>('company');
  const [step, setStep] = useState<Step>('invite');

  // Invite code step state
  const [inviteCode, setInviteCode] = useState('');
  const [validatingCode, setValidatingCode] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [confirmedGroup, setConfirmedGroup] = useState('');

  // Details step state
  const [fname, setFname] = useState('');
  const [lname, setLname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState(false);

  function switchType(type: AccountType) {
    setAccountType(type);
    setStep('invite');
    setCodeError('');
    setFormError('');
    setConfirmedGroup('');
    setInviteCode('');
  }

  async function handleValidateCode(e: FormEvent) {
    e.preventDefault();
    setCodeError('');
    setValidatingCode(true);
    try {
      const res = await fetch('/api/auth/validate-invite-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: inviteCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCodeError(data.error || 'Invalid invite code');
        return;
      }
      setConfirmedGroup(data.groupName);
      setStep('details');
    } catch {
      setCodeError('Network error. Please try again.');
    } finally {
      setValidatingCode(false);
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault();
    setFormError('');

    if (password.length < 8) {
      setFormError('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, string> = { fname, lname, email, password };
      if (accountType === 'company') body.inviteCode = inviteCode;

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Registration failed');
        return;
      }
      setSuccess(true);
    } catch {
      setFormError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-logo" style={{ justifyContent: 'center' }}>
            <div className="auth-logo-mark">J</div>
            <span className="auth-logo-text">JBoard</span>
          </div>
          <div style={{
            width: 60, height: 60, margin: '0 auto 16px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-success-bg)', color: 'var(--color-success)',
          }}>
            <Icon name="check" size={30} strokeWidth={2.5} />
          </div>
          <h1 className="auth-title" style={{ marginBottom: 8 }}>Account created!</h1>
          <p className="auth-subtitle" style={{ marginBottom: 28 }}>
            Your account has been set up successfully. Sign in to get started.
          </p>
          <button className="btn btn-primary" onClick={() => router.push('/login')}>
            Go to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">J</div>
          <span className="auth-logo-text">JBoard</span>
        </div>

        <h1 className="auth-title">Create an account</h1>
        <p className="auth-subtitle">Choose how you&apos;d like to get started</p>

        {/* Account type tabs */}
        <div className="tab-group">
          <button
            className={`tab-btn${accountType === 'company' ? ' active' : ''}`}
            onClick={() => switchType('company')}
          >
            Company
          </button>
          <button
            className={`tab-btn${accountType === 'solo' ? ' active' : ''}`}
            onClick={() => switchType('solo')}
          >
            Solo
          </button>
        </div>

        {/* ── Company flow ── */}
        {accountType === 'company' && step === 'invite' && (
          <>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 20 }}>
              Ask your admin for an invite code to join your company workspace.
            </p>
            {codeError && <div className="alert alert-error">{codeError}</div>}
            <form onSubmit={handleValidateCode} noValidate>
              <div className="form-group">
                <label htmlFor="inviteCode">Invite code</label>
                <input
                  id="inviteCode"
                  type="text"
                  placeholder="Enter your invite code"
                  value={inviteCode}
                  onChange={e => setInviteCode(e.target.value)}
                  disabled={validatingCode}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={validatingCode || !inviteCode.trim()}>
                {validatingCode ? <><span className="spinner" />Validating…</> : 'Continue'}
              </button>
            </form>
          </>
        )}

        {accountType === 'company' && step === 'details' && (
          <>
            <button className="back-link" onClick={() => { setStep('invite'); setConfirmedGroup(''); }}>
              ← Back
            </button>

            <div className="info-box" style={{ marginBottom: 20 }}>
              <div className="info-box-label">Joining workspace</div>
              <div className="info-box-value">{confirmedGroup}</div>
            </div>

            {formError && <div className="alert alert-error">{formError}</div>}
            <form onSubmit={handleRegister} noValidate>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="fname">First name</label>
                  <input id="fname" type="text" value={fname} onChange={e => setFname(e.target.value)}
                    placeholder="Jane" disabled={submitting} required />
                </div>
                <div className="form-group">
                  <label htmlFor="lname">Last name</label>
                  <input id="lname" type="text" value={lname} onChange={e => setLname(e.target.value)}
                    placeholder="Doe" disabled={submitting} required />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="email">Work email</label>
                <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="jane@company.com" disabled={submitting} required autoComplete="email" />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters" disabled={submitting} required autoComplete="new-password" />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? <><span className="spinner" />Creating account…</> : 'Create account'}
              </button>
            </form>
          </>
        )}

        {/* ── Solo flow ── */}
        {accountType === 'solo' && (
          <>
            <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 20 }}>
              Create a personal workspace and manage your own tasks.
            </p>
            {formError && <div className="alert alert-error">{formError}</div>}
            <form onSubmit={handleRegister} noValidate>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="fname-solo">First name</label>
                  <input id="fname-solo" type="text" value={fname} onChange={e => setFname(e.target.value)}
                    placeholder="Jane" disabled={submitting} required />
                </div>
                <div className="form-group">
                  <label htmlFor="lname-solo">Last name</label>
                  <input id="lname-solo" type="text" value={lname} onChange={e => setLname(e.target.value)}
                    placeholder="Doe" disabled={submitting} required />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="email-solo">Email address</label>
                <input id="email-solo" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com" disabled={submitting} required autoComplete="email" />
              </div>
              <div className="form-group">
                <label htmlFor="password-solo">Password</label>
                <input id="password-solo" type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters" disabled={submitting} required autoComplete="new-password" />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? <><span className="spinner" />Creating account…</> : 'Create account'}
              </button>
            </form>
          </>
        )}

        <div className="auth-footer">
          Already have an account?{' '}
          <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
