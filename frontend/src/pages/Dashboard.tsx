import { lazy, Suspense } from 'react';
import { useAppStore } from '@/stores/appStore';
import type { UserRole } from '@/types';

// Lazy-load role dashboards — they're large and only one is ever shown at a time
const CEODashboard     = lazy(() => import('./dashboards/CEODashboard').then(m => ({ default: m.CEODashboard })));
const AdminDashboard   = lazy(() => import('./dashboards/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const TeacherDashboard = lazy(() => import('./dashboards/TeacherDashboard').then(m => ({ default: m.TeacherDashboard })));
const StudentDashboard = lazy(() => import('./dashboards/StudentDashboard').then(m => ({ default: m.StudentDashboard })));

function RoleDashboard({ role }: { role: UserRole }) {
  switch (role) {
    case 'admin':   return <AdminDashboard />;
    case 'teacher': return <TeacherDashboard />;
    case 'student': return <StudentDashboard />;
    default:        return <CEODashboard />;
  }
}

export function Dashboard() {
  const userRole = useAppStore((s) => s.userRole);
  // key= forces full remount when role changes — eliminates stale UI
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64 text-surface-400">Loading dashboard…</div>}>
      <div key={userRole}>
        <RoleDashboard role={userRole} />
      </div>
    </Suspense>
  );
}
