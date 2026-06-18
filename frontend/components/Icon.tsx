'use client';
import React from 'react';

/**
 * Clean line-style SVG icon set (Feather/Lucide-inspired).
 * Stroke-based, inherits `currentColor`, so it adapts to any theme automatically.
 * Usage: <Icon name="folder" size={18} />
 */

export type IconName =
  | 'dashboard' | 'building' | 'users' | 'user' | 'user-check'
  | 'check-square' | 'list' | 'activity' | 'flag' | 'bar-chart'
  | 'folder' | 'calendar' | 'file-text' | 'lock' | 'arrow-left'
  | 'credit-card' | 'clipboard' | 'key' | 'inbox' | 'plus'
  | 'edit' | 'trash' | 'x' | 'upload' | 'sun' | 'moon'
  | 'log-out' | 'check' | 'search' | 'note';

const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  building: <><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /></>,
  users: <><path d="M16 19v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V19" /><circle cx="9" cy="7" r="3.2" /><path d="M22 19v-1.5a4 4 0 0 0-3-3.85" /><path d="M16 4.15A4 4 0 0 1 16 11.5" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1" /></>,
  'user-check': <><circle cx="9" cy="8" r="3.4" /><path d="M3 20v-1a5 5 0 0 1 5-5h2.5a5 5 0 0 1 2 .4" /><path d="m16 17 2 2 4-4" /></>,
  'check-square': <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="m8.5 12 2.5 2.5 5-5" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1.2" /><circle cx="3.5" cy="12" r="1.2" /><circle cx="3.5" cy="18" r="1.2" /></>,
  activity: <path d="M3 12h4l3 8 4-16 3 8h4" />,
  flag: <><path d="M5 21V4" /><path d="M5 4h12l-2 3.5L17 11H5" /></>,
  'bar-chart': <><path d="M3 21h18" /><rect x="5" y="11" width="3.5" height="7" rx="1" /><rect x="10.5" y="6" width="3.5" height="12" rx="1" /><rect x="16" y="13" width="3.5" height="5" rx="1" /></>,
  folder: <path d="M3 7a2 2 0 0 1 2-2h3.5l2 2.5H19a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />,
  calendar: <><rect x="3" y="4.5" width="18" height="16" rx="2.5" /><path d="M3 9h18M8 3v3M16 3v3" /></>,
  'file-text': <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
  note: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="m9.5 14.5 1.5 1.5 3-3" /></>,
  lock: <><rect x="4.5" y="10" width="15" height="10" rx="2.5" /><path d="M8 10V7.5a4 4 0 0 1 8 0V10" /></>,
  'arrow-left': <path d="M19 12H5m6-7-7 7 7 7" />,
  'credit-card': <><rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 9.5h19M6 15h4" /></>,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><rect x="8.5" y="2.5" width="7" height="4" rx="1.3" /><path d="M9 11h6M9 15h4" /></>,
  key: <><circle cx="8" cy="14" r="4" /><path d="m10.8 11.2 8.2-8.2M16 5l2.5 2.5M14 7l2.5 2.5" /></>,
  inbox: <><path d="M3 13l2.5-7a2 2 0 0 1 1.9-1.4h9.2A2 2 0 0 1 18.5 6L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M3 13h5l1.5 2.5h5L16 13h5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" /></>,
  trash: <><path d="M3.5 6h17M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6m3 0v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6" /><path d="M10 11v5M14 11v5" /></>,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  upload: <><path d="M21 15v3a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-3" /><path d="M12 16V4m-5 5 5-5 5 5" /></>,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z" />,
  'log-out': <><path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
  check: <path d="m5 12 5 5L20 7" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
};

interface Props {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function Icon({ name, size = 18, strokeWidth = 1.75, className, style }: Props) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}
