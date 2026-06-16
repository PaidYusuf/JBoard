'use client';
import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import Tasks    from './_views/Tasks';
import Gantt    from './_views/Gantt';
import Projects from './_views/Projects';

type View = 'tasks' | 'gantt' | 'projects';

const NAV = [
  { id: 'tasks',    label: 'My Tasks',    icon: '✅' },
  { id: 'gantt',    label: 'My Gantt',    icon: '📅' },
  { id: 'projects', label: 'Projects',    icon: '📁' },
];

const TITLES: Record<View, string>    = { tasks: 'My Tasks', gantt: 'My Gantt Chart', projects: 'My Projects' };
const SUBTITLES: Record<View, string> = {
  tasks:    'Tasks assigned to you — click any row to update status, write a report, or attach files.',
  gantt:    'Visual timeline of your assigned tasks.',
  projects: 'Write your daily log for each project you are part of.',
};

export default function UserDashboard() {
  const [activeView, setActiveView] = useState<View>('tasks');

  return (
    <DashboardLayout
      nav={NAV}
      activeView={activeView}
      onNavigate={id => setActiveView(id as View)}
      allowedRoles={['user', 'admin', 'superadmin']}
    >
      <div className="page-header">
        <div>
          <h1 className="page-title">{TITLES[activeView]}</h1>
          <p className="page-subtitle">{SUBTITLES[activeView]}</p>
        </div>
      </div>

      <div className="page-body">
        {activeView === 'tasks'    && <Tasks />}
        {activeView === 'gantt'    && <Gantt />}
        {activeView === 'projects' && <Projects />}
      </div>
    </DashboardLayout>
  );
}
