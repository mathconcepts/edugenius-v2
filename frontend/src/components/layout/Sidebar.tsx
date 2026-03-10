/**
 * Sidebar — Role-adaptive, frugal navigation
 * CEO: 5 primary items + agents panel on hover
 * Student/Teacher: clean 4-5 items, prominent chat CTA
 * Admin: 6 items | Teacher: 5 items | Manager: 4 items
 */
import { useState, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import {
  Home, MessageSquare, BookOpen, Users, BarChart3, Settings, Bot,
  FileText, GraduationCap, ChevronLeft, ChevronRight, PlayCircle, User,
  BookMarked, Target, Trophy, Network, Radar, Sparkles, Sliders, Cpu, Zap,
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  highlight?: boolean;
}

// ── CEO — 5 primary nav items only ──────────────────────────────────────────

const ceoNavItems: NavItem[] = [
  { to: '/briefing',              icon: Home,        label: 'Home',            highlight: true },
  { to: '/create-exam',           icon: Target,      label: 'Exams' },
  { to: '/opportunity-discovery', icon: BarChart3,   label: 'Intelligence' },
  { to: '/market-intel',          icon: Radar,       label: 'Market Intel' },
  { to: '/atlas-workbench',       icon: Sparkles,    label: 'Atlas Workbench' },
  { to: '/content-strategy',      icon: Sliders,     label: 'Content Strategy' },
  { to: '/content-orchestrator',  icon: Cpu,         label: 'Orchestrator' },
  { to: '/agent-skills',          icon: Zap,         label: 'Agent Skills' },
  { to: '/students',              icon: Users,       label: 'People' },
  { to: '/settings',              icon: Settings,    label: 'Settings' },
];

// ── Non-CEO role nav items ────────────────────────────────────────────────────

const roleNavItems = {
  manager: [
    { to: '/manager',   icon: Home,         label: 'My Dashboard', highlight: true },
    { to: '/users',     icon: Users,        label: 'Students' },
    { to: '/feedback',  icon: MessageSquare, label: 'Tickets' },
    { to: '/analytics', icon: BarChart3,    label: 'Analytics' },
  ],
  admin: [
    { to: '/',          icon: Home,      label: 'Home' },
    { to: '/briefing',  icon: BarChart3, label: 'Dashboard' },
    { to: '/content',   icon: FileText,  label: 'Content' },
    { to: '/users',     icon: Users,     label: 'Users' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    { to: '/settings',  icon: Settings,  label: 'Settings' },
  ],
  teacher: [
    { to: '/',          icon: Home,         label: 'Home' },
    { to: '/students',  icon: Users,        label: 'Students' },
    { to: '/chat',      icon: MessageSquare, label: 'Sage Chat', highlight: true },
    { to: '/content',   icon: BookOpen,     label: 'Lessons' },
    { to: '/analytics', icon: BarChart3,    label: 'Progress' },
  ],
  student: [
    { to: '/',                  icon: Home,          label: 'Home' },
    { to: '/chat',              icon: MessageSquare, label: 'Ask Tutor',  highlight: true },
    { to: '/learn',             icon: GraduationCap, label: 'Study' },
    { to: '/notebook',          icon: BookMarked,    label: 'Notebook' },
    { to: '/progress',          icon: BarChart3,     label: 'Progress' },
    { to: '/content-strategy',  icon: Sliders,       label: 'My Strategy' },
  ],
};

// ── Agent shortcuts (CEO only) ────────────────────────────────────────────────

const agentShortcuts = [
  { id: 'scout',  emoji: '🔍', label: 'Scout' },
  { id: 'atlas',  emoji: '📚', label: 'Atlas' },
  { id: 'sage',   emoji: '🎓', label: 'Sage' },
  { id: 'mentor', emoji: '👨‍🏫', label: 'Mentor' },
  { id: 'herald', emoji: '📢', label: 'Herald' },
  { id: 'forge',  emoji: '⚙️', label: 'Forge' },
  { id: 'oracle', emoji: '📊', label: 'Oracle' },
];

// ── Tooltip wrapper ───────────────────────────────────────────────────────────

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip">
      {children}
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-surface-800 border border-surface-700 text-xs text-white rounded-lg whitespace-nowrap z-50 pointer-events-none opacity-0 group-hover/tip:opacity-100 transition-opacity">
        {label}
      </div>
    </div>
  );
}

// ── Streak badge (student) ────────────────────────────────────────────────────

function StreakBadge({ streak, open }: { streak: number; open: boolean }) {
  if (!open) return null;
  return (
    <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center gap-2">
      <span className="text-base">🔥</span>
      <div>
        <p className="text-xs font-semibold text-orange-300">{streak} day streak</p>
        <p className="text-[10px] text-orange-400/60">Keep it going!</p>
      </div>
    </div>
  );
}

// ── Nav item link ─────────────────────────────────────────────────────────────

function NavItemLink({ item, sidebarOpen }: { item: NavItem; sidebarOpen: boolean }) {
  const link = (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all',
          isActive
            ? 'bg-gradient-to-r from-primary-600/25 to-primary-500/15 text-primary-400 border border-primary-500/20'
            : item.highlight
              ? 'text-accent-300 hover:bg-accent-500/10 hover:text-accent-200'
              : 'text-surface-400 hover:bg-surface-800/60 hover:text-white',
          !sidebarOpen && 'justify-center'
        )
      }
    >
      <item.icon className="w-5 h-5 flex-shrink-0" />
      {sidebarOpen && (
        <span className={clsx('font-medium text-sm', item.highlight && 'font-semibold')}>
          {item.label}
        </span>
      )}
    </NavLink>
  );

  return !sidebarOpen ? <Tooltip label={item.label}>{link}</Tooltip> : link;
}

// ── Agents hover panel (CEO only) ─────────────────────────────────────────────

function AgentsPanel({ sidebarOpen, navigate }: { sidebarOpen: boolean; navigate: (to: string) => void }) {
  const [showAgents, setShowAgents] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowAgents(true);
  };
  const handleMouseLeave = () => {
    hideTimer.current = setTimeout(() => setShowAgents(false), 200);
  };

  if (!sidebarOpen) {
    return (
      <Tooltip label="Agents">
        <button
          onClick={() => navigate('/agents')}
          className="flex items-center justify-center p-2.5 rounded-xl text-surface-400 hover:bg-surface-800/60 hover:text-white transition-all w-full"
        >
          <Bot className="w-5 h-5" />
        </button>
      </Tooltip>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-surface-400 hover:bg-surface-800/60 hover:text-white transition-all w-full">
        <Bot className="w-5 h-5 flex-shrink-0" />
        <span className="font-medium text-sm">Agents 🤖</span>
      </button>

      <AnimatePresence>
        {showAgents && (
          <motion.div
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute left-full top-0 ml-2 w-40 glass rounded-xl shadow-xl z-50 overflow-hidden"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="p-1.5">
              {agentShortcuts.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => { navigate(`/agents/${agent.id}`); setShowAgents(false); }}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-surface-300 hover:bg-surface-700 hover:text-white transition-colors w-full text-left"
                >
                  <span className="text-base">{agent.emoji}</span>
                  <span className="text-sm">{agent.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────

export function Sidebar() {
  const { sidebarOpen, toggleSidebar, userRole } = useAppStore();
  const navigate = useNavigate();
  const isCEO = userRole === 'ceo';

  const navItems = isCEO
    ? ceoNavItems
    : (roleNavItems[userRole as keyof typeof roleNavItems] || roleNavItems.admin);

  return (
    <motion.aside
      initial={false}
      animate={{ width: sidebarOpen ? 220 : 56 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed left-0 top-0 h-screen glass border-r border-surface-700/50 z-40 flex flex-col"
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-3 border-b border-surface-700/50 flex-shrink-0">
        <AnimatePresence mode="wait">
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 px-1"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold text-sm">
                E
              </div>
              <span className="font-semibold gradient-text">EduGenius</span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={toggleSidebar}
          className="p-1.5 hover:bg-surface-800 rounded-lg transition-colors flex-shrink-0 ml-auto"
        >
          {sidebarOpen
            ? <ChevronLeft className="w-4 h-4 text-surface-400" />
            : <ChevronRight className="w-4 h-4 text-surface-400" />}
        </button>
      </div>

      {/* Playground indicator */}
      {sidebarOpen && (
        <div className="px-4 py-1.5 border-b border-surface-700/30">
          <div className="flex items-center gap-1.5">
            <PlayCircle className="w-3 h-3 text-accent-400" />
            <span className="text-[10px] text-accent-400/70 uppercase tracking-widest">Playground</span>
          </div>
        </div>
      )}

      {/* Streak badge (student) */}
      {userRole === 'student' && <StreakBadge streak={12} open={sidebarOpen} />}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map(item => (
          <NavItemLink key={item.to} item={item} sidebarOpen={sidebarOpen} />
        ))}

        {/* Agents hover panel (CEO only) */}
        {isCEO && (
          <div className="pt-1">
            <AgentsPanel sidebarOpen={sidebarOpen} navigate={navigate} />
          </div>
        )}

        {/* Student extra nav when expanded */}
        {userRole === 'student' && sidebarOpen && (
          <div className="pt-2 border-t border-surface-700/30 mt-2 space-y-0.5">
            <NavLink to="/practice" className={({ isActive }) =>
              clsx('flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm',
                isActive ? 'bg-gradient-to-r from-primary-600/25 to-primary-500/15 text-primary-400 border border-primary-500/20' : 'text-surface-400 hover:bg-surface-800/60 hover:text-white')}>
              <Target className="w-5 h-5" />
              <span>Practice MCQs</span>
            </NavLink>
            <NavLink to="/insights" className={({ isActive }) =>
              clsx('flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-sm',
                isActive ? 'bg-gradient-to-r from-primary-600/25 to-primary-500/15 text-primary-400 border border-primary-500/20' : 'text-surface-400 hover:bg-surface-800/60 hover:text-white')}>
              <Trophy className="w-5 h-5" />
              <span>Exam Tips</span>
            </NavLink>
          </div>
        )}
      </nav>

      {/* User info at bottom */}
      <div className="flex-shrink-0 p-2 border-t border-surface-700/50">
        <div className={clsx(
          'flex items-center gap-3 px-2 py-2 rounded-xl bg-surface-800/30',
          !sidebarOpen && 'justify-center'
        )}>
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-400 to-accent-400 flex items-center justify-center flex-shrink-0">
            <User className="w-3.5 h-3.5 text-white" />
          </div>
          {sidebarOpen && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {userRole === 'ceo' ? 'Giri (CEO)' :
                 userRole === 'admin' ? 'Admin' :
                 userRole === 'manager' ? 'Manager' :
                 userRole === 'teacher' ? 'Teacher' : 'Student'}
              </p>
              <p className="text-[10px] text-surface-500 capitalize">{userRole}</p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  );
}
