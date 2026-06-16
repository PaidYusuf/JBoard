'use client';
import { useState } from 'react';
import DashboardLayout, { NavItem } from '@/components/DashboardLayout';
import Tasks      from './_views/Tasks';
import Gantt      from './_views/Gantt';
import Statistics from './_views/Statistics';
import Members    from './_views/Members';
import Projects   from './_views/Projects';

type View = 'tasks' | 'gantt' | 'statistics' | 'members' | 'projects';

const NAV: NavItem[] = [
  { id: 'tasks',      icon: '📋', label: 'Tasks'      },
  { id: 'gantt',      icon: '📅', label: 'Gantt'      },
  { id: 'statistics', icon: '📊', label: 'Statistics' },
  { id: 'members',    icon: '👥', label: 'Members'    },
  { id: 'projects',   icon: '📁', label: 'Projects'   },
];

const TITLES: Record<View, string> = {
  tasks:      'Tasks',
  gantt:      'Gantt Chart',
  statistics: 'Statistics',
  members:    'Members & Invites',
  projects:   'Projects',
};

const SUBTITLES: Record<View, string> = {
  tasks:      'Create, assign and manage tasks for your team',
  gantt:      'Visual timeline of all tasks in your group',
  statistics: 'Per-member task completion breakdown',
  members:    'Manage team members and generate invite codes',
  projects:   'Manage projects, assign members, and review daily logs',
};

export default function AdminPage() {
  const [view, setView] = useState<View>('tasks');

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
        {view === 'tasks'      && <Tasks />}
        {view === 'gantt'      && <Gantt />}
        {view === 'statistics' && <Statistics />}
        {view === 'members'    && <Members />}
        {view === 'projects'   && <Projects />}
      </div>
    </DashboardLayout>
  );
}
