import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { Dashboard, Agents, Chat } from '@/pages';

// Placeholder components for routes
const Analytics = () => (
  <div className="card">
    <h1 className="text-2xl font-bold mb-4">Analytics</h1>
    <p className="text-surface-400">Detailed analytics and reporting dashboard coming soon.</p>
  </div>
);

const Content = () => (
  <div className="card">
    <h1 className="text-2xl font-bold mb-4">Content Management</h1>
    <p className="text-surface-400">Manage questions, lessons, and educational content.</p>
  </div>
);

const Users = () => (
  <div className="card">
    <h1 className="text-2xl font-bold mb-4">Users</h1>
    <p className="text-surface-400">User management and administration.</p>
  </div>
);

const Events = () => (
  <div className="card">
    <h1 className="text-2xl font-bold mb-4">Event Bus</h1>
    <p className="text-surface-400">Monitor system events and agent communications.</p>
  </div>
);

const Settings = () => (
  <div className="card">
    <h1 className="text-2xl font-bold mb-4">Settings</h1>
    <p className="text-surface-400">Platform configuration and preferences.</p>
  </div>
);

const Learn = () => (
  <div className="card">
    <h1 className="text-2xl font-bold mb-4">Learn</h1>
    <p className="text-surface-400">Browse topics and start learning.</p>
  </div>
);

const Notebook = () => (
  <div className="card">
    <h1 className="text-2xl font-bold mb-4">Smart Notebook</h1>
    <p className="text-surface-400">Write equations and get AI-powered help.</p>
  </div>
);

const Progress = () => (
  <div className="card">
    <h1 className="text-2xl font-bold mb-4">My Progress</h1>
    <p className="text-surface-400">Track your learning journey and achievements.</p>
  </div>
);

const Students = () => (
  <div className="card">
    <h1 className="text-2xl font-bold mb-4">My Students</h1>
    <p className="text-surface-400">View and manage your student roster.</p>
  </div>
);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="agents" element={<Agents />} />
        <Route path="agents/:agentId" element={<Agents />} />
        <Route path="chat" element={<Chat />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="content" element={<Content />} />
        <Route path="users" element={<Users />} />
        <Route path="events" element={<Events />} />
        <Route path="settings" element={<Settings />} />
        
        {/* Student routes */}
        <Route path="learn" element={<Learn />} />
        <Route path="learn/:subjectId" element={<Learn />} />
        <Route path="notebook" element={<Notebook />} />
        <Route path="progress" element={<Progress />} />
        
        {/* Teacher routes */}
        <Route path="students" element={<Students />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
