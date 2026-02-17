/**
 * Payment Types
 * Multi-provider payment system (Stripe, Razorpay)
 */

// Payment providers
export type PaymentProvider = 'stripe' | 'razorpay';

// Currency codes
export type Currency = 'USD' | 'EUR' | 'GBP' | 'INR' | 'AUD' | 'CAD' | 'SGD';

// Payment status
export type PaymentStatus = 
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'cancelled';

// Subscription status
export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'cancelled'
  | 'unpaid'
  | 'incomplete';

// Billing interval
export type BillingInterval = 'monthly' | 'quarterly' | 'yearly' | 'lifetime';

// Plan tier
export type PlanTier = 'free' | 'starter' | 'pro' | 'enterprise';

/**
 * Product/Plan definition
 */
export interface Plan {
  id: string;
  name: string;
  description: string;
  tier: PlanTier;
  
  // Pricing
  prices: PlanPrice[];
  
  // Features
  features: PlanFeature[];
  limits: PlanLimits;
  
  // Metadata
  isActive: boolean;
  isPopular: boolean;
  sortOrder: number;
  
  // Provider IDs
  stripeProductId?: string;
  razorpayPlanId?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface PlanPrice {
  id: string;
  planId: string;
  
  amount: number; // In smallest unit (cents/paise)
  currency: Currency;
  interval: BillingInterval;
  
  // Trial
  trialDays: number;
  
  // Provider IDs
  stripePriceId?: string;
  razorpayPlanId?: string;
  
  isActive: boolean;
}

export interface PlanFeature {
  name: string;
  description: string;
  included: boolean;
  limit?: number; // -1 = unlimited
}

export interface PlanLimits {
  students: number; // -1 = unlimited
  teachers: number;
  storage: number; // MB, -1 = unlimited
  aiCredits: number; // Monthly AI credits
  exams: number;
  customContent: boolean;
  analytics: 'basic' | 'advanced' | 'full';
  support: 'community' | 'email' | 'priority' | 'dedicated';
  whiteLabel: boolean;
  api: boolean;
}

/**
 * Customer (billing entity)
 */
export interface Customer {
  id: string;
  userId: string;
  organizationId: string;
  
  // Contact
  email: string;
  name: string;
  phone?: string;
  
  // Billing address
  address?: BillingAddress;
  
  // Tax
  taxId?: string;
  taxExempt: boolean;
  
  // Provider IDs
  stripeCustomerId?: string;
  razorpayCustomerId?: string;
  
  // Default payment method
  defaultPaymentMethodId?: string;
  
  // Metadata
  metadata: Record<string, string>;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2
}

/**
 * Payment method
 */
export interface PaymentMethod {
  id: string;
  customerId: string;
  
  type: PaymentMethodType;
  provider: PaymentProvider;
  
  // Card details (if card)
  card?: CardDetails;
  
  // UPI details (if UPI)
  upi?: UPIDetails;
  
  // Bank details (if bank transfer)
  bank?: BankDetails;
  
  // Status
  isDefault: boolean;
  isValid: boolean;
  
  // Provider IDs
  stripePaymentMethodId?: string;
  razorpayTokenId?: string;
  
  createdAt: Date;
  expiresAt?: Date;
}

export type PaymentMethodType = 
  | 'card'
  | 'upi'
  | 'netbanking'
  | 'wallet'
  | 'bank_transfer'
  | 'ach'
  | 'sepa';

export interface CardDetails {
  brand: string; // visa, mastercard, amex, etc.
  last4: string;
  expMonth: number;
  expYear: number;
  funding: 'credit' | 'debit' | 'prepaid';
  country?: string;
}

export interface UPIDetails {
  vpa: string; // Virtual Payment Address
}

export interface BankDetails {
  bankName: string;
  accountLast4: string;
  accountType?: string;
}

/**
 * Subscription
 */
export interface Subscription {
  id: string;
  customerId: string;
  planId: string;
  priceId: string;
  
  // Status
  status: SubscriptionStatus;
  
  // Billing
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAt?: Date;
  cancelledAt?: Date;
  
  // Trial
  trialStart?: Date;
  trialEnd?: Date;
  
  // Payment
  defaultPaymentMethodId?: string;
  
  // Provider IDs
  stripeSubscriptionId?: string;
  razorpaySubscriptionId?: string;
  
  // Metadata
  metadata: Record<string, string>;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Invoice
 */
export interface Invoice {
  id: string;
  customerId: string;
  subscriptionId?: string;
  
  // Amount
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  currency: Currency;
  
  // Status
  status: InvoiceStatus;
  
  // Line items
  lineItems: InvoiceLineItem[];
  
  // Dates
  invoiceDate: Date;
  dueDate: Date;
  paidAt?: Date;
  
  // PDF
  invoicePdf?: string;
  hostedInvoiceUrl?: string;
  
  // Provider IDs
  stripeInvoiceId?: string;
  razorpayInvoiceId?: string;
  
  createdAt: Date;
}

export type InvoiceStatus =
  | 'draft'
  | 'open'
  | 'paid'
  | 'void'
  | 'uncollectible';

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  taxRate?: number;
  periodStart?: Date;
  periodEnd?: Date;
}

/**
 * Payment/Charge
 */
export interface Payment {
  id: string;
  customerId: string;
  subscriptionId?: string;
  invoiceId?: string;
  
  // Amount
  amount: number;
  currency: Currency;
  
  // Status
  status: PaymentStatus;
  
  // Method
  paymentMethodId?: string;
  paymentMethodType: PaymentMethodType;
  
  // Provider
  provider: PaymentProvider;
  
  // Provider IDs
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  
  // Failure
  failureCode?: string;
  failureMessage?: string;
  
  // Receipt
  receiptEmail?: string;
  receiptUrl?: string;
  
  // Refund
  refundedAmount: number;
  
  // Metadata
  metadata: Record<string, string>;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Refund
 */
export interface Refund {
  id: string;
  paymentId: string;
  
  amount: number;
  currency: Currency;
  reason: RefundReason;
  status: RefundStatus;
  
  // Provider IDs
  stripeRefundId?: string;
  razorpayRefundId?: string;
  
  createdAt: Date;
}

export type RefundReason =
  | 'duplicate'
  | 'fraudulent'
  | 'requested_by_customer'
  | 'other';

export type RefundStatus =
  | 'pending'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

/**
 * Webhook event
 */
export interface WebhookEvent {
  id: string;
  provider: PaymentProvider;
  type: string;
  data: Record<string, unknown>;
  processed: boolean;
  processedAt?: Date;
  error?: string;
  createdAt: Date;
}

/**
 * Usage record (for metered billing)
 */
export interface UsageRecord {
  id: string;
  subscriptionId: string;
  metric: string;
  quantity: number;
  timestamp: Date;
  
  // Provider sync
  stripeUsageRecordId?: string;
}

/**
 * Coupon/Promo code
 */
export interface Coupon {
  id: string;
  code: string;
  
  // Discount
  type: 'percent' | 'fixed';
  amount: number; // Percentage or fixed amount
  currency?: Currency; // Required for fixed
  
  // Limits
  maxRedemptions?: number;
  timesRedeemed: number;
  
  // Validity
  validFrom: Date;
  validUntil?: Date;
  
  // Restrictions
  applicablePlans: string[]; // Empty = all plans
  firstTimeOnly: boolean;
  
  // Provider IDs
  stripeCouponId?: string;
  
  isActive: boolean;
  createdAt: Date;
}

/**
 * Payment configuration
 */
export interface PaymentConfig {
  // Provider settings
  providers: {
    stripe: {
      enabled: boolean;
      publicKey: string;
      secretKey: string;
      webhookSecret: string;
    };
    razorpay: {
      enabled: boolean;
      keyId: string;
      keySecret: string;
      webhookSecret: string;
    };
  };
  
  // Default settings
  defaultCurrency: Currency;
  defaultProvider: PaymentProvider;
  
  // Tax settings
  collectTax: boolean;
  taxRates: TaxRate[];
  
  // Feature flags
  enabledPaymentMethods: PaymentMethodType[];
  enableSubscriptions: boolean;
  enableOneTimePayments: boolean;
  enableUsageMetering: boolean;
}

export interface TaxRate {
  country: string;
  state?: string;
  rate: number; // Percentage
  name: string;
  inclusive: boolean;
}
