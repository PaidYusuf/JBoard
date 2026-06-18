'use client';
import { useState } from 'react';
import DashboardLayout, { NavItem } from '@/components/DashboardLayout';
import Overview from './_views/Overview';
import Groups   from './_views/Groups';
import Plans    from './_views/Plans';
import Logs     from './_views/Logs';

type View = 'overview' | 'groups' | 'plans' | 'logs';

const NAV: NavItem[] = [
  { id: 'overview', icon: 'dashboard',   label: 'Overview'  },
  { id: 'groups',   icon: 'building',    label: 'Groups'    },
  { id: 'plans',    icon: 'credit-card', label: 'Plans'     },
  { id: 'logs',     icon: 'file-text',   label: 'Logs'      },
];

const TITLES: Record<View, string> = {
  overview: 'Overview',
  groups:   'Groups',
  plans:    'Plans',
  logs:     'Activity Logs',
};

const SUBTITLES: Record<View, string> = {
  overview: 'Platform-wide statistics at a glance',
  groups:   'Manage company and personal workspaces',
  plans:    'Define subscription plans and user limits',
  logs:     'Audit trail of all platform activity',
};

export default function SuperAdminPage() {
  const [view, setView] = useState<View>('overview');

  return (
    <DashboardLayout
      nav={NAV}
      activeView={view}
      onNavigate={id => setView(id as View)}
      allowedRoles={['superadmin']}
    >
      <header className="page-header">
        <div>
          <div className="page-title">{TITLES[view]}</div>
          <div className="page-subtitle">{SUBTITLES[view]}</div>
        </div>
      </header>

      <div className="page-body">
        {view === 'overview' && <Overview />}
        {view === 'groups'   && <Groups />}
        {view === 'plans'    && <Plans />}
        {view === 'logs'     && <Logs />}
      </div>
    </DashboardLayout>
  );
}
