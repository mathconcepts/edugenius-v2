import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppStore } from '@/stores/appStore';
import { clsx } from 'clsx';

export function Layout() {
  const { sidebarOpen } = useAppStore();

  return (
    <div className="min-h-screen bg-surface-950">
      <Sidebar />
      <Header />
      <main
        className={clsx(
          'pt-16 min-h-screen transition-all',
          sidebarOpen ? 'pl-[260px]' : 'pl-[72px]'
        )}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
