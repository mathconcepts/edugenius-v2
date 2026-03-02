import { useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import FeedbackWidget from '@/components/FeedbackWidget';
import { useAppStore } from '@/stores/appStore';
import { clsx } from 'clsx';
import {
  Home, MessageSquare, GraduationCap, BarChart3,
  BookMarked, Users, TrendingUp, BookOpen,
} from 'lucide-react';

// ── Mobile bottom tab bar (student + teacher only) ────────────────────────

const STUDENT_TABS = [
  { to: '/',        icon: Home,          label: 'Home',    end: true },
  { to: '/learn',   icon: GraduationCap, label: 'Study' },
  { to: '/chat',    icon: MessageSquare, label: 'Tutor',   highlight: true },
  { to: '/notebook',icon: BookMarked,    label: 'Notes' },
  { to: '/progress',icon: BarChart3,     label: 'Progress' },
];

const TEACHER_TABS = [
  { to: '/',              icon: Home,       label: 'Home',    end: true },
  { to: '/students',      icon: Users,      label: 'Students' },
  { to: '/chat',          icon: MessageSquare, label: 'AI Chat', highlight: true },
  { to: '/exam-analytics',icon: TrendingUp, label: 'Stats' },
  { to: '/content',       icon: BookOpen,   label: 'Lessons' },
];

function MobileTabBar({ role }: { role: 'student' | 'teacher' }) {
  const tabs = role === 'student' ? STUDENT_TABS : TEACHER_TABS;
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-stretch safe-area-pb">
      {tabs.map(tab => (
        <NavLink key={tab.to} to={tab.to} end={tab.end}
          className={({ isActive }) =>
            clsx('flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-w-0 transition-colors',
              isActive
                ? 'text-blue-600 dark:text-blue-400'
                : tab.highlight
                  ? 'text-indigo-500 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-400'
            )
          }>
          {({ isActive }) => (
            <>
              {tab.highlight ? (
                <div className={clsx('w-12 h-12 -mt-6 rounded-full flex items-center justify-center shadow-lg transition-all',
                  isActive ? 'bg-blue-600 scale-110' : 'bg-indigo-600')}>
                  <tab.icon size={22} className="text-white" />
                </div>
              ) : (
                <tab.icon size={22} className={isActive ? 'stroke-[2.5]' : 'stroke-2'} />
              )}
              <span className={clsx('text-[10px] font-medium', tab.highlight && !isActive ? 'mt-1' : '')}>
                {tab.label}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

// ── Mobile top bar (student + teacher, replaces Header) ───────────────────

function MobileTopBar({ role }: { role: 'student' | 'teacher' }) {
  const { theme, toggleTheme } = useAppStore();
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
          E
        </div>
        <span className="font-semibold text-gray-900 dark:text-white text-sm">EduGenius</span>
      </div>
      <div className="flex items-center gap-2">
        {role === 'student' && (
          <div className="flex items-center gap-1 px-2 py-1 bg-orange-50 dark:bg-orange-900/20 rounded-full">
            <span className="text-sm">🔥</span>
            <span className="text-xs font-bold text-orange-600 dark:text-orange-400">12</span>
          </div>
        )}
        <button onClick={toggleTheme}
          className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
          <span className="text-base">{theme === 'dark' ? '☀️' : '🌙'}</span>
        </button>
      </div>
    </header>
  );
}

// ── Main Layout ───────────────────────────────────────────────────────────

export function Layout() {
  const { sidebarOpen, theme, userRole } = useAppStore();
  const isMobileRole = userRole === 'student' || userRole === 'teacher';

  // Apply dark/light class to <html> so Tailwind darkMode: 'class' works
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // ── MOBILE LAYOUT (student/teacher on small screens) ──────────────────
  if (isMobileRole) {
    return (
      <div className={clsx('min-h-screen transition-colors duration-200',
        theme === 'dark' ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900')}>
        {/* Desktop sidebar (md+) */}
        <div className="hidden md:block">
          <Sidebar />
          <Header />
        </div>
        {/* Mobile top bar (< md) */}
        <div className="block md:hidden">
          <MobileTopBar role={userRole as 'student' | 'teacher'} />
        </div>
        {/* Content */}
        <main className={clsx(
          /* Desktop: sidebar offset */
          'md:pt-16 md:transition-all',
          sidebarOpen ? 'md:pl-[240px]' : 'md:pl-[56px]',
          /* Mobile: top bar + bottom tab bar */
          'pt-14 pb-20 md:pb-0',
        )}>
          <div className="p-4 md:p-6">
            <Outlet />
          </div>
        </main>
        {/* Mobile bottom tab (< md) */}
        <div className="block md:hidden">
          <MobileTabBar role={userRole as 'student' | 'teacher'} />
        </div>
        <FeedbackWidget />
      </div>
    );
  }

  // ── DESKTOP LAYOUT (CEO / Admin / Manager) ────────────────────────────
  return (
    <div className={clsx('min-h-screen transition-colors duration-200',
      theme === 'dark' ? 'bg-surface-950 text-white' : 'bg-gray-50 text-gray-900')}>
      <Sidebar />
      <Header />
      <main className={clsx('pt-16 min-h-screen transition-all',
        sidebarOpen ? 'pl-[240px]' : 'pl-[56px]')}>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
      <FeedbackWidget />
    </div>
  );
}
