// @ts-nocheck
/**
 * webhook-handler.ts — Razorpay webhook processing for EduGenius billing events
 *
 * Handles subscription.activated, subscription.cancelled, subscription.completed
 * and emits typed events onto the EventBus for downstream agent processing.
 */

import { verifyRazorpayWebhook, extractAddonFromWebhook } from './chatbot-addons';
import { EventBus } from '../events/event-bus';

// ─── Webhook Handler ──────────────────────────────────────────────────────────

export async function handleRazorpayWebhook(
  rawBody: string,
  signature: string,
  eventBus: EventBus
): Promise<{ status: number; message: string }> {
  // Verify signature
  if (!verifyRazorpayWebhook(rawBody, signature)) {
    return { status: 400, message: 'Invalid signature' };
  }

  const payload = JSON.parse(rawBody);
  const event = payload.event;

  if (event === 'subscription.activated') {
    const info = extractAddonFromWebhook(payload);
    if (info) {
      // Emit event for Mentor/Nexus agent to update user profile
      eventBus.emit('billing:addon_activated', {
        userId: info.userId,
        addonId: info.addonId,
        subscriptionId: payload?.payload?.subscription?.entity?.id,
        activatedAt: new Date().toISOString()
      });
    }
  }

  if (event === 'subscription.cancelled' || event === 'subscription.completed') {
    const info = extractAddonFromWebhook(payload);
    if (info) {
      eventBus.emit('billing:addon_cancelled', {
        userId: info.userId,
        addonId: info.addonId
      });
    }
  }

  return { status: 200, message: 'OK' };
}
