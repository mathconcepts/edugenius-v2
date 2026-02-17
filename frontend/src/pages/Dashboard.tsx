import { useAppStore } from '@/stores/appStore';
import { CEODashboard } from './dashboards/CEODashboard';
import { AdminDashboard } from './dashboards/AdminDashboard';
import { TeacherDashboard } from './dashboards/TeacherDashboard';
import { StudentDashboard } from './dashboards/StudentDashboard';

export function Dashboard() {
  const { playgroundConfig } = useAppStore();

  switch (playgroundConfig.role) {
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
