/**
 * Analytics Module
 * Export all analytics functionality
 */

export {
  initAnalytics,
  getAnalyticsConfig,
  identify,
  reset,
  trackPageView,
  trackEvent,
  trackPurchase,
  trackLearning,
  trackAIInteraction,
  trackSearch,
  trackError,
  defineExperiment,
  getVariant,
  trackExperiment,
  getClientScript
} from './service';

export * from './types';
