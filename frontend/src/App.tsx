import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout';
import { NotFound } from '@/pages/NotFound';

// Eager load core pages
import { Dashboard } from '@/pages';

// Lazy load feature pages for code splitting
const Agents = lazy(() => import('@/pages/Agents').then(m => ({ default: m.Agents })));
const Chat = lazy(() => import('@/pages/Chat').then(m => ({ default: m.Chat })));
const Learn = lazy(() => import('@/pages/Learn'));
const Notebook = lazy(() => import('@/pages/Notebook'));
const Progress = lazy(() => import('@/pages/Progress'));
const Content = lazy(() => import('@/pages/Content'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Students = lazy(() => import('@/pages/Students'));
const RolePreview = lazy(() => import('@/pages/RolePreview'));
const CEOIntegrations = lazy(() => import('@/pages/dashboards/CEOIntegrations').then(m => ({ default: m.CEOIntegrations })));
const CEOStrategy = lazy(() => import('@/pages/dashboards/CEOStrategy').then(m => ({ default: m.CEOStrategy })));

// Lazy load website pages
const WebsiteHome = lazy(() => import('@/pages/website/Home'));
const WebsitePricing = lazy(() => import('@/pages/website/Pricing'));
const WebsiteBlog = lazy(() => import('@/pages/website/Blog'));
const WebsiteExamPage = lazy(() => import('@/pages/website/ExamPage'));

// Lazy load onboarding
const Onboarding = lazy(() => import('@/pages/onboarding'));

// Lazy load exam insights + analytics
const ExamInsights = lazy(() => import('@/pages/ExamInsights'));
const Practice = lazy(() => import('@/pages/Practice'));
const ExamAnalytics = lazy(() => import('@/pages/ExamAnalytics'));

// Lazy load feedback
const FeedbackPage = lazy(() => import('@/pages/Feedback'));
const AdminFeedback = lazy(() => import('@/pages/dashboards/AdminFeedback'));

// Lazy load user admin
const UserAdmin = lazy(() => import('@/pages/UserAdmin'));

// Lazy load connection registry
const ConnectionRegistry = lazy(() => import('@/pages/ConnectionRegistry').then(m => ({ default: m.ConnectionRegistry })));

// Lazy load user attribute registry
const UserAttributeRegistry = lazy(() => import('@/pages/UserAttributeRegistry').then(m => ({ default: m.UserAttributeRegistry })));

// Lazy load manager dashboard
const ManagerDashboard = lazy(() => import('@/pages/dashboards/ManagerDashboard').then(m => ({ default: m.ManagerDashboard })));

// Lazy load exam creation wizard
const ExamCreationWizard = lazy(() => import('@/pages/dashboards/ExamCreationWizard').then(m => ({ default: m.ExamCreationWizard })));
const OpportunityDiscovery = lazy(() => import('@/pages/dashboards/OpportunityDiscovery').then(m => ({ default: m.OpportunityDiscovery })));
const CEOBriefing = lazy(() => import('@/pages/dashboards/CEOBriefing').then(m => ({ default: m.CEOBriefing })));
const CEOThresholdConfig = lazy(() => import('@/pages/dashboards/CEOThresholdConfig').then(m => ({ default: m.CEOThresholdConfig })));
const ContentIntelligence = lazy(() => import('@/pages/dashboards/ContentIntelligence').then(m => ({ default: m.ContentIntelligence })));

// Lazy load system status
const SystemStatus = lazy(() => import('@/pages/SystemStatus').then(m => ({ default: m.SystemStatus })));

// Loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
  </div>
);

// Placeholder components for routes
// UserAdmin is lazy-loaded from @/pages/UserAdmin

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
    <Suspense fallback={<PageLoader />}>
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
        
        {/* ==================== ONBOARDING ==================== */}
        <Route path="/onboarding" element={<Onboarding />} />
        
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
          <Route path="users" element={<UserAdmin />} />
          <Route path="events" element={<Events />} />
          <Route path="settings" element={<Settings />} />
          <Route path="integrations" element={<CEOIntegrations />} />
          <Route path="connections" element={<ConnectionRegistry />} />
          <Route path="user-attributes" element={<UserAttributeRegistry />} />
          <Route path="manager" element={<ManagerDashboard />} />
          <Route path="create-exam" element={<ExamCreationWizard />} />
          <Route path="opportunity-discovery" element={<OpportunityDiscovery />} />
          <Route path="briefing" element={<CEOBriefing />} />
          <Route path="autonomy-settings" element={<CEOThresholdConfig />} />
          <Route path="strategy" element={<CEOStrategy />} />
          <Route path="content-intelligence" element={<ContentIntelligence />} />
          <Route path="blog" element={<WebsiteBlog adminMode />} />
          
          {/* Student routes */}
          <Route path="learn" element={<Learn />} />
          <Route path="learn/:subjectId" element={<Learn />} />
          <Route path="notebook" element={<Notebook />} />
          <Route path="progress" element={<Progress />} />
          <Route path="insights" element={<ExamInsights />} />
          <Route path="practice" element={<Practice />} />
          <Route path="exam-analytics" element={<ExamAnalytics />} />
          
          {/* Teacher routes */}
          <Route path="students" element={<Students />} />

          {/* Feedback & Complaints */}
          <Route path="feedback" element={<FeedbackPage />} />
          <Route path="admin/feedback" element={<AdminFeedback />} />

          {/* System Status — CEO/Admin only */}
          <Route path="status" element={<SystemStatus />} />
          
          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
