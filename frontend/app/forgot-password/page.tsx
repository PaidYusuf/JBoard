'use client';
import { useState, FormEvent } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Request failed');
        return;
      }
      setSent(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-mark">J</div>
          <span className="auth-logo-text">JBoard</span>
        </div>

        {sent ? (
          <>
            <h1 className="auth-title">Check your email</h1>
            <p className="auth-subtitle" style={{ marginBottom: 28 }}>
              If an account exists for <strong>{email}</strong>, a password reset link has been sent.
            </p>
            <Link href="/login" className="btn btn-primary" style={{ display: 'flex' }}>
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="auth-title">Forgot password?</h1>
            <p className="auth-subtitle">Enter your email and we&apos;ll send a reset link.</p>

            {error && <div className="alert alert-error">{error}</div>}

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  disabled={submitting}
                  required
                  autoComplete="email"
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={submitting || !email.trim()}>
                {submitting ? <><span className="spinner" />Sending…</> : 'Send reset link'}
              </button>
            </form>

            <div className="auth-footer">
              <Link href="/login">← Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
