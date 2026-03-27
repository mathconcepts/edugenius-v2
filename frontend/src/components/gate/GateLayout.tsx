/**
 * GateLayout — Mobile-first layout with animated bottom nav and scroll-aware header.
 */

import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, CheckCircle, BarChart3, Settings } from 'lucide-react';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { to: '/',         icon: Home,        label: 'Home',     end: true },
  { to: '/verify',   icon: CheckCircle, label: 'Verify' },
  { to: '/progress', icon: BarChart3,   label: 'Progress' },
  { to: '/settings', icon: Settings,    label: 'Settings' },
];

export function GateLayout() {
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-dvh bg-surface-950 text-white">
      {/* Header — shadow on scroll */}
      <header className={clsx(
        'fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 bg-surface-950/95 border-b backdrop-blur-md transition-all duration-200',
        scrolled ? 'border-surface-800/80 shadow-lg shadow-black/20' : 'border-transparent',
      )}>
        <a href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-sky-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
            <span className="text-white font-black text-sm">G</span>
          </div>
          <span className="font-bold text-white text-base tracking-tight">GATE Math</span>
        </a>
        <div className="flex items-center gap-2">
          <span className="text-xs text-surface-500 hidden sm:block">GATE Engineering Mathematics</span>
        </div>
      </header>

      {/* Content */}
      <main className="pt-14 pb-[calc(64px+env(safe-area-inset-bottom,0px))] min-h-dvh">
        <div className="p-4 max-w-3xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Bottom Nav — animated active indicator */}
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
              <span className="text-[11px] font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
