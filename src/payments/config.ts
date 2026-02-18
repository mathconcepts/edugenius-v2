// @ts-nocheck
/**
 * Payment Configuration
 * Secure configuration management for payment providers
 */

import { PaymentConfig, PaymentProvider, Currency, PaymentMethodType } from './types';

// Default configuration (override with environment variables)
const defaultConfig: PaymentConfig = {
  providers: {
    stripe: {
      enabled: true,
      publicKey: process.env.STRIPE_PUBLISHABLE_KEY || 'PLACEHOLDER_STRIPE_PUBLISHABLE_KEY',
      secretKey: process.env.STRIPE_SECRET_KEY || 'PLACEHOLDER_STRIPE_SECRET_KEY',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'PLACEHOLDER_STRIPE_WEBHOOK_SECRET'
    },
    razorpay: {
      enabled: true,
      keyId: process.env.RAZORPAY_KEY_ID || 'PLACEHOLDER_RAZORPAY_KEY_ID',
      keySecret: process.env.RAZORPAY_KEY_SECRET || 'PLACEHOLDER_RAZORPAY_KEY_SECRET',
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'PLACEHOLDER_RAZORPAY_WEBHOOK_SECRET'
    }
  },
  defaultCurrency: 'INR',
  defaultProvider: 'razorpay',
  collectTax: true,
  taxRates: [
    { country: 'IN', rate: 18, name: 'GST', inclusive: false },
    { country: 'US', state: 'CA', rate: 9.25, name: 'CA Sales Tax', inclusive: false }
  ],
  enabledPaymentMethods: ['card', 'upi', 'netbanking', 'wallet'],
  enableSubscriptions: true,
  enableOneTimePayments: true,
  enableUsageMetering: true
};

// Active configuration
let activeConfig: PaymentConfig = { ...defaultConfig };

/**
 * Get current payment configuration
 */
export function getPaymentConfig(): PaymentConfig {
  return activeConfig;
}

/**
 * Update payment configuration
 */
export function updatePaymentConfig(updates: Partial<PaymentConfig>): void {
  activeConfig = {
    ...activeConfig,
    ...updates,
    providers: {
      ...activeConfig.providers,
      ...updates.providers
    }
  };
}

/**
 * Check if a provider is configured (not using placeholders)
 */
export function isProviderConfigured(provider: PaymentProvider): boolean {
  const config = activeConfig.providers[provider];
  
  if (provider === 'stripe') {
    return config.enabled && 
           !config.secretKey.includes('PLACEHOLDER');
  }
  
  if (provider === 'razorpay') {
    return config.enabled && 
           !(config as any).keySecret.includes('PLACEHOLDER');
  }
  
  return false;
}

/**
 * Get available providers
 */
export function getAvailableProviders(): PaymentProvider[] {
  const providers: PaymentProvider[] = [];
  
  if (isProviderConfigured('stripe')) {
    providers.push('stripe');
  }
  
  if (isProviderConfigured('razorpay')) {
    providers.push('razorpay');
  }
  
  return providers;
}

/**
 * Get best provider for a currency
 */
export function getBestProviderForCurrency(currency: Currency): PaymentProvider {
  // Razorpay is better for INR
  if (currency === 'INR' && isProviderConfigured('razorpay')) {
    return 'razorpay';
  }
  
  // Stripe for other currencies
  if (isProviderConfigured('stripe')) {
    return 'stripe';
  }
  
  // Fallback
  const available = getAvailableProviders();
  if (available.length > 0) {
    return available[0];
  }
  
  throw new Error('No payment provider configured');
}

/**
 * Get provider credentials (for internal use only)
 */
export function getProviderCredentials(provider: PaymentProvider): Record<string, string> {
  const config = activeConfig.providers[provider];
  
  if (provider === 'stripe') {
    return {
      secretKey: config.secretKey,
      webhookSecret: config.webhookSecret
    };
  }
  
  if (provider === 'razorpay') {
    return {
      keyId: (config as any).keyId,
      keySecret: (config as any).keySecret,
      webhookSecret: config.webhookSecret
    };
  }
  
  throw new Error(`Unknown provider: ${provider}`);
}

/**
 * Get public keys for client-side use
 */
export function getPublicKeys(): Record<string, string> {
  const keys: Record<string, string> = {};
  
  if (activeConfig.providers.stripe.enabled) {
    keys.stripePublishableKey = activeConfig.providers.stripe.publicKey;
  }
  
  if (activeConfig.providers.razorpay.enabled) {
    keys.razorpayKeyId = (activeConfig.providers.razorpay as any).keyId;
  }
  
  return keys;
}

/**
 * Validate configuration
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check at least one provider is configured
  if (!isProviderConfigured('stripe') && !isProviderConfigured('razorpay')) {
    errors.push('At least one payment provider must be configured');
  }
  
  // Validate Stripe config if enabled
  if (activeConfig.providers.stripe.enabled) {
    if (!activeConfig.providers.stripe.publicKey) {
      errors.push('Stripe publishable key is required');
    }
    if (!activeConfig.providers.stripe.secretKey) {
      errors.push('Stripe secret key is required');
    }
  }
  
  // Validate Razorpay config if enabled
  if (activeConfig.providers.razorpay.enabled) {
    const razorpay = activeConfig.providers.razorpay as any;
    if (!razorpay.keyId) {
      errors.push('Razorpay key ID is required');
    }
    if (!razorpay.keySecret) {
      errors.push('Razorpay key secret is required');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Default plans configuration
 */
export const DEFAULT_PLANS = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with basic features',
    tier: 'free' as const,
    features: [
      { name: 'AI Tutor', description: '50 questions/month', included: true, limit: 50 },
      { name: 'Basic Analytics', description: 'Track your progress', included: true },
      { name: 'Community Support', description: 'Join our Discord', included: true }
    ],
    limits: {
      students: 1,
      teachers: 0,
      storage: 100,
      aiCredits: 50,
      exams: 1,
      customContent: false,
      analytics: 'basic' as const,
      support: 'community' as const,
      whiteLabel: false,
      api: false
    },
    isActive: true,
    isPopular: false,
    sortOrder: 0
  },
  {
    id: 'starter',
    name: 'Starter',
    description: 'Perfect for individual learners',
    tier: 'starter' as const,
    features: [
      { name: 'AI Tutor', description: '500 questions/month', included: true, limit: 500 },
      { name: 'Advanced Analytics', description: 'Deep insights', included: true },
      { name: 'Email Support', description: 'Response within 24h', included: true },
      { name: 'Offline Mode', description: 'Learn anywhere', included: true }
    ],
    limits: {
      students: 1,
      teachers: 0,
      storage: 1000,
      aiCredits: 500,
      exams: 3,
      customContent: false,
      analytics: 'advanced' as const,
      support: 'email' as const,
      whiteLabel: false,
      api: false
    },
    isActive: true,
    isPopular: true,
    sortOrder: 1
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For serious learners and small teams',
    tier: 'pro' as const,
    features: [
      { name: 'AI Tutor', description: 'Unlimited questions', included: true, limit: -1 },
      { name: 'Full Analytics', description: 'Complete insights', included: true },
      { name: 'Priority Support', description: 'Response within 4h', included: true },
      { name: 'Custom Content', description: 'Upload your materials', included: true },
      { name: 'API Access', description: 'Build integrations', included: true }
    ],
    limits: {
      students: 10,
      teachers: 2,
      storage: 10000,
      aiCredits: -1,
      exams: -1,
      customContent: true,
      analytics: 'full' as const,
      support: 'priority' as const,
      whiteLabel: false,
      api: true
    },
    isActive: true,
    isPopular: false,
    sortOrder: 2
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For schools and coaching centers',
    tier: 'enterprise' as const,
    features: [
      { name: 'Everything in Pro', description: 'All Pro features', included: true },
      { name: 'Unlimited Students', description: 'Scale without limits', included: true, limit: -1 },
      { name: 'White Label', description: 'Your branding', included: true },
      { name: 'Dedicated Support', description: 'Personal account manager', included: true },
      { name: 'Custom Integrations', description: 'Connect your systems', included: true }
    ],
    limits: {
      students: -1,
      teachers: -1,
      storage: -1,
      aiCredits: -1,
      exams: -1,
      customContent: true,
      analytics: 'full' as const,
      support: 'dedicated' as const,
      whiteLabel: true,
      api: true
    },
    isActive: true,
    isPopular: false,
    sortOrder: 3
  }
];

/**
 * Default pricing (INR)
 */
export const DEFAULT_PRICES = {
  starter: {
    monthly: 49900, // ₹499
    yearly: 479900   // ₹4,799 (20% off)
  },
  pro: {
    monthly: 149900, // ₹1,499
    yearly: 1439900  // ₹14,399 (20% off)
  },
  enterprise: {
    monthly: 499900, // ₹4,999
    yearly: 4799900  // ₹47,999 (20% off)
  }
};
