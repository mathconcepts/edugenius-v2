/**
 * Razorpay Payment Adapter
 * Full Razorpay integration with subscriptions, payments, and webhooks
 */

import * as crypto from 'crypto';
import {
  Customer, Payment, Subscription, PaymentStatus, SubscriptionStatus, Currency
} from './types';
import { getProviderCredentials } from './config';

// Razorpay API base URL
const RAZORPAY_API_BASE = 'https://api.razorpay.com/v1';

/**
 * Get Razorpay credentials
 */
function getCredentials(): { keyId: string; keySecret: string } {
  const creds = getProviderCredentials('razorpay');
  return {
    keyId: creds.keyId,
    keySecret: creds.keySecret
  };
}

/**
 * Make Razorpay API request
 */
async function razorpayRequest<T>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  data?: Record<string, any>
): Promise<T> {
  const { keyId, keySecret } = getCredentials();
  const url = `${RAZORPAY_API_BASE}${endpoint}`;
  
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  
  const headers: Record<string, string> = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json'
  };
  
  const options: RequestInit = {
    method,
    headers
  };
  
  if (data && (method === 'POST' || method === 'PATCH')) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(url, options);
  const json = await response.json();
  
  if (!response.ok) {
    throw new Error(json.error?.description || 'Razorpay API error');
  }
  
  return json as T;
}

// ============ CUSTOMERS ============

export async function createRazorpayCustomer(customer: Partial<Customer>): Promise<string> {
  const response = await razorpayRequest<{ id: string }>('/customers', 'POST', {
    name: customer.name,
    email: customer.email,
    contact: customer.phone,
    notes: {
      userId: customer.userId,
      organizationId: customer.organizationId,
      ...customer.metadata
    }
  });
  
  return response.id;
}

export async function updateRazorpayCustomer(
  customerId: string,
  updates: Partial<Customer>
): Promise<void> {
  await razorpayRequest(`/customers/${customerId}`, 'PATCH', {
    name: updates.name,
    email: updates.email,
    contact: updates.phone
  });
}

// ============ ORDERS ============

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export async function createRazorpayOrder(
  amount: number,
  currency: string,
  receipt: string,
  notes?: Record<string, string>
): Promise<RazorpayOrder> {
  return razorpayRequest<RazorpayOrder>('/orders', 'POST', {
    amount,
    currency,
    receipt,
    notes
  });
}

export async function getRazorpayOrder(orderId: string): Promise<RazorpayOrder> {
  return razorpayRequest<RazorpayOrder>(`/orders/${orderId}`);
}

// ============ PAYMENTS ============

export async function getRazorpayPayment(paymentId: string): Promise<any> {
  return razorpayRequest(`/payments/${paymentId}`);
}

export async function captureRazorpayPayment(
  paymentId: string,
  amount: number,
  currency: string
): Promise<any> {
  return razorpayRequest(`/payments/${paymentId}/capture`, 'POST', {
    amount,
    currency
  });
}

export async function refundRazorpayPayment(
  paymentId: string,
  amount?: number,
  notes?: Record<string, string>
): Promise<string> {
  const data: Record<string, any> = {};
  if (amount) data.amount = amount;
  if (notes) data.notes = notes;
  
  const response = await razorpayRequest<{ id: string }>(
    `/payments/${paymentId}/refund`,
    'POST',
    data
  );
  
  return response.id;
}

// ============ SUBSCRIPTIONS ============

export async function createRazorpayPlan(
  name: string,
  amount: number,
  currency: string,
  interval: 'daily' | 'weekly' | 'monthly' | 'yearly',
  period: number = 1
): Promise<string> {
  const response = await razorpayRequest<{ id: string }>('/plans', 'POST', {
    period: interval,
    interval: period,
    item: {
      name,
      amount,
      currency
    }
  });
  
  return response.id;
}

export async function createRazorpaySubscription(
  customerId: string,
  planId: string,
  options: {
    totalCount?: number;
    startAt?: number;
    expireBy?: number;
    customerNotify?: boolean;
    notes?: Record<string, string>;
  } = {}
): Promise<{ subscriptionId: string; shortUrl: string }> {
  const response = await razorpayRequest<{ id: string; short_url: string }>(
    '/subscriptions',
    'POST',
    {
      plan_id: planId,
      customer_id: customerId,
      total_count: options.totalCount || 12,
      start_at: options.startAt,
      expire_by: options.expireBy,
      customer_notify: options.customerNotify !== false ? 1 : 0,
      notes: options.notes
    }
  );
  
  return {
    subscriptionId: response.id,
    shortUrl: response.short_url
  };
}

export async function getRazorpaySubscription(subscriptionId: string): Promise<any> {
  return razorpayRequest(`/subscriptions/${subscriptionId}`);
}

export async function cancelRazorpaySubscription(
  subscriptionId: string,
  cancelAtCycleEnd: boolean = true
): Promise<void> {
  await razorpayRequest(`/subscriptions/${subscriptionId}/cancel`, 'POST', {
    cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0
  });
}

export async function pauseRazorpaySubscription(subscriptionId: string): Promise<void> {
  await razorpayRequest(`/subscriptions/${subscriptionId}/pause`, 'POST', {
    pause_at: 'now'
  });
}

export async function resumeRazorpaySubscription(subscriptionId: string): Promise<void> {
  await razorpayRequest(`/subscriptions/${subscriptionId}/resume`, 'POST', {
    resume_at: 'now'
  });
}

export async function updateRazorpaySubscription(
  subscriptionId: string,
  planId: string,
  options: {
    remainingCount?: number;
    startImmediately?: boolean;
  } = {}
): Promise<void> {
  await razorpayRequest(`/subscriptions/${subscriptionId}`, 'PATCH', {
    plan_id: planId,
    remaining_count: options.remainingCount,
    schedule_change_at: options.startImmediately ? 'now' : 'cycle_end'
  });
}

// ============ INVOICES ============

export async function createRazorpayInvoice(
  customerId: string,
  lineItems: Array<{ name: string; amount: number; quantity: number }>,
  options: {
    description?: string;
    currency?: string;
    expireBy?: number;
  } = {}
): Promise<{ invoiceId: string; shortUrl: string }> {
  const response = await razorpayRequest<{ id: string; short_url: string }>(
    '/invoices',
    'POST',
    {
      customer_id: customerId,
      type: 'invoice',
      description: options.description,
      currency: options.currency || 'INR',
      expire_by: options.expireBy,
      line_items: lineItems.map(item => ({
        name: item.name,
        amount: item.amount,
        quantity: item.quantity
      }))
    }
  );
  
  return {
    invoiceId: response.id,
    shortUrl: response.short_url
  };
}

export async function getRazorpayInvoice(invoiceId: string): Promise<any> {
  return razorpayRequest(`/invoices/${invoiceId}`);
}

export async function cancelRazorpayInvoice(invoiceId: string): Promise<void> {
  await razorpayRequest(`/invoices/${invoiceId}/cancel`, 'POST');
}

// ============ PAYMENT LINKS ============

export async function createPaymentLink(
  amount: number,
  currency: string,
  options: {
    description?: string;
    customerId?: string;
    expireBy?: number;
    callbackUrl?: string;
    callbackMethod?: 'get' | 'post';
    notes?: Record<string, string>;
  } = {}
): Promise<{ linkId: string; shortUrl: string }> {
  const response = await razorpayRequest<{ id: string; short_url: string }>(
    '/payment_links',
    'POST',
    {
      amount,
      currency,
      description: options.description,
      customer: options.customerId ? { customer_id: options.customerId } : undefined,
      expire_by: options.expireBy,
      callback_url: options.callbackUrl,
      callback_method: options.callbackMethod,
      notes: options.notes
    }
  );
  
  return {
    linkId: response.id,
    shortUrl: response.short_url
  };
}

// ============ VIRTUAL ACCOUNTS ============

export async function createVirtualAccount(
  customerId: string,
  receivers: Array<'bank_account' | 'qr_code' | 'vpa'>,
  options: {
    description?: string;
    closeBy?: number;
  } = {}
): Promise<any> {
  return razorpayRequest('/virtual_accounts', 'POST', {
    customer_id: customerId,
    receivers: { types: receivers },
    description: options.description,
    close_by: options.closeBy
  });
}

// ============ WEBHOOKS ============

export function verifyRazorpayWebhook(
  payload: string | Buffer,
  signature: string
): boolean {
  const creds = getProviderCredentials('razorpay');
  const webhookSecret = creds.webhookSecret;
  
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(typeof payload === 'string' ? payload : payload.toString())
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const { keySecret } = getCredentials();
  
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

export function parseRazorpayWebhook(payload: string): {
  event: string;
  data: any;
} {
  const body = JSON.parse(payload);
  return {
    event: body.event,
    data: body.payload
  };
}

// ============ STATUS MAPPING ============

export function mapRazorpaySubscriptionStatus(status: string): SubscriptionStatus {
  const mapping: Record<string, SubscriptionStatus> = {
    'created': 'incomplete',
    'authenticated': 'incomplete',
    'active': 'active',
    'pending': 'past_due',
    'halted': 'unpaid',
    'cancelled': 'cancelled',
    'completed': 'cancelled',
    'expired': 'cancelled',
    'paused': 'paused'
  };
  return mapping[status] || 'incomplete';
}

export function mapRazorpayPaymentStatus(status: string): PaymentStatus {
  const mapping: Record<string, PaymentStatus> = {
    'created': 'pending',
    'authorized': 'processing',
    'captured': 'succeeded',
    'refunded': 'refunded',
    'failed': 'failed'
  };
  return mapping[status] || 'pending';
}

// ============ SETTLEMENT ============

export async function getSettlements(
  options: { from?: number; to?: number; count?: number } = {}
): Promise<any[]> {
  const params = new URLSearchParams();
  if (options.from) params.set('from', options.from