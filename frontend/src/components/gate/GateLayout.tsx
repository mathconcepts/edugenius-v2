/**
 * GateLayout — Minimal layout for the GATE math app.
 * Mobile-first, dark mode, bottom nav.
 */

import { Outlet, NavLink } from 'react-router-dom';
import { Home, Target, CheckCircle, BarChart3, Settings } from 'lucide-react';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { to: '/',         icon: Home,        label: 'Home',     end: true },
  { to: '/verify',   icon: CheckCircle, label: 'Verify' },
  { to: '/progress', icon: BarChart3,   label: 'Progress' },
  { to: '/settings', icon: Settings,    label: 'Settings' },
];

export function GateLayout() {
  return (
    <div className="min-h-dvh bg-surface-950 text-white">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-14 bg-surface-950/95 border-b border-surface-800/80 backdrop-blur-md">
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

      {/* Bottom Nav */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch bg-surface-950/95 border-t border-surface-800/80 backdrop-blur-md"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                'flex-1 flex flex-col items-center justify-center py-2.5 gap-1',
                'touch-manipulation transition-colors duration-150',
                isActive ? 'text-sky-400' : 'text-surface-500',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-[11px] font-medium">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
