import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles/globals.css';
import { initPlaybookUpdater } from './services/playbookProgressiveUpdater';

// Initialise Course Playbook progressive updater
// Non-blocking — seeds default playbooks and wires all agent hooks
try { initPlaybookUpdater(); } catch { /* graceful fallback */ }

// Apply saved theme immediately to prevent flash of wrong theme
(function applyInitialTheme() {
  try {
    const stored = localStorage.getItem('edugenius-storage');
    const parsed = stored ? JSON.parse(stored) : null;
    const theme = parsed?.state?.theme ?? 'dark';
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch {
    document.documentElement.classList.add('dark'); // default: dark
  }
})();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
