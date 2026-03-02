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
    <nav
      className={clsx(
        'fixed bottom-0 left-0 right-0 z-40 flex items-stretch',
        'bg-surface-950/95 dark:bg-surface-950/95 border-t border-surface-800/80',
        'backdrop-blur-md',
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {tabs.map(tab => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            clsx(
              'flex-1 flex flex-col items-center justify-center py-2.5 gap-1 min-w-0',
              'touch-manipulation transition-colors duration-150',
              isActive
                ? 'text-primary-400'
                : tab.highlight
                  ? 'text-indigo-400'
                  : 'text-surface-500 dark:text-surface-500'
            )
          }
        >
          {({ isActive }) => (
            <>
              {tab.highlight ? (
                <div className={clsx(
                  'w-12 h-12 -mt-6 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-200',
                  isActive
                    ? 'bg-primary-500 scale-110 shadow-primary-500/40'
                    : 'bg-indigo-600 shadow-indigo-600/30'
                )}>
                  <tab.icon size={22} className="text-white" strokeWidth={isActive ? 2.5 : 2} />
                </div>
              ) : (
                <tab.icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
              )}
              <span className={clsx(
                'text-[11px] font-medium leading-none',
                tab.highlight && !isActive ? 'mt-1' : '',
              )}>
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
    <header
      className={clsx(
        'fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4',
        'bg-surface-950/95 border-b border-surface-800/80 backdrop-blur-md',
      )}
      style={{
        height: 'calc(56px + env(safe-area-inset-top, 0px))',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-lg">
          <span className="text-white font-bold text-sm">E</span>
        </div>
        <span className="font-bold text-white text-base tracking-tight">EduGenius</span>
      </div>
      <div className="flex items-center gap-2">
        {role === 'student' && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 border border-orange-500/25 rounded-full touch-manipulation">
            <span className="text-base leading-none">🔥</span>
            <span className="text-sm font-bold text-orange-400">12</span>
          </div>
        )}
        <button onClick={toggleTheme}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-surface-800/80 border border-surface-700/60 touch-manipulation hover:bg-surface-700/80 transition-colors">
          <span className="text-base leading-none">{theme === 'dark' ? '☀️' : '🌙'}</span>
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
      <div className={clsx(
        'min-h-dvh transition-colors duration-200',
        theme === 'dark' ? 'bg-surface-950 text-white' : 'bg-gray-50 text-gray-900'
      )}>
        {/* Desktop sidebar + header (md+) */}
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
          /* Mobile: below top bar (56px), above bottom tab bar (64px + safe area) */
          'pt-[56px] pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0',
        )}>
          {/* Mobile: comfortable content padding with safe area sides */}
          <div className="p-4 md:p-6 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
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
