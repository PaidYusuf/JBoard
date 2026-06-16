'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, AuthUser } from '@/context/AuthContext';

interface Props {
  children: React.ReactNode;
  allowedRoles?: AuthUser['role'][];
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      // Redirect to their own dashboard if hitting a role they can't access
      if (user.role === 'superadmin') router.replace('/superadmin');
      else if (user.role === 'admin') router.replace('/admin');
      else router.replace('/user');
    }
  }, [user, loading, router, allowedRoles]);

  if (loading || !user) {
    return (
      <div className="page-loading">
        <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, color: 'var(--color-primary)' }} />
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
