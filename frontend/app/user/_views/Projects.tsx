'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Project {
  project_id: number;
  project_name: string;
  start_date: string;
  end_date: string;
}

function today() { return new Date().toISOString().slice(0, 10); }

function statusOf(p: Project) {
  const t = today();
  if (t < p.start_date.slice(0, 10)) return { label: 'Upcoming', cls: 'badge-gray' };
  if (t > p.end_date.slice(0, 10))   return { label: 'Ended',    cls: 'badge-gray' };
  return { label: 'Active', cls: 'badge-green' };
}

export default function Projects() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch('/api/user/projects', { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Failed to load projects'); return; }
        setProjects(data);
      } catch { setError('Failed to load projects'); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return (
    <div className="view-loading">
      <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, color: 'var(--color-primary)' }} />
    </div>
  );

  if (error) return (
    <div className="card" style={{ padding: 20 }}>
      <div className="alert alert-error">{error}</div>
    </div>
  );

  if (projects.length === 0) return (
    <div className="card" style={{ padding: 20 }}>
      <div className="empty-state">
        <div className="empty-icon">📁</div>
        <div className="empty-title">No projects yet</div>
        <div>Ask your admin to create a project and add you as a member.</div>
      </div>
    </div>
  );

  return (
    <>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
        {projects.length} {projects.length === 1 ? 'project' : 'projects'} — click one to open
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {projects.map(p => {
          const status = statusOf(p);
          return (
            <div
              key={p.project_id}
              className="card"
              style={{ padding: '20px', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
              onClick={() => router.push(`/user/projects/${p.project_id}`)}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 16, flex: 1, marginRight: 8 }}>{p.project_name}</div>
                <span className={`badge ${status.cls}`}>{status.label}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                {p.start_date.slice(0, 10)} → {p.end_date.slice(0, 10)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
