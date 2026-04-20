/**
 * GATE Math Practice — 10-route app with AI tutor, auth, and admin.
 *
 * Routes:
 *   /              → Home (topic grid)
 *   /topic/:id     → Topic problems list
 *   /practice/:id  → Practice flow (answer + verify)
 *   /verify        → Verify Any Problem
 *   /chat          → AI Tutor Chat
 *   /progress      → Progress + weak-topic heat map
 *   /settings      → Settings (theme, session)
 *   /login         → Login / Sign up
 *   /admin         → Admin dashboard (teacher/admin only)
 *   *              → 404
 */

import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { GateLayout } from '@/components/gate/GateLayout';

// Eager load home (fast first paint)
import { GateHome } from '@/pages/gate/GateHome';

// Lazy load everything else
const TopicPage = lazy(() => import('@/pages/gate/TopicPage'));
const PracticePage = lazy(() => import('@/pages/gate/PracticePage'));
const VerifyPage = lazy(() => import('@/pages/gate/VerifyPage'));
const ProgressPage = lazy(() => import('@/pages/gate/ProgressPage'));
const SettingsPage = lazy(() => import('@/pages/gate/SettingsPage'));
const ChatPage = lazy(() => import('@/pages/gate/ChatPage'));
const NotebookPage = lazy(() => import('@/pages/gate/NotebookPage'));
const LoginPage = lazy(() => import('@/pages/gate/LoginPage'));
const AdminPage = lazy(() => import('@/pages/gate/AdminPage'));
const OnboardPage = lazy(() => import('@/pages/gate/OnboardPage'));
const DiagnosticPage = lazy(() => import('@/pages/gate/DiagnosticPage'));
const ExamStrategyPage = lazy(() => import('@/pages/gate/ExamStrategyPage'));
const ErrorPatternsPage = lazy(() => import('@/pages/gate/ErrorPatternsPage'));
const StudentAuditPage = lazy(() => import('@/pages/gate/StudentAuditPage'));
const WeeklyDigestPage = lazy(() => import('@/pages/gate/WeeklyDigestPage'));
const MockExamPage = lazy(() => import('@/pages/gate/MockExamPage'));
const GBrainAdminPage = lazy(() => import('@/pages/gate/GBrainAdminPage'));
const MarketingLanding = lazy(() => import('@/pages/gate/MarketingLanding'));
const MaterialsPage = lazy(() => import('@/pages/gate/MaterialsPage'));
const SmartPracticePage = lazy(() => import('@/pages/gate/SmartPracticePage'));
const ContentAdminPage = lazy(() => import('@/pages/gate/ContentAdminPage'));

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sky-500"></div>
  </div>
);

const NotFound = () => (
  <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
    <h1 className="text-4xl font-bold text-surface-400">404</h1>
    <p className="text-surface-500">Page not found</p>
    <a href="/" className="text-sky-400 hover:text-sky-300 underline">Back to Home</a>
  </div>
);

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<GateLayout />}>
          <Route index element={<GateHome />} />
          <Route path="topic/:topicId" element={<TopicPage />} />
          <Route path="practice/:problemId" element={<PracticePage />} />
          <Route path="verify" element={<VerifyPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="notebook" element={<NotebookPage />} />
          <Route path="progress" element={<ProgressPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="onboard" element={<OnboardPage />} />
          <Route path="diagnostic" element={<DiagnosticPage />} />
          <Route path="exam-strategy" element={<ExamStrategyPage />} />
          <Route path="error-patterns" element={<ErrorPatternsPage />} />
          <Route path="audit" element={<StudentAuditPage />} />
          <Route path="digest" element={<WeeklyDigestPage />} />
          <Route path="mock-exam" element={<MockExamPage />} />
          <Route path="admin/gbrain" element={<GBrainAdminPage />} />
          <Route path="gbrain" element={<MarketingLanding />} />
          <Route path="materials" element={<MaterialsPage />} />
          <Route path="smart-practice" element={<SmartPracticePage />} />
          <Route path="admin/content" element={<ContentAdminPage />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
