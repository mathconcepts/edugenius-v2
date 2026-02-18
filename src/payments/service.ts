// @ts-nocheck
/**
 * Payment Service
 * Unified payment operations across providers
 */

import * as crypto from 'crypto';
import {
  Customer, PaymentMethod, Subscription, Invoice, Payment, Refund, Plan, PlanPrice,
  PaymentProvider, PaymentStatus, SubscriptionStatus, Currency, WebhookEvent
} from './types';
import {
  getPaymentConfig, isProviderConfigured, getBestProviderForCurrency,
  DEFAULT_PLANS, DEFAULT_PRICES
} from './config';
import * as stripe from './stripe-adapter';
import * as razorpay from './razorpay-adapter';
import { EventBus } from '../events/event-bus';

// In-memory stores (replace with database in production)
const customers = new Map<string, Customer>();
const subscriptions = new Map<string, Subscription>();
const payments = new Map<string, Payment>();
const invoices = new Map<string, Invoice>();
const plans = new Map<string, Plan>();
const webhookEvents = new Map<string, WebhookEvent>();

// Event bus
let eventBus: EventBus | null = null;

export function setEventBus(bus: EventBus): void {
  eventBus = bus;
}

// Initialize default plans
DEFAULT_PLANS.forEach(plan => {
  plans.set(plan.id, {
    ...plan,
    prices: [],
    createdAt: new Date(),
    updatedAt: new Date()
  } as Plan);
});

function generateId(prefix: string = ''): string {
  return `${prefix}${crypto.randomBytes(12).toString('hex')}`;
}

// ============ CUSTOMERS ============

export async function createCustomer(
  userId: string,
  organizationId: string,
  data: {
    email: string;
    name: string;
    phone?: string;
  }
): Promise<Customer> {
  const customerId = generateId('cus_');
  
  const customer: Customer = {
    id: customerId,
    userId,
    organizationId,
    email: data.email,
    name: data.name,
    phone: data.phone,
    taxExempt: false,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  // Create in payment providers
  if (isProviderConfigured('stripe')) {
    customer.stripeCustomerId = await stripe.createStripeCustomer(customer);
  }
  
  if (isProviderConfigured('razorpay')) {
    customer.razorpayCustomerId = await razorpay.createRazorpayCustomer(customer);
  }
  
  customers.set(customerId, customer);
  
  // Emit event
  if (eventBus) {
    await eventBus.publish({
      id: generateId('evt_'),
      type: 'payment.customer.created',
      source: 'payment-service',
      data: { customerId, userId, email: data.email },
      timestamp: Date.now(),
      version: '1.0'
    });
  }
  
  return customer;
}

export async function getCustomer(customerId: string): Promise<Customer | null> {
  return customers.get(customerId) || null;
}

export async function getCustomerByUserId(userId: string): Promise<Customer | null> {
  return Array.from(customers.values()).find(c => c.userId === userId) || null;
}

export async function updateCustomer(
  customerId: string,
  updates: Partial<Customer>
): Promise<Customer> {
  const customer = customers.get(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }
  
  const updated: Customer = {
    ...customer,
    ...updates,
    updatedAt: new Date()
  };
  
  // Update in providers
  if (customer.stripeCustomerId) {
    await stripe.updateStripeCustomer(customer.stripeCustomerId, updates);
  }
  
  if (customer.razorpayCustomerId) {
    await razorpay.updateRazorpayCustomer(customer.razorpayCustomerId, updates);
  }
  
  customers.set(customerId, updated);
  return updated;
}

// ============ SUBSCRIPTIONS ============

export async function createSubscription(
  customerId: string,
  planId: string,
  interval: 'monthly' | 'yearly',
  options: {
    currency?: Currency;
    trialDays?: number;
    couponId?: string;
    paymentMethodId?: string;
  } = {}
): Promise<{ subscription: Subscription; clientSecret?: string; paymentUrl?: string }> {
  const customer = customers.get(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }
  
  const plan = plans.get(planId);
  if (!plan) {
    throw new Error('Plan not found');
  }
  
  const currency = options.currency || getPaymentConfig().defaultCurrency;
  const provider = getBestProviderForCurrency(currency);
  
  const subscriptionId = generateId('sub_');
  const now = new Date();
  
  let providerSubscriptionId: string | undefined;
  let clientSecret: string | undefined;
  let paymentUrl: string | undefined;
  
  // Get price ID for the plan and interval
  const price = plan.prices.find(p => p.interval === interval && p.currency === currency);
  
  if (provider === 'stripe' && customer.stripeCustomerId) {
    const stripePriceId = price?.stripePriceId || `price_${planId}_${interval}`;
    const result = await stripe.createStripeSubscription(
      customer.stripeCustomerId,
      stripePriceId,
      {
        trialDays: options.trialDays,
        couponId: options.couponId,
        paymentMethodId: options.paymentMethodId
      }
    );
    providerSubscriptionId = result.subscriptionId;
    clientSecret = result.clientSecret;
  } else if (provider === 'razorpay' && customer.razorpayCustomerId) {
    const razorpayPlanId = price?.razorpayPlanId || `plan_${planId}_${interval}`;
    const result = await razorpay.createRazorpaySubscription(
      customer.razorpayCustomerId,
      razorpayPlanId,
      { notes: { subscriptionId } }
    );
    providerSubscriptionId = result.subscriptionId;
    paymentUrl = result.shortUrl;
  }
  
  const subscription: Subscription = {
    id: subscriptionId,
    customerId,
    planId,
    priceId: price?.id || `${planId}_${interval}`,
    status: options.trialDays ? 'trialing' : 'incomplete',
    currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + (interval === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000),
    trialStart: options.trialDays ? now : undefined,
    trialEnd: options.trialDays ? new Date(now.getTime() + options.trialDays * 24 * 60 * 60 * 1000) : undefined,
    stripeSubscriptionId: provider === 'stripe' ? providerSubscriptionId : undefined,
    razorpaySubscriptionId: provider === 'razorpay' ? providerSubscriptionId : undefined,
    metadata: {},
    createdAt: now,
    updatedAt: now
  };
  
  subscriptions.set(subscriptionId, subscription);
  
  // Emit event
  if (eventBus) {
    await eventBus.publish({
      id: generateId('evt_'),
      type: 'payment.subscription.created',
      source: 'payment-service',
      data: { subscriptionId, customerId, planId, status: subscription.status },
      timestamp: Date.now(),
      version: '1.0'
    });
  }
  
  return { subscription, clientSecret, paymentUrl };
}

export async function getSubscription(subscriptionId: string): Promise<Subscription | null> {
  return subscriptions.get(subscriptionId) || null;
}

export async function getActiveSubscription(customerId: string): Promise<Subscription | null> {
  return Array.from(subscriptions.values()).find(
    s => s.customerId === customerId && ['active', 'trialing'].includes(s.status)
  ) || null;
}

export async function cancelSubscription(
  subscriptionId: string,
  immediately: boolean = false
): Promise<Subscription> {
  const subscription = subscriptions.get(subscriptionId);
  if (!subscription) {
    throw new Error('Subscription not found');
  }
  
  // Cancel in provider
  if (subscription.stripeSubscriptionId) {
    await stripe.cancelStripeSubscription(subscription.stripeSubscriptionId, immediately);
  } else if (subscription.razorpaySubscriptionId) {
    await razorpay.cancelRazorpaySubscription(subscription.razorpaySubscriptionId, !immediately);
  }
  
  const updated: Subscription = {
    ...subscription,
    status: immediately ? 'cancelled' : subscription.status,
    cancelAt: immediately ? new Date() : subscription.currentPeriodEnd,
    cancelledAt: new Date(),
    updatedAt: new Date()
  };
  
  subscriptions.set(subscriptionId, updated);
  
  // Emit event
  if (eventBus) {
    await eventBus.publish({
      id: generateId('evt_'),
      type: 'payment.subscription.cancelled',
      source: 'payment-service',
      data: { subscriptionId, immediately },
      timestamp: Date.now(),
      version: '1.0'
    });
  }
  
  return updated;
}

export async function changeSubscriptionPlan(
  subscriptionId: string,
  newPlanId: string,
  newInterval: 'monthly' | 'yearly'
): Promise<Subscription> {
  const subscription = subscriptions.get(subscriptionId);
  if (!subscription) {
    throw new Error('Subscription not found');
  }
  
  const newPlan = plans.get(newPlanId);
  if (!newPlan) {
    throw new Error('Plan not found');
  }
  
  // Update in provider
  if (subscription.stripeSubscriptionId) {
    const newPrice = newPlan.prices.find(p => p.interval === newInterval);
    if (newPrice?.stripePriceId) {
      await stripe.updateStripeSubscription(subscription.stripeSubscriptionId, {
        priceId: newPrice.stripePriceId
      });
    }
  } else if (subscription.razorpaySubscriptionId) {
    const newPrice = newPlan.prices.find(p => p.interval === newInterval);
    if (newPrice?.razorpayPlanId) {
      await razorpay.updateRazorpaySubscription(
        subscription.razorpaySubscriptionId,
        newPrice.razorpayPlanId
      );
    }
  }
  
  const updated: Subscription = {
    ...subscription,
    planId: newPlanId,
    priceId: `${newPlanId}_${newInterval}`,
    updatedAt: new Date()
  };
  
  subscriptions.set(subscriptionId, updated);
  
  return updated;
}

// ============ PAYMENTS ============

export async function createPayment(
  customerId: string,
  amount: number,
  currency: Currency,
  options: {
    description?: string;
    subscriptionId?: string;
    metadata?: Record<string, string>;
  } = {}
): Promise<{ payment: Payment; clientSecret?: string; paymentUrl?: string }> {
  const customer = customers.get(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }
  
  const provider = getBestProviderForCurrency(currency);
  const paymentId = generateId('pay_');
  
  let clientSecret: string | undefined;
  let paymentUrl: string | undefined;
  let providerPaymentId: string | undefined;
  let providerOrderId: string | undefined;
  
  if (provider === 'stripe' && customer.stripeCustomerId) {
    const result = await stripe.createPaymentIntent(
      amount,
      currency,
      customer.stripeCustomerId,
      { metadata: options.metadata }
    );
    providerPaymentId = result.paymentIntentId;
    clientSecret = result.clientSecret;
  } else if (provider === 'razorpay' && customer.razorpayCustomerId) {
    const order = await razorpay.createRazorpayOrder(
      amount,
      currency,
      paymentId,
      options.metadata
    );
    providerOrderId = order.id;
  }
  
  const payment: Payment = {
    id: paymentId,
    customerId,
    subscriptionId: options.subscriptionId,
    amount,
    currency,
    status: 'pending',
    paymentMethodType: 'card',
    provider,
    stripePaymentIntentId: providerPaymentId,
    razorpayOrderId: providerOrderId,
    refundedAmount: 0,
    metadata: options.metadata || {},
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  payments.set(paymentId, payment);
  
  return { payment, clientSecret, paymentUrl };
}

export async function getPayment(paymentId: string): Promise<Payment | null> {
  return payments.get(paymentId) || null;
}

export async function refundPayment(
  paymentId: string,
  amount?: number,
  reason?: string
): Promise<Refund> {
  const payment = payments.get(paymentId);
  if (!payment) {
    throw new Error('Payment not found');
  }
  
  if (payment.status !== 'succeeded') {
    throw new Error('Can only refund successful payments');
  }
  
  const refundAmount = amount || payment.amount;
  let providerRefundId: string | undefined;
  
  if (payment.stripePaymentIntentId) {
    providerRefundId = await stripe.createStripeRefund(
      payment.stripePaymentIntentId,
      refundAmount,
      reason
    );
  } else if (payment.razorpayPaymentId) {
    providerRefundId = await razorpay.refundRazorpayPayment(
      payment.razorpayPaymentId,
      refundAmount
    );
  }
  
  const refund: Refund = {
    id: generateId('ref_'),
    paymentId,
    amount: refundAmount,
    currency: payment.currency,
    reason: (reason as any) || 'requested_by_customer',
    status: 'pending',
    stripeRefundId: payment.provider === 'stripe' ? providerRefundId : undefined,
    razorpayRefundId: payment.provider === 'razorpay' ? providerRefundId : undefined,
    createdAt: new Date()
  };
  
  // Update payment
  payment.refundedAmount += refundAmount;
  payment.status = payment.refundedAmount >= payment.amount ? 'refunded' : 'partially_refunded';
  payment.updatedAt = new Date();
  payments.set(paymentId, payment);
  
  // Emit event
  if (eventBus) {
    await eventBus.publish({
      id: generateId('evt_'),
      type: 'payment.refunded',
      source: 'payment-service',
      data: { paymentId, refundId: refund.id, amount: refundAmount },
      timestamp: Date.now(),
      version: '1.0'
    });
  }
  
  return refund;
}

// ============ CHECKOUT ============

export async function createCheckoutSession(
  customerId: string,
  planId: string,
  interval: 'monthly' | 'yearly',
  successUrl: string,
  cancelUrl: string
): Promise<{ sessionId?: string; url: string }> {
  const customer = customers.get(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }
  
  const plan = plans.get(planId);
  if (!plan) {
    throw new Error('Plan not found');
  }
  
  // Prefer Stripe for checkout
  if (customer.stripeCustomerId && isProviderConfigured('stripe')) {
    const price = plan.prices.find(p => p.interval === interval);
    const result = await stripe.createCheckoutSession(
      customer.stripeCustomerId,
      price?.stripePriceId || `price_${planId}_${interval}`,
      successUrl,
      cancelUrl
    );
    return { sessionId: result.sessionId, url: result.url };
  }
  
  // Fallback to Razorpay payment link
  if (customer.razorpayCustomerId && isProviderConfigured('razorpay')) {
    const price = plan.prices.find(p => p.interval === interval);
    const result = await razorpay.createPaymentLink(
      price?.amount || 0,
      'INR',
      {
        description: `${plan.name} - ${interval}`,
        customerId: customer.razorpayCustomerId,
        callbackUrl: successUrl
      }
    );
    return { url: result.shortUrl };
  }
  
  throw new Error('No payment provider configured');
}

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const customer = customers.get(customerId);
  if (!customer) {
    throw new Error('Customer not found');
  }
  
  if (customer.stripeCustomerId && isProviderConfigured('stripe')) {
    return stripe.createBillingPortalSession(customer.stripeCustomerId, returnUrl);
  }
  
  throw new Error('Billing portal only available with Stripe');
}

// ============ WEBHOOKS ============

export async function handleWebhook(
  provider: PaymentProvider,
  payload: string,
  signature: string
): Promise<void> {
  // Verify signature
  let isValid = false;
  if (provider === 'stripe') {
    isValid = stripe.verifyStripeWebhook(payload, signature);
  } else if (provider === 'razorpay') {
    isValid = razorpay.verifyRazorpayWebhook(payload, signature);
  }
  
  if (!isValid) {
    throw new Error('Invalid webhook signature');
  }
  
  // Parse event
  let eventType: string;
  let eventData: any;
  
  if (provider === 'stripe') {
    const parsed = stripe.parseStripeWebhook(payload);
    eventType = parsed.type;
    eventData = parsed.data;
  } else {
    const parsed = razorpay.parseRazorpayWebhook(payload);
    eventType = parsed.event;
    eventData = parsed.data;
  }
  
  // Store event
  const webhookEvent: WebhookEvent = {
    id: generateId('wh_'),
    provider,
    type: eventType,
    data: eventData,
    processed: false,
    createdAt: new Date()
  };
  webhookEvents.set(webhookEvent.id, webhookEvent);
  
  // Process event
  try {
    await processWebhookEvent(provider, eventType, eventData);
    webhookEvent.processed = true;
    webhookEvent.processedAt = new Date();
  } catch (error) {
    webhookEvent.error = error instanceof Error ? error.message : 'Unknown error';
  }
  
  webhookEvents.set(webhookEvent.id, webhookEvent);
}

async function processWebhookEvent(
  provider: PaymentProvider,
  eventType: string,
  data: any
): Promise<void> {
  // Handle Stripe events
  if (provider === 'stripe') {
    switch (eventType) {
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await syncStripeSubscription(data);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(data);
        break;
      case 'invoice.payment_failed':
        await handlePaymentFailed(data);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded('stripe', data.id);
        break;
    }
  }
  
  // Handle Razorpay events
  if (provider === 'razorpay') {
    switch (eventType) {
      case 'subscription.activated':
      case 'subscription.completed':
      case 'subscription.cancelled':
        await syncRazorpaySubscription(data.subscription?.entity);
        break;
      case 'payment.captured':
        await handlePaymentSucceeded('razorpay', data.payment?.entity?.id);
        break;
      case 'payment.failed':
        await handlePaymentFailed(data.payment?.entity);
        break;
    }
  }
}

async function syncStripeSubscription(stripeSubscription: any): Promise<void> {
  const subscription = Array.from(subscriptions.values()).find(
    s => s.stripeSubscriptionId === stripeSubscription.id
  );
  
  if (!subscription) return;
  
  subscription.status = stripe.mapStripeSubscriptionStatus(stripeSubscription.status);
  subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
  subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
  subscription.updatedAt = new Date();
  
  subscriptions.set(subscription.id, subscription);
}

async function syncRazorpaySubscription(razorpaySubscription: any): Promise<void> {
  if (!razorpaySubscription) return;
  
  const subscription = Array.from(subscriptions.values()).find(
    s => s.razorpaySubscriptionId === razorpaySubscription.id
  );
  
  if (!subscription) return;
  
  subscription.status = razorpay.mapRazorpaySubscriptionStatus(razorpaySubscription.status);
  subscription.updatedAt = new Date();
  
  subscriptions.set(subscription.id, subscription);
}

async function handleInvoicePaid(invoice: any): Promise<void> {
  // Update subscription status if applicable
  if (invoice.subscription) {
    const subscription = Array.from(subscriptions.values()).find(
      s => s.stripeSubscriptionId === invoice.subscription
    );
    
    if (subscription) {
      subscription.status = 'active';
      subscription.updatedAt = new Date();
      subscriptions.set(subscription.id, subscription);
    }
  }
}

async function handlePaymentSucceeded(provider: PaymentProvider, providerPaymentId: string): Promise<void> {
  const payment = Array.from(payments.values()).find(p => 
    (provider === 'stripe' && p.stripePaymentIntentId === providerPaymentId) ||
    (provider === 'razorpay' && p.razorpayPaymentId === providerPaymentId)
  );
  
  if (payment) {
    payment.status = 'succeeded';
    payment.updatedAt = new Date();
    payments.set(payment.id, payment);
  }
}

async function handlePaymentFailed(data: any): Promise<void> {
  // Handle payment failure - notify customer, retry, etc.
  if (eventBus) {
    await eventBus.publish({
      id: generateId('evt_'),
      type: 'payment.failed',
      source: 'payment-service',
      data,
      timestamp: Date.now(),
      version: '1.0'
    });
  }
}

// ============ PLANS ============

export function getPlans(): Plan[] {
  return Array.from(plans.values()).filter(p => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getPlan(planId: string): Plan | null {
  return plans.get(planId) || null;
}

// Export types
export * from './types';
