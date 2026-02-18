/**
 * Stripe Payment Adapter
 * Full Stripe integration with subscriptions, payments, and webhooks
 */

import * as crypto from 'crypto';
import {
  Customer, PaymentMethod, Subscription, Invoice, Payment, Refund,
  PaymentStatus, SubscriptionStatus, Currency, Plan, PlanPrice
} from './types';
import { getPaymentConfig, getProviderCredentials } from './config';

// Stripe API base URL
const STRIPE_API_BASE = 'https://api.stripe.com/v1';

/**
 * Get Stripe API key
 */
function getApiKey(): string {
  const creds = getProviderCredentials('stripe');
  return creds.secretKey;
}

/**
 * Make Stripe API request
 */
async function stripeRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  data?: Record<string, any>
): Promise<T> {
  const url = `${STRIPE_API_BASE}${endpoint}`;
  const apiKey = getApiKey();
  
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': '2023-10-16'
  };
  
  const options: RequestInit = {
    method,
    headers
  };
  
  if (data && method === 'POST') {
    options.body = new URLSearchParams(flattenObject(data)).toString();
  }
  
  const response = await fetch(url, options);
  const json = await response.json() as Record<string, unknown>;
  
  if (!response.ok) {
    const err = json.error as Record<string, unknown> | undefined;
    throw new Error((err?.message as string) || 'Stripe API error');
  }
  
  return json as T;
}

/**
 * Flatten nested object for form encoding
 */
function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}[${key}]` : key;
    
    if (value === null || value === undefined) {
      continue;
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenObject(value, newKey));
    } else if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (typeof item === 'object') {
          Object.assign(result, flattenObject(item, `${newKey}[${index}]`));
        } else {
          result[`${newKey}[${index}]`] = String(item);
        }
      });
    } else {
      result[newKey] = String(value);
    }
  }
  
  return result;
}

// ============ CUSTOMERS ============

export async function createStripeCustomer(customer: Partial<Customer>): Promise<string> {
  const response = await stripeRequest<{ id: string }>('/customers', 'POST', {
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    address: customer.address ? {
      line1: customer.address.line1,
      line2: customer.address.line2,
      city: customer.address.city,
      state: customer.address.state,
      postal_code: customer.address.postalCode,
      country: customer.address.country
    } : undefined,
    metadata: {
      userId: customer.userId,
      organizationId: customer.organizationId,
      ...customer.metadata
    }
  });
  
  return response.id;
}

export async function updateStripeCustomer(
  customerId: string,
  updates: Partial<Customer>
): Promise<void> {
  await stripeRequest(`/customers/${customerId}`, 'POST', {
    email: updates.email,
    name: updates.name,
    phone: updates.phone,
    metadata: updates.metadata
  });
}

export async function deleteStripeCustomer(customerId: string): Promise<void> {
  await stripeRequest(`/customers/${customerId}`, 'DELETE');
}

// ============ PAYMENT METHODS ============

export async function attachPaymentMethod(
  paymentMethodId: string,
  customerId: string
): Promise<void> {
  await stripeRequest(`/payment_methods/${paymentMethodId}/attach`, 'POST', {
    customer: customerId
  });
}

export async function detachPaymentMethod(paymentMethodId: string): Promise<void> {
  await stripeRequest(`/payment_methods/${paymentMethodId}/detach`, 'POST');
}

export async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<void> {
  await stripeRequest(`/customers/${customerId}`, 'POST', {
    invoice_settings: {
      default_payment_method: paymentMethodId
    }
  });
}

export async function listPaymentMethods(customerId: string): Promise<any[]> {
  const response = await stripeRequest<{ data: any[] }>(
    `/payment_methods?customer=${customerId}&type=card`
  );
  return response.data;
}

// ============ SUBSCRIPTIONS ============

export async function createStripeSubscription(
  customerId: string,
  priceId: string,
  options: {
    trialDays?: number;
    couponId?: string;
    paymentMethodId?: string;
  } = {}
): Promise<{ subscriptionId: string; clientSecret?: string }> {
  const params: Record<string, any> = {
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription'
    },
    expand: ['latest_invoice.payment_intent']
  };
  
  if (options.trialDays) {
    params.trial_period_days = options.trialDays;
  }
  
  if (options.couponId) {
    params.coupon = options.couponId;
  }
  
  if (options.paymentMethodId) {
    params.default_payment_method = options.paymentMethodId;
  }
  
  const response = await stripeRequest<{ 
    id: string; 
    latest_invoice: { payment_intent?: { client_secret: string } } 
  }>('/subscriptions', 'POST', params);
  
  return {
    subscriptionId: response.id,
    clientSecret: response.latest_invoice?.payment_intent?.client_secret
  };
}

export async function updateStripeSubscription(
  subscriptionId: string,
  updates: {
    priceId?: string;
    cancelAtPeriodEnd?: boolean;
  }
): Promise<void> {
  const params: Record<string, any> = {};
  
  if (updates.priceId) {
    const sub = await stripeRequest<{ items: { data: [{ id: string }] } }>(
      `/subscriptions/${subscriptionId}`
    );
    params.items = [{
      id: sub.items.data[0].id,
      price: updates.priceId
    }];
    params.proration_behavior = 'create_prorations';
  }
  
  if (updates.cancelAtPeriodEnd !== undefined) {
    params.cancel_at_period_end = updates.cancelAtPeriodEnd;
  }
  
  await stripeRequest(`/subscriptions/${subscriptionId}`, 'POST', params);
}

export async function cancelStripeSubscription(
  subscriptionId: string,
  immediately: boolean = false
): Promise<void> {
  if (immediately) {
    await stripeRequest(`/subscriptions/${subscriptionId}`, 'DELETE');
  } else {
    await stripeRequest(`/subscriptions/${subscriptionId}`, 'POST', {
      cancel_at_period_end: true
    });
  }
}

export async function resumeStripeSubscription(subscriptionId: string): Promise<void> {
  await stripeRequest(`/subscriptions/${subscriptionId}`, 'POST', {
    cancel_at_period_end: false
  });
}

export async function getStripeSubscription(subscriptionId: string): Promise<any> {
  return stripeRequest(`/subscriptions/${subscriptionId}`);
}

// ============ PAYMENTS ============

export async function createPaymentIntent(
  amount: number,
  currency: string,
  customerId: string,
  options: {
    paymentMethodId?: string;
    metadata?: Record<string, string>;
    receiptEmail?: string;
  } = {}
): Promise<{ paymentIntentId: string; clientSecret: string }> {
  const params: Record<string, any> = {
    amount,
    currency: currency.toLowerCase(),
    customer: customerId,
    automatic_payment_methods: { enabled: true },
    metadata: options.metadata
  };
  
  if (options.paymentMethodId) {
    params.payment_method = options.paymentMethodId;
  }
  
  if (options.receiptEmail) {
    params.receipt_email = options.receiptEmail;
  }
  
  const response = await stripeRequest<{ id: string; client_secret: string }>(
    '/payment_intents',
    'POST',
    params
  );
  
  return {
    paymentIntentId: response.id,
    clientSecret: response.client_secret
  };
}

export async function confirmPaymentIntent(
  paymentIntentId: string,
  paymentMethodId: string
): Promise<any> {
  return stripeRequest(`/payment_intents/${paymentIntentId}/confirm`, 'POST', {
    payment_method: paymentMethodId
  });
}

export async function capturePaymentIntent(paymentIntentId: string): Promise<void> {
  await stripeRequest(`/payment_intents/${paymentIntentId}/capture`, 'POST');
}

export async function cancelPaymentIntent(paymentIntentId: string): Promise<void> {
  await stripeRequest(`/payment_intents/${paymentIntentId}/cancel`, 'POST');
}

// ============ REFUNDS ============

export async function createStripeRefund(
  paymentIntentId: string,
  amount?: number,
  reason?: string
): Promise<string> {
  const params: Record<string, any> = {
    payment_intent: paymentIntentId
  };
  
  if (amount) {
    params.amount = amount;
  }
  
  if (reason) {
    params.reason = reason;
  }
  
  const response = await stripeRequest<{ id: string }>('/refunds', 'POST', params);
  return response.id;
}

// ============ INVOICES ============

export async function listInvoices(customerId: string, limit: number = 10): Promise<any[]> {
  const response = await stripeRequest<{ data: any[] }>(
    `/invoices?customer=${customerId}&limit=${limit}`
  );
  return response.data;
}

export async function getInvoice(invoiceId: string): Promise<any> {
  return stripeRequest(`/invoices/${invoiceId}`);
}

export async function payInvoice(invoiceId: string): Promise<void> {
  await stripeRequest(`/invoices/${invoiceId}/pay`, 'POST');
}

// ============ PRODUCTS & PRICES ============

export async function createStripeProduct(plan: Plan): Promise<string> {
  const response = await stripeRequest<{ id: string }>('/products', 'POST', {
    name: plan.name,
    description: plan.description,
    metadata: {
      planId: plan.id,
      tier: plan.tier
    }
  });
  return response.id;
}

export async function createStripePrice(
  productId: string,
  price: PlanPrice
): Promise<string> {
  const params: Record<string, any> = {
    product: productId,
    unit_amount: price.amount,
    currency: price.currency.toLowerCase()
  };
  
  if (price.interval !== 'lifetime') {
    params.recurring = {
      interval: price.interval === 'yearly' ? 'year' : 
                price.interval === 'quarterly' ? 'month' : 'month',
      interval_count: price.interval === 'quarterly' ? 3 : 1
    };
  }
  
  const response = await stripeRequest<{ id: string }>('/prices', 'POST', params);
  return response.id;
}

// ============ COUPONS ============

export async function createStripeCoupon(
  code: string,
  type: 'percent' | 'fixed',
  amount: number,
  currency?: string
): Promise<string> {
  const params: Record<string, any> = {
    id: code
  };
  
  if (type === 'percent') {
    params.percent_off = amount;
  } else {
    params.amount_off = amount;
    params.currency = (currency || 'usd').toLowerCase();
  }
  
  const response = await stripeRequest<{ id: string }>('/coupons', 'POST', params);
  return response.id;
}

// ============ CHECKOUT SESSION ============

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
  options: {
    mode?: 'payment' | 'subscription';
    trialDays?: number;
    couponId?: string;
  } = {}
): Promise<{ sessionId: string; url: string }> {
  const params: Record<string, any> = {
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    mode: options.mode || 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true
  };
  
  if (options.trialDays && options.mode !== 'payment') {
    params.subscription_data = {
      trial_period_days: options.trialDays
    };
  }
  
  if (options.couponId) {
    params.discounts = [{ coupon: options.couponId }];
  }
  
  const response = await stripeRequest<{ id: string; url: string }>(
    '/checkout/sessions',
    'POST',
    params
  );
  
  return {
    sessionId: response.id,
    url: response.url
  };
}

// ============ BILLING PORTAL ============

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const response = await stripeRequest<{ url: string }>(
    '/billing_portal/sessions',
    'POST',
    {
      customer: customerId,
      return_url: returnUrl
    }
  );
  
  return response.url;
}

// ============ WEBHOOKS ============

export function verifyStripeWebhook(
  payload: string | Buffer,
  signature: string
): boolean {
  const creds = getProviderCredentials('stripe');
  const webhookSecret = creds.webhookSecret;
  
  const parts = signature.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
  
  const timestamp = parts['t'];
  const signatures = Object.entries(parts)
    .filter(([k]) => k.startsWith('v1'))
    .map(([_, v]) => v);
  
  // Verify timestamp (within 5 minutes)
  const timestampNum = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampNum) > 300) {
    return false;
  }
  
  // Compute expected signature
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(signedPayload)
    .digest('hex');
  
  return signatures.some(sig => 
    crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSignature))
  );
}

export function parseStripeWebhook(payload: string): {
  type: string;
  data: any;
} {
  const event = JSON.parse(payload);
  return {
    type: event.type,
    data: event.data.object
  };
}

// ============ STATUS MAPPING ============

export function mapStripeSubscriptionStatus(status: string): SubscriptionStatus {
  const mapping: Record<string, SubscriptionStatus> = {
    'trialing': 'trialing',
    'active': 'active',
    'past_due': 'past_due',
    'paused': 'paused',
    'canceled': 'cancelled',
    'unpaid': 'unpaid',
    'incomplete': 'incomplete',
    'incomplete_expired': 'cancelled'
  };
  return mapping[status] || 'incomplete';
}

export function mapStripePaymentStatus(status: string): PaymentStatus {
  const mapping: Record<string, PaymentStatus> = {
    'succeeded': 'succeeded',
    'processing': 'processing',
    'requires_payment_method': 'pending',
    'requires_confirmation': 'pending',
    'requires_action': 'pending',
    'canceled': 'cancelled',
    'requires_capture': 'processing'
  };
  return mapping[status] || 'pending';
}
