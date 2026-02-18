import { useAppStore } from '@/stores/appStore';
import { CEODashboard } from './dashboards/CEODashboard';
import { AdminDashboard } from './dashboards/AdminDashboard';
import { TeacherDashboard } from './dashboards/TeacherDashboard';
import { StudentDashboard } from './dashboards/StudentDashboard';

export function Dashboard() {
  // userRole is the single source of truth — set via setUserRole(), persisted in localStorage
  const { userRole } = useAppStore();

  switch (userRole) {
    case 'ceo':
      return <CEODashboard />;
    case 'admin':
      return <AdminDashboard />;
    case 'teacher':
      return <TeacherDashboard />;
    case 'student':
      return <StudentDashboard />;
    default:
      return <CEODashboard />;
  }
}
