/**
 * Role Preview Page - Live preview switcher for all roles
 * Allows viewing the platform from different user perspectives
 */

import { Link } from 'react-router-dom';
import { useAppStore } from '@/stores/appStore';

type UserRole = 'ceo' | 'admin' | 'teacher' | 'student';

interface RoleInfo {
  role: UserRole;
  title: string;
  description: string;
  icon: string;
  color: string;
  features: string[];
  previewPath: string;
}

const roles: RoleInfo[] = [
  {
    role: 'ceo',
    title: 'CEO Dashboard',
    description: 'High-level business metrics, AI insights, and strategic overview',
    icon: '👔',
    color: 'from-purple-500 to-pink-500',
    features: [
      'Business metrics & KPIs',
      'Oracle AI insights',
      'Revenue & growth analytics',
      'Agent performance overview',
      'Strategic recommendations',
    ],
    previewPath: '/',
  },
  {
    role: 'admin',
    title: 'Admin Dashboard',
    description: 'Platform management, content control, and user administration',
    icon: '⚙️',
    color: 'from-blue-500 to-cyan-500',
    features: [
      'User management',
      'Content moderation',
      'System health monitoring',
      'Agent control panel',
      'Deployment management',
    ],
    previewPath: '/',
  },
  {
    role: 'teacher',
    title: 'Teacher Dashboard',
    description: 'Student progress tracking, class management, and AI-powered insights',
    icon: '👩‍🏫',
    color: 'from-green-500 to-emerald-500',
    features: [
      'Student roster',
      'Progress tracking',
      'At-risk alerts',
      'Parent communication',
      'Class analytics',
    ],
    previewPath: '/students',
  },
  {
    role: 'student',
    title: 'Student Dashboard',
    description: 'Learning interface with AI tutor, practice, and progress tracking',
    icon: '🎓',
    color: 'from-orange-500 to-red-500',
    features: [
      'AI Tutor (Sage)',
      'Smart Notebook',
      'Practice questions',
      'Progress & streaks',
      'Topic exploration',
    ],
    previewPath: '/learn',
  },
];

export default function RolePreview() {
  const { setUserRole, userRole } = useAppStore();

  const handleRoleSelect = (role: UserRole) => {
    setUserRole(role);
  };

  return (
    <div className="min-h-screen bg-surface-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            🎭 Role Preview Mode
          </h1>
          <p className="text-xl text-surface-400 max-w-2xl mx-auto">
            Experience EduGenius from different user perspectives. Select a role to see the platform as that user would.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-surface-800 rounded-full text-sm">
            <span className="text-surface-400">Current role:</span>
            <span className="text-primary-400 font-medium capitalize">{userRole}</span>
          </div>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {roles.map(roleInfo => (
            <div
              key={roleInfo.role}
              className={`card p-6 transition-all hover:scale-105 cursor-pointer ${
                userRole === roleInfo.role ? 'ring-2 ring-primary-500' : ''
              }`}
              onClick={() => handleRoleSelect(roleInfo.role)}
            >
              <div className="flex items-start gap-4">
                <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${roleInfo.color} flex items-center justify-center text-3xl`}>
                  {roleInfo.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">{roleInfo.title}</h3>
                  <p className="text-surface-400 text-sm mt-1">{roleInfo.description}</p>
                </div>
                {userRole === roleInfo.role && (
                  <span className="px-3 py-1 bg-primary-500/20 text-primary-400 rounded-full text-xs">
                    Active
                  </span>
                )}
              </div>

              <div className="mt-4">
                <h4 className="text-sm font-medium text-surface-300 mb-2">Features:</h4>
                <div className="flex flex-wrap gap-2">
                  {roleInfo.features.map(feature => (
                    <span key={feature} className="px-2 py-1 bg-surface-700 text-surface-300 rounded text-xs">
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              <Link
                to={roleInfo.previewPath}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRoleSelect(roleInfo.role);
                }}
                className="mt-4 btn btn-sm w-full bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-700 hover:to-accent-700"
              >
                Preview as {roleInfo.title.replace(' Dashboard', '')} →
              </Link>
            </div>
          ))}
        </div>

        {/* AI Agents Overview */}
        <div className="mt-12 card">
          <h2 className="text-2xl font-bold text-white mb-6">🤖 AI Agents Powering Each View</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'Oracle', role: 'Analytics', icon: '🔮', serves: ['CEO', 'Admin'] },
              { name: 'Atlas', role: 'Content', icon: '📚', serves: ['Admin', 'Student'] },
              { name: 'Sage', role: 'Tutoring', icon: '🧙', serves: ['Student'] },
              { name: 'Mentor', role: 'Engagement', icon: '💪', serves: ['Teacher', 'Student'] },
              { name: 'Herald', role: 'Marketing', icon: '📢', serves: ['CEO', 'Admin'] },
              { name: 'Scout', role: 'Intelligence', icon: '🔍', serves: ['CEO'] },
              { name: 'Forge', role: 'Deployment', icon: '🔧', serves: ['Admin'] },
              { name: 'Jarvis', role: 'Orchestration', icon: '🤖', serves: ['All'] },
            ].map(agent => (
              <div key={agent.name} className="p-4 bg-surface-800/50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{agent.icon}</span>
                  <div>
                    <p className="text-white font-medium">{agent.name}</p>
                    <p className="text-xs text-surface-400">{agent.role}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {agent.serves.map(role => (
                    <span key={role} className="px-1.5 py-0.5 bg-primary-500/20 text-primary-400 rounded text-xs">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 text-center">
          <p className="text-surface-400 mb-4">Quick navigation:</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/" className="btn btn-sm bg-surface-700 hover:bg-surface-600">Dashboard</Link>
            <Link to="/agents" className="btn btn-sm bg-surface-700 hover:bg-surface-600">Agents</Link>
            <Link to="/chat" className="btn btn-sm bg-surface-700 hover:bg-surface-600">AI Chat</Link>
            <Link to="/learn" className="btn btn-sm bg-surface-700 hover:bg-surface-600">Learn</Link>
            <Link to="/notebook" className="btn btn-sm bg-surface-700 hover:bg-surface-600">Notebook</Link>
            <Link to="/analytics" className="btn btn-sm bg-surface-700 hover:bg-surface-600">Analytics</Link>
            <Link to="/content" className="btn btn-sm bg-surface-700 hover:bg-surface-600">Content</Link>
            <Link to="/students" className="btn btn-sm bg-surface-700 hover:bg-surface-600">Students</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
