/**
 * Payment Module
 * Export all payment functionality
 */

// Core service
export {
  createCustomer,
  getCustomer,
  getCustomerByUserId,
  updateCustomer,
  createSubscription,
  getSubscription,
  getActiveSubscription,
  cancelSubscription,
  changeSubscriptionPlan,
  createPayment,
  getPayment,
  refundPayment,
  createCheckoutSession,
  createBillingPortalSession,
  handleWebhook,
  getPlans,
  getPlan,
  setEventBus
} from './service';

// Types
export * from './types';

// Configuration
export {
  getPaymentConfig,
  updatePaymentConfig,
  isProviderConfigured,
  getAvailableProviders,
  getBestProviderForCurrency,
  getPublicKeys,
  validateConfig,
  DEFAULT_PLANS,
  DEFAULT_PRICES
} from './config';

// Provider adapters (for direct access if needed)
export * as stripeAdapter from './stripe-adapter';
export * as razorpayAdapter from './razorpay-adapter';
