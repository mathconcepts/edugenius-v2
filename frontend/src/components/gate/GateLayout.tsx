/**
 * GateLayout — Mobile-first layout with animated bottom nav, scroll-aware header, auth.
 */

import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, BarChart3, Settings, MessageCircle, User, LogOut, Shield, BookOpen, Brain } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '@/hooks/useAuth';
import { useSession } from '@/hooks/useSession';
import { StreakBadge } from '@/components/gate/StreakBadge';

const NAV_ITEMS = [
  { to: '/',          icon: Home,          label: 'Home',     end: true },
  { to: '/notebook',  icon: BookOpen,      label: 'Notes' },
  { to: '/progress',  icon: BarChart3,     label: 'Progress' },
];

export function GateLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const sessionId = useSession();
  const [scrolled, setScrolled] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close menu on route change
  useEffect(() => setShowMenu(false), [location]);

  return (
    <div className="min-h-dvh bg-surface-950 text-white">
      {/* Header — shadow on scroll */}
      <header className={clsx(
        'fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-12 bg-surface-950/95 border-b backdrop-blur-md transition-all duration-200',
        scrolled ? 'border-surface-800/80 shadow-lg shadow-black/20' : 'border-transparent',
      )}>
        <a href="/" className="flex items-center gap-2.5 min-w-[44px] min-h-[44px]">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <span className="text-white font-black text-sm">G</span>
          </div>
          <span className="font-bold text-white text-base tracking-tight sr-only">GATE Math</span>
        </a>
        <div className="flex items-center gap-2">
          <StreakBadge sessionId={sessionId} />
          {user ? (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-800 transition-colors"
              >
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center text-xs font-bold">
                    {(user.display_name || user.email)?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}
              </button>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="absolute right-0 top-full mt-2 w-48 rounded-xl bg-surface-900 border border-surface-700 shadow-xl py-1 z-50"
                >
                  <div className="px-3 py-2 border-b border-surface-800">
                    <p className="text-xs font-medium text-white truncate">{user.display_name || user.email}</p>
                    <p className="text-xs text-surface-500 capitalize">{user.role}</p>
                  </div>
                  <button
                    onClick={() => navigate('/settings')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-300 hover:bg-surface-800 transition-colors"
                  >
                    <Settings size={14} /> Settings
                  </button>
                  {(user.role === 'teacher' || user.role === 'admin') && (
                    <button
                      onClick={() => navigate('/admin')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-300 hover:bg-surface-800 transition-colors"
                    >
                      <Shield size={14} /> Admin
                    </button>
                  )}
                  {(user.role === 'teacher' || user.role === 'admin') && (
                    <button
                      onClick={() => navigate('/admin/gbrain')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-300 hover:bg-surface-800 transition-colors"
                    >
                      <Brain size={14} /> GBrain Admin
                    </button>
                  )}
                  {(user.role === 'teacher' || user.role === 'admin') && (
                    <button
                      onClick={() => navigate('/admin/content')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-surface-300 hover:bg-surface-800 transition-colors"
                    >
                      <BookOpen size={14} /> Content Engine
                    </button>
                  )}
                  <button
                    onClick={() => { signOut(); setShowMenu(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-surface-800 transition-colors"
                  >
                    <LogOut size={14} /> Sign Out
                  </button>
                </motion.div>
              )}
            </div>
          ) : (
            <>
              <button
                onClick={() => navigate('/settings')}
                className="p-1.5 rounded-lg hover:bg-surface-800 transition-colors"
              >
                <Settings size={16} className="text-surface-400" />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-300 text-sm transition-colors"
              >
                <User size={14} />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="pt-12 pb-[calc(64px+env(safe-area-inset-bottom,0px))] min-h-dvh">
        <div className="px-4 pt-2 pb-4 max-w-3xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Floating Tutor FAB — hidden on /chat */}
      {location.pathname !== '/chat' && (
        <motion.button
          onClick={() => navigate('/chat')}
          className="fixed z-50 right-4 w-14 h-14 rounded-full bg-sky-500 text-white shadow-lg shadow-sky-500/25 flex items-center justify-center hover:bg-sky-400 transition-colors cursor-pointer touch-manipulation"
          style={{ bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 16px)' }}
          whileTap={{ scale: 0.9 }}
          aria-label="Ask the tutor"
        >
          <MessageCircle size={20} />
        </motion.button>
      )}

      {/* Bottom Nav — 3 tabs with animated active indicator */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch bg-surface-950/95 border-t border-surface-800/80 backdrop-blur-md"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {NAV_ITEMS.map(item => {
          const isActive = item.end
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={clsx(
                'relative flex-1 flex flex-col items-center justify-center py-2.5 gap-1',
                'touch-manipulation transition-colors duration-150',
                isActive ? 'text-sky-400' : 'text-surface-500',
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-sky-400"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Click-away for menu */}
      {showMenu && (
        <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
      )}
    </div>
  );
}
