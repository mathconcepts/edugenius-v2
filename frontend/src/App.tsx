import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { 
  Dashboard, 
  Agents, 
  Chat, 
  Learn, 
  Notebook, 
  Progress, 
  Content, 
  Analytics, 
  Students,
  RolePreview,
} from '@/pages';
import { 
  WebsiteHome, 
  WebsitePricing, 
  WebsiteBlog, 
  WebsiteExamPage 
} from '@/pages/website';

// Placeholder components for routes
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

export default function App() {
  return (
    <Routes>
      {/* ==================== PUBLIC WEBSITE ==================== */}
      <Route path="/website" element={<WebsiteHome />} />
      <Route path="/website/pricing" element={<WebsitePricing />} />
      <Route path="/website/blog" element={<WebsiteBlog />} />
      <Route path="/website/blog/:slug" element={<WebsiteBlog />} />
      <Route path="/website/exams/:examCode" element={<WebsiteExamPage />} />
      <Route path="/website/features" element={<WebsiteHome />} />
      <Route path="/website/about" element={<WebsiteHome />} />
      <Route path="/website/demo" element={<WebsiteHome />} />
      <Route path="/website/signup" element={<WebsiteHome />} />
      <Route path="/website/contact" element={<WebsiteHome />} />
      
      {/* ==================== PORTAL (APP) ==================== */}
      {/* Role Preview - Standalone page */}
      <Route path="/preview" element={<RolePreview />} />
      
      {/* Main App with Layout */}
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
