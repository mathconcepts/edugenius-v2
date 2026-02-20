// @ts-nocheck
/**
 * chatbot-addons.ts — Razorpay subscription creation for EduGenius chatbot add-ons
 *
 * Add-on plans: WhatsApp Study Bot, Telegram Study Bot, WhatsApp + Telegram Bundle
 * Supports both mock mode (no RAZORPAY_KEY_ID set) and live Razorpay subscriptions.
 */

// ─── Add-on Plans ─────────────────────────────────────────────────────────────

// Add-on plans (match these to actual Razorpay plan IDs once keys are set)
export const CHATBOT_ADDON_PLANS = {
  chatbot_whatsapp: {
    id: 'chatbot_whatsapp',
    name: 'WhatsApp Study Bot',
    description: 'Ask doubts via WhatsApp, get AI answers 24/7',
    priceMonthly: 99,
    currency: 'INR',
    razorpayPlanId: process.env.RAZORPAY_PLAN_WHATSAPP || 'plan_whatsapp_99',
    features: ['Unlimited WhatsApp doubts', 'Formula sheets on demand', 'Daily study reminders']
  },
  chatbot_telegram: {
    id: 'chatbot_telegram',
    name: 'Telegram Study Bot',
    description: 'Full EduGenius tutor on Telegram',
    priceMonthly: 99,
    currency: 'INR',
    razorpayPlanId: process.env.RAZORPAY_PLAN_TELEGRAM || 'plan_telegram_99',
    features: ['Unlimited Telegram doubts', 'Syllabus tracking', 'Mock test links']
  },
  chatbot_all: {
    id: 'chatbot_all',
    name: 'WhatsApp + Telegram Bundle',
    description: 'Both channels at a discount',
    priceMonthly: 149,
    currency: 'INR',
    razorpayPlanId: process.env.RAZORPAY_PLAN_BUNDLE || 'plan_bundle_149',
    features: ['WhatsApp + Telegram access', 'Priority support', 'Parent progress reports']
  }
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddonPurchaseResult {
  success: boolean;
  subscriptionId?: string;
  checkoutUrl?: string;
  error?: string;
}

// ─── Checkout Creation ────────────────────────────────────────────────────────

export async function createAddonCheckout(
  userId: string,
  addonId: keyof typeof CHATBOT_ADDON_PLANS,
  userEmail: string,
  userName: string
): Promise<AddonPurchaseResult> {
  const plan = CHATBOT_ADDON_PLANS[addonId];
  if (!plan) return { success: false, error: 'Invalid add-on' };

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  if (!razorpayKeyId) {
    // Mock mode — return a fake checkout URL for development
    return {
      success: true,
      subscriptionId: `mock_sub_${Date.now()}`,
      checkoutUrl: `/mock-checkout?addon=${addonId}&price=${plan.priceMonthly}`
    };
  }

  // Real Razorpay subscription creation
  try {
    const response = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plan_id: plan.razorpayPlanId,
        total_count: 12,
        quantity: 1,
        customer_notify: 1,
        notes: { userId, addonId }
      })
    });
    const sub = await response.json();
    return { success: true, subscriptionId: sub.id };
  } catch (e) {
    return { success: false, error: 'Payment gateway error' };
  }
}

// ─── Webhook Utilities ────────────────────────────────────────────────────────

export function verifyRazorpayWebhook(body: string, signature: string): boolean {
  const crypto = require('crypto');
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
}

export function extractAddonFromWebhook(payload: any): { userId: string; addonId: string } | null {
  try {
    const notes = payload?.payload?.subscription?.entity?.notes;
    if (notes?.userId && notes?.addonId) {
      return { userId: notes.userId, addonId: notes.addonId };
    }
    return null;
  } catch { return null; }
}
