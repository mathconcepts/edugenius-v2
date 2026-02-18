import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import FeedbackWidget from '@/components/FeedbackWidget';
import { useAppStore } from '@/stores/appStore';
import { clsx } from 'clsx';

export function Layout() {
  const { sidebarOpen, theme } = useAppStore();

  // Apply dark/light class to <html> so Tailwind darkMode: 'class' works
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  return (
    <div className={clsx('min-h-screen transition-colors duration-200', theme === 'dark' ? 'bg-surface-950 text-white' : 'bg-gray-50 text-gray-900')}>
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
      <FeedbackWidget />
    </div>
  );
}
