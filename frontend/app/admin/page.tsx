'use client';
import { useState } from 'react';
import DashboardLayout, { NavItem } from '@/components/DashboardLayout';
import Gantt      from './_views/Gantt';
import Statistics from './_views/Statistics';
import Members    from './_views/Members';
import Projects   from './_views/Projects';

type View = 'projects' | 'gantt' | 'statistics' | 'members';

const NAV: NavItem[] = [
  { id: 'projects',   icon: 'folder',    label: 'Projects'   },
  { id: 'gantt',      icon: 'calendar',  label: 'Gantt'      },
  { id: 'statistics', icon: 'bar-chart', label: 'Statistics' },
  { id: 'members',    icon: 'users',     label: 'Members'    },
];

const TITLES: Record<View, string> = {
  projects:   'Projects',
  gantt:      'Gantt Chart',
  statistics: 'Statistics',
  members:    'Members & Invites',
};

const SUBTITLES: Record<View, string> = {
  projects:   'Create projects, assign members, and manage tasks inside each project',
  gantt:      'Visual timeline of all tasks across all projects',
  statistics: 'Per-member task completion breakdown',
  members:    'Manage team members and generate invite codes',
};

export default function AdminPage() {
  const [view, setView] = useState<View>('projects');

  return (
    <DashboardLayout
      nav={NAV}
      activeView={view}
      onNavigate={id => setView(id as View)}
      allowedRoles={['admin', 'superadmin']}
    >
      <header className="page-header">
        <div>
          <div className="page-title">{TITLES[view]}</div>
          <div className="page-subtitle">{SUBTITLES[view]}</div>
        </div>
      </header>

      <div className="page-body">
        {view === 'projects'   && <Projects />}
        {view === 'gantt'      && <Gantt />}
        {view === 'statistics' && <Statistics />}
        {view === 'members'    && <Members />}
      </div>
    </DashboardLayout>
  );
}
