import { useEffect, useState } from 'react';
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
                ? 'text-emerald-400'
                : tab.highlight
                  ? 'text-emerald-400'
                  : 'text-surface-500 dark:text-surface-500'
            )
          }
        >
          {({ isActive }) => (
            <>
              {/* Warm pill indicator above active tab icon */}
              {!tab.highlight && (
                <div className={clsx(
                  'h-[2px] rounded-full mb-0.5 transition-all duration-200',
                  isActive ? 'w-5 bg-gradient-to-r from-amber-400 to-emerald-400' : 'w-0 bg-transparent'
                )} />
              )}
              {tab.highlight ? (
                <div className={clsx(
                  'w-12 h-12 -mt-6 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-200',
                  isActive
                    ? 'bg-gradient-to-br from-emerald-500 to-sky-500 scale-110 shadow-emerald-500/40'
                    : 'bg-gradient-to-br from-emerald-600 to-sky-600 shadow-emerald-700/30'
                )}>
                  <tab.icon size={22} className="text-white" strokeWidth={isActive ? 2.5 : 2} />
                </div>
              ) : (
                <tab.icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
              )}
              <span className={clsx(
                'text-[11px] font-medium leading-none',
                isActive ? 'text-emerald-400' : '',
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
  const { theme, toggleTheme, userRole, setUserRole } = useAppStore();
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  // Read streak from localStorage (kept in sync by StudentDashboard)
  const streak = (() => {
    try { return parseInt(localStorage.getItem('edugenius_streak') ?? '0', 10) || 0; } catch { return 0; }
  })();

  // Read exam + days from persona if available (graceful fallback)
  const examChip = (() => {
    try {
      const raw = localStorage.getItem('edugenius_student_persona');
      if (!raw) return null;
      const p = JSON.parse(raw) as { exam?: string; daysToExam?: number };
      const labels: Record<string, string> = {
        JEE_MAIN: 'JEE', JEE_ADVANCED: 'JEE Adv', NEET: 'NEET',
        CBSE_12: 'CBSE', CAT: 'CAT', UPSC: 'UPSC', GATE: 'GATE',
      };
      const name = (p.exam && labels[p.exam]) ?? 'Exam';
      const days = p.daysToExam ?? null;
      return days !== null ? `${name} · ${days}d` : name;
    } catch { return null; }
  })();

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
      {/* Logo mark — emerald → sky gradient */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
          <span className="text-white font-black text-sm">E</span>
        </div>
        <span className="font-bold text-white text-base tracking-tight">EduGenius</span>
      </div>

      <div className="flex items-center gap-2">
        {/* Exam countdown chip */}
        {role === 'student' && examChip && (
          <div className="flex items-center px-2.5 py-1 bg-sky-500/10 border border-sky-500/25 rounded-full">
            <span className="text-xs font-semibold text-sky-300">{examChip}</span>
          </div>
        )}

        {/* Streak pill — amber, prominent */}
        {role === 'student' && streak > 0 && (
          <div className="streak-badge touch-manipulation">
            <span className="text-sm leading-none">🔥</span>
            <span>{streak}</span>
          </div>
        )}

        {/* Role switcher — tap avatar to switch roles */}
        <div className="relative">
          <button
            onClick={() => setShowRoleMenu(v => !v)}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center touch-manipulation border-2 border-surface-700"
            title="Switch role"
          >
            <span className="text-sm leading-none">
              {userRole === 'ceo' ? '👔' : userRole === 'teacher' ? '🎓' : userRole === 'admin' ? '🛡️' : userRole === 'manager' ? '📊' : '📚'}
            </span>
          </button>
          {showRoleMenu && (
            <div className="absolute right-0 top-11 bg-surface-900 border border-surface-700 rounded-xl shadow-2xl z-50 min-w-[140px] py-1">
              {[
                { role: 'student', icon: '📚', label: 'Student' },
                { role: 'teacher', icon: '🎓', label: 'Teacher' },
                { role: 'ceo',     icon: '👔', label: 'CEO' },
                { role: 'admin',   icon: '🛡️', label: 'Admin' },
                { role: 'manager', icon: '📊', label: 'Manager' },
              ].map(({ role: r, icon, label }) => (
                <button
                  key={r}
                  onClick={() => { setUserRole(r as import('@/types').UserRole); setShowRoleMenu(false); }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                    userRole === r ? 'text-primary-400 bg-primary-500/10' : 'text-surface-300 hover:bg-surface-800'
                  }`}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                  {userRole === r && <span className="ml-auto text-primary-400">✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

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
          sidebarOpen ? 'md:pl-[220px]' : 'md:pl-[56px]',
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
        sidebarOpen ? 'pl-[220px]' : 'pl-[56px]')}>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
      <FeedbackWidget />
    </div>
  );
}
