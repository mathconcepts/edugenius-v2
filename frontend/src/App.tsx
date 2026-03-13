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
const NetworkEffects = lazy(() => import('@/pages/NetworkEffects'));
const Progress = lazy(() => import('@/pages/Progress'));
const Content = lazy(() => import('@/pages/Content'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Students = lazy(() => import('@/pages/Students'));
const RolePreview = lazy(() => import('@/pages/RolePreview'));
const CEOIntegrations = lazy(() => import('@/pages/dashboards/CEOIntegrations').then(m => ({ default: m.CEOIntegrations })));
const CEOStrategy = lazy(() => import('@/pages/dashboards/CEOStrategy').then(m => ({ default: m.CEOStrategy })));
const BatchGenerate = lazy(() => import('@/components/BatchGenerationPanel').then(m => ({ default: m.BatchGenerationPanel })));

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

// Lazy load Agent Skills page (CEO-only)
const AgentSkills = lazy(() => import('@/pages/AgentSkills'));

// Lazy load feedback
const FeedbackPage = lazy(() => import('@/pages/Feedback'));
const AdminFeedback = lazy(() => import('@/pages/dashboards/AdminFeedback'));

// Lazy load user admin
const UserAdmin = lazy(() => import('@/pages/UserAdmin'));
const UserManagementPortal = lazy(() => import('@/pages/UserManagementPortal'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));

// Lazy load Settings (real page, not stub)
const SettingsPage = lazy(() => import('@/pages/Settings'));

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
const PrismDashboard = lazy(() => import('@/pages/dashboards/PrismDashboard').then(m => ({ default: m.PrismDashboard })));
const RevenueDashboard = lazy(() => import('@/pages/dashboards/RevenueDashboard'));

// Lazy load system status
const SystemStatus = lazy(() => import('@/pages/SystemStatus').then(m => ({ default: m.SystemStatus })));

// Lazy load Market Intelligence (CEO only)
const MarketIntelligence = lazy(() => import('@/pages/MarketIntelligence'));

// Lazy load Atlas Workbench (CEO only)
const AtlasWorkbench = lazy(() => import('@/pages/AtlasWorkbench'));

// Lazy load Content Strategy (CEO + students)
const ContentStrategyPage = lazy(() => import('@/pages/ContentStrategy').then(m => ({ default: m.ContentStrategy })));

// Lazy load Content Orchestrator (CEO only)
const ContentOrchestrator = lazy(() => import('@/pages/ContentOrchestrator'));

// Lazy load Content Hub (CEO only)
const ContentHub = lazy(() => import('@/pages/ContentHub'));

// Lazy load Social Intent Dashboard (CEO only)
const SocialIntentDashboard = lazy(() => import('@/pages/SocialIntentDashboard'));

// Lazy load Local Page Builder (CEO only)
const LocalPageBuilder = lazy(() => import('@/pages/LocalPageBuilder'));

// Lazy load Course Orchestrator (CEO only)
const CourseOrchestrator = lazy(() => import('@/pages/CourseOrchestrator'));

// Lazy load Growth Command (CEO only)
const GrowthCommand = lazy(() => import('@/pages/dashboards/GrowthCommand').then(m => ({ default: m.GrowthCommand })));

// Lazy load Content Personalization Control (CEO only)
const ContentPersonalizationControl = lazy(() => import('@/pages/dashboards/ContentPersonalizationControl').then(m => ({ default: m.ContentPersonalizationControl })));

// ── Delight Features ──────────────────────────────────────────────────────────
const Leaderboard = lazy(() => import('@/pages/Leaderboard'));
const ExamSim = lazy(() => import('@/pages/ExamSim'));
const RevisionSchedule = lazy(() => import('@/pages/RevisionSchedule'));
const DailyBriefPage = lazy(() => import('@/pages/DailyBrief'));

// Lazy load Social Intent Dashboard (CEO only)

// Lazy load trace viewer
const TraceViewer = lazy(() => import('@/pages/TraceViewer').then(m => ({ default: m.TraceViewer })));

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

// NOTE: Settings route uses lazy-loaded SettingsPage — see import above.
// The Events route still uses an inline stub (no dedicated EventBus page yet).
// DEBT: create a real EventBus page at src/pages/Events.tsx

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
        
        {/* ==================== AUTH ==================== */}
        <Route path="/login" element={<LoginPage />} />

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
          <Route path="user-portal" element={<UserManagementPortal />} />
          <Route path="events" element={<Events />} />
          <Route path="settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
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
          <Route path="batch-generate" element={<Suspense fallback={<PageLoader />}><BatchGenerate /></Suspense>} />
          <Route path="blog" element={<WebsiteBlog adminMode />} />
          
          {/* Student routes */}
          <Route path="learn" element={<Learn />} />
          <Route path="learn/:subjectId" element={<Learn />} />
          <Route path="notebook" element={<Notebook />} />
          <Route path="network" element={<Suspense fallback={<PageLoader />}><NetworkEffects /></Suspense>} />
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

          {/* Trace Explorer — CEO/Admin only */}
          <Route path="trace" element={<Suspense fallback={<PageLoader />}><TraceViewer /></Suspense>} />
          <Route path="trace/:traceId" element={<Suspense fallback={<PageLoader />}><TraceViewer /></Suspense>} />

          {/* Prism — Journey Intelligence — CEO/Admin only */}
          <Route path="prism" element={<Suspense fallback={<PageLoader />}><PrismDashboard /></Suspense>} />
          <Route path="revenue" element={<Suspense fallback={<PageLoader />}><RevenueDashboard /></Suspense>} />

          {/* Market Intelligence — Scout pipeline — CEO only */}
          <Route path="market-intel" element={<Suspense fallback={<PageLoader />}><MarketIntelligence /></Suspense>} />

          {/* Atlas Workbench — content generation — CEO only */}
          <Route path="atlas-workbench" element={<Suspense fallback={<PageLoader />}><AtlasWorkbench /></Suspense>} />

          {/* Content Strategy — CEO (platform) + all users (personal) */}
          <Route path="content-strategy" element={<Suspense fallback={<PageLoader />}><ContentStrategyPage /></Suspense>} />

          {/* Content Orchestrator — CEO only */}
          <Route path="content-orchestrator" element={<Suspense fallback={<PageLoader />}><ContentOrchestrator /></Suspense>} />

          {/* Agent Skills — CEO only */}
          <Route path="agent-skills" element={<Suspense fallback={<PageLoader />}><AgentSkills /></Suspense>} />

          {/* Content Hub — CEO only */}
          <Route path="content-hub" element={<Suspense fallback={<PageLoader />}><ContentHub /></Suspense>} />
          <Route path="social-intent" element={<Suspense fallback={<PageLoader />}><SocialIntentDashboard /></Suspense>} />

          {/* Local Page Builder — CEO only */}
          <Route path="page-builder" element={<Suspense fallback={<PageLoader />}><LocalPageBuilder /></Suspense>} />

          {/* Course Orchestrator — CEO only */}
          <Route path="course-orchestrator" element={<Suspense fallback={<PageLoader />}><CourseOrchestrator /></Suspense>} />

          {/* Growth Command — Master Growth Orchestrator Dashboard — CEO only */}
          <Route path="growth-command" element={<Suspense fallback={<PageLoader />}><GrowthCommand /></Suspense>} />

          {/* Content Personalization Control — CEO only */}
          <Route path="content-personalization" element={<Suspense fallback={<PageLoader />}><ContentPersonalizationControl /></Suspense>} />
          {/* ── Delight Feature Routes ──────────────────────────────────── */}
          <Route path="leaderboard" element={<Suspense fallback={<PageLoader />}><Leaderboard /></Suspense>} />
          <Route path="exam-sim" element={<Suspense fallback={<PageLoader />}><ExamSim /></Suspense>} />
          <Route path="revision" element={<Suspense fallback={<PageLoader />}><RevisionSchedule /></Suspense>} />
          <Route path="daily-brief" element={<Suspense fallback={<PageLoader />}><DailyBriefPage /></Suspense>} />

          {/* Social Intent Dashboard — CEO only */}

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
