'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role === 'superadmin') router.replace('/superadmin');
    else if (user.role === 'admin') router.replace('/admin');
    else router.replace('/user');
  }, [user, loading, router]);

  return (
    <div className="page-loading">
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, color: 'var(--color-primary)' }} />
    </div>
  );
}
