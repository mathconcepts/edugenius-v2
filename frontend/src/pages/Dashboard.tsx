import { useAppStore } from '@/stores/appStore';
import { CEODashboard } from './dashboards/CEODashboard';
import { AdminDashboard } from './dashboards/AdminDashboard';
import { TeacherDashboard } from './dashboards/TeacherDashboard';
import { StudentDashboard } from './dashboards/StudentDashboard';

// Map each role to its dashboard — key prop forces full remount on role change
const dashboards = {
  ceo:     <CEODashboard />,
  admin:   <AdminDashboard />,
  teacher: <TeacherDashboard />,
  student: <StudentDashboard />,
};

export function Dashboard() {
  const userRole = useAppStore((s) => s.userRole);
  // Use key= so React fully unmounts/remounts when role changes — eliminates stale UI
  return (
    <div key={userRole}>
      {dashboards[userRole] ?? <CEODashboard />}
    </div>
  );
}
