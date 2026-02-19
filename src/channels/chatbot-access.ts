/**
 * ChatbotAccessService
 * 
 * Central gating layer for chatbot channel access.
 * 
 * ACCESS MODEL:
 * ─────────────────────────────────────────────────────────────────
 * Plan               Portal   WhatsApp   Telegram   Meet
 * ─────────────────────────────────────────────────────────────────
 * Free               ✅       ❌         ❌         ❌
 * Pro (₹499/mo)      ✅       Add-on     Add-on     ❌
 * Premium (₹999/mo)  ✅       ✅         ✅         ❌ (2/mo)
 * Elite (₹1499/mo)   ✅       ✅         ✅         ✅ (4/mo)
 * ─────────────────────────────────────────────────────────────────
 * 
 * Add-ons (Pro tier):
 *   WhatsApp Access:  ₹99/mo  (single channel)
 *   Telegram Access:  ₹99/mo  (single channel)
 *   All Chatbots:     ₹149/mo (WhatsApp + Telegram)
 * ─────────────────────────────────────────────────────────────────
 * 
 * Agents impacted:
 *   Mentor     — checks entitlement before sending WhatsApp/Telegram messages
 *   Sage       — checks before delivering tutoring sessions via chatbot
 *   Herald     — checks before outreach campaigns use chatbot channels
 *   Nexus      — checks before routing support tickets to chatbot
 *   RevenueArchitect — uses entitlement data for upsell targeting
 *   Oracle     — tracks chatbot engagement metrics by plan tier
 */

import type { Channel } from './types';

// ─── Plan definitions ────────────────────────────────────────────────────────

export type PlanId = 'free' | 'pro' | 'premium' | 'elite';
export type AddOnId = 'chatbot_whatsapp' | 'chatbot_telegram' | 'chatbot_all';
export type ChatbotChannel = 'whatsapp' | 'telegram' | 'meet';

export interface PlanChannelEntitlement {
  planId: PlanId;
  planName: string;
  portalAccess: true;             // always true — portal is base product
  whatsappAccess: boolean;
  telegramAccess: boolean;
  meetSessions: number;           // 0 = no access, N = N sessions/month
  addOnsAllowed: boolean;         // Pro only — can purchase add-ons
}

export interface ChatbotAddOn {
  id: AddOnId;
  name: string;
  channels: ChatbotChannel[];
  priceMonthly: number;
  priceYearly: number;
  eligiblePlans: PlanId[];        // only Pro can buy add-ons
  description: string;
}

export const PLAN_ENTITLEMENTS: Record<PlanId, PlanChannelEntitlement> = {
  free: {
    planId: 'free',
    planName: 'Free',
    portalAccess: true,
    whatsappAccess: false,
    telegramAccess: false,
    meetSessions: 0,
    addOnsAllowed: false,
  },
  pro: {
    planId: 'pro',
    planName: 'Pro',
    portalAccess: true,
    whatsappAccess: false,       // requires add-on
    telegramAccess: false,       // requires add-on
    meetSessions: 0,
    addOnsAllowed: true,
  },
  premium: {
    planId: 'premium',
    planName: 'Premium',
    portalAccess: true,
    whatsappAccess: true,
    telegramAccess: true,
    meetSessions: 2,
    addOnsAllowed: false,
  },
  elite: {
    planId: 'elite',
    planName: 'Elite',
    portalAccess: true,
    whatsappAccess: true,
    telegramAccess: true,
    meetSessions: 4,
    addOnsAllowed: false,
  },
};

export const CHATBOT_ADD_ONS: ChatbotAddOn[] = [
  {
    id: 'chatbot_whatsapp',
    name: 'WhatsApp Access',
    channels: ['whatsapp'],
    priceMonthly: 99,
    priceYearly: 799,
    eligiblePlans: ['pro'],
    description: 'Study via WhatsApp — ask doubts, get reminders, practice MCQs — all in your favourite app.',
  },
  {
    id: 'chatbot_telegram',
    name: 'Telegram Access',
    channels: ['telegram'],
    priceMonthly: 99,
    priceYearly: 799,
    eligiblePlans: ['pro'],
    description: 'Full AI tutor experience on Telegram — rich media, inline quizzes, and formula rendering.',
  },
  {
    id: 'chatbot_all',
    name: 'All Chatbots',
    channels: ['whatsapp', 'telegram'],
    priceMonthly: 149,
    priceYearly: 1199,
    eligiblePlans: ['pro'],
    description: 'Access EduGenius on both WhatsApp and Telegram. Best value for mobile-first learners.',
  },
];

// ─── Student channel profile ─────────────────────────────────────────────────

export interface StudentChannelProfile {
  userId: string;

  // Active plan
  planId: PlanId;
  activeAddOns: AddOnId[];

  // Connected chatbot accounts (set during channel linking)
  whatsappNumber?: string;        // E.164 format e.g. +919876543210
  whatsappLinkedAt?: Date;
  whatsappVerified: boolean;

  telegramUserId?: string;        // numeric Telegram user ID
  telegramUsername?: string;
  telegramLinkedAt?: Date;
  telegramVerified: boolean;

  // Meet sessions this month
  meetSessionsUsed: number;
  meetSessionsLimit: number;

  // Usage stats (for Oracle)
  chatbotInteractionsThisMonth: number;
  preferredChannel: Channel;
  lastChatbotActivityAt?: Date;
}

// ─── Access check result ─────────────────────────────────────────────────────

export interface ChannelAccessResult {
  allowed: boolean;
  channel: ChatbotChannel;
  reason: 'plan_includes' | 'addon_active' | 'no_plan' | 'no_addon' | 'not_linked' | 'session_limit_reached';
  upgradeHint?: {
    addOnId?: AddOnId;
    suggestedPlan?: PlanId;
    message: string;
    ctaLabel: string;
    ctaUrl: string;
  };
}

// ─── Core access service ─────────────────────────────────────────────────────

export class ChatbotAccessService {
  /**
   * Check whether a student can use a chatbot channel right now.
   * Called by Mentor, Sage, Herald, Nexus before sending any chatbot message.
   */
  static checkAccess(
    profile: StudentChannelProfile,
    channel: ChatbotChannel
  ): ChannelAccessResult {
    const entitlement = PLAN_ENTITLEMENTS[profile.planId];

    // ── Meet sessions ────────────────────────────────────────────────────────
    if (channel === 'meet') {
      if (entitlement.meetSessions === 0) {
        return {
          allowed: false,
          channel,
          reason: 'no_plan',
          upgradeHint: {
            suggestedPlan: 'premium',
            message: 'Google Meet sessions are available on Premium and Elite plans.',
            ctaLabel: 'Upgrade to Premium',
            ctaUrl: '/website/pricing?highlight=premium',
          },
        };
      }
      if (profile.meetSessionsUsed >= entitlement.meetSessions) {
        return {
          allowed: false,
          channel,
          reason: 'session_limit_reached',
          upgradeHint: {
            suggestedPlan: 'elite',
            message: `You've used all ${entitlement.meetSessions} Meet sessions this month. Upgrade to Elite for 4 sessions/month.`,
            ctaLabel: 'Upgrade to Elite',
            ctaUrl: '/website/pricing?highlight=elite',
          },
        };
      }
      return { allowed: true, channel, reason: 'plan_includes' };
    }

    // ── WhatsApp ─────────────────────────────────────────────────────────────
    if (channel === 'whatsapp') {
      const hasBaseAccess = entitlement.whatsappAccess;
      const hasAddOn = profile.activeAddOns.some(
        a => a === 'chatbot_whatsapp' || a === 'chatbot_all'
      );

      if (!hasBaseAccess && !hasAddOn) {
        return {
          allowed: false,
          channel,
          reason: entitlement.addOnsAllowed ? 'no_addon' : 'no_plan',
          upgradeHint: entitlement.addOnsAllowed
            ? {
                addOnId: 'chatbot_whatsapp',
                message: 'Add WhatsApp access to your Pro plan for just ₹99/month.',
                ctaLabel: 'Add WhatsApp — ₹99/mo',
                ctaUrl: '/settings/billing?addon=chatbot_whatsapp',
              }
            : {
                suggestedPlan: 'premium',
                message: 'WhatsApp access is included in Premium and Elite plans.',
                ctaLabel: 'Upgrade to Premium',
                ctaUrl: '/website/pricing?highlight=premium',
              },
        };
      }

      if (!profile.whatsappVerified) {
        return {
          allowed: false,
          channel,
          reason: 'not_linked',
          upgradeHint: {
            message: 'Link your WhatsApp number to start chatting with your AI tutor there.',
            ctaLabel: 'Link WhatsApp',
            ctaUrl: '/settings/channels',
          },
        };
      }

      return { allowed: true, channel, reason: hasBaseAccess ? 'plan_includes' : 'addon_active' };
    }

    // ── Telegram ─────────────────────────────────────────────────────────────
    if (channel === 'telegram') {
      const hasBaseAccess = entitlement.telegramAccess;
      const hasAddOn = profile.activeAddOns.some(
        a => a === 'chatbot_telegram' || a === 'chatbot_all'
      );

      if (!hasBaseAccess && !hasAddOn) {
        return {
          allowed: false,
          channel,
          reason: entitlement.addOnsAllowed ? 'no_addon' : 'no_plan',
          upgradeHint: entitlement.addOnsAllowed
            ? {
                addOnId: 'chatbot_telegram',
                message: 'Add Telegram access to your Pro plan for just ₹99/month.',
                ctaLabel: 'Add Telegram — ₹99/mo',
                ctaUrl: '/settings/billing?addon=chatbot_telegram',
              }
            : {
                suggestedPlan: 'premium',
                message: 'Telegram access is included in Premium and Elite plans.',
                ctaLabel: 'Upgrade to Premium',
                ctaUrl: '/website/pricing?highlight=premium',
              },
        };
      }

      if (!profile.telegramVerified) {
        return {
          allowed: false,
          channel,
          reason: 'not_linked',
          upgradeHint: {
            message: 'Link your Telegram account to start chatting with your AI tutor there.',
            ctaLabel: 'Link Telegram',
            ctaUrl: '/settings/channels',
          },
        };
      }

      return { allowed: true, channel, reason: hasBaseAccess ? 'plan_includes' : 'addon_active' };
    }

    return { allowed: false, channel, reason: 'no_plan' };
  }

  /**
   * Get all channel access results for a student in one call.
   * Used by Mentor agent's lifecycle rule engine and Oracle for reporting.
   */
  static getFullAccess(profile: StudentChannelProfile): {
    whatsapp: ChannelAccessResult;
    telegram: ChannelAccessResult;
    meet: ChannelAccessResult;
  } {
    return {
      whatsapp: this.checkAccess(profile, 'whatsapp'),
      telegram: this.checkAccess(profile, 'telegram'),
      meet: this.checkAccess(profile, 'meet'),
    };
  }

  /**
   * Which channels can this student receive outreach on right now?
   * Used by Herald + Nexus lifecycle rules to skip unavailable channels.
   */
  static getAllowedOutreachChannels(profile: StudentChannelProfile): Channel[] {
    const channels: Channel[] = ['web']; // web/in-app always allowed
    if (this.checkAccess(profile, 'whatsapp').allowed) channels.push('whatsapp');
    if (this.checkAccess(profile, 'telegram').allowed) channels.push('telegram');
    return channels;
  }

  /**
   * Describe a plan's chatbot entitlement as a human-readable string.
   * Used in pricing comparisons and upgrade modals.
   */
  static describePlanAccess(planId: PlanId): string {
    const e = PLAN_ENTITLEMENTS[planId];
    const parts: string[] = ['Portal (web app)'];
    if (e.whatsappAccess) parts.push('WhatsApp');
    if (e.telegramAccess) parts.push('Telegram');
    if (e.meetSessions > 0) parts.push(`Google Meet (${e.meetSessions}/month)`);
    if (e.addOnsAllowed) parts.push('+ Chatbot add-ons available');
    return parts.join(' · ');
  }

  /**
   * Upsell opportunities for Oracle / RevenueArchitect.
   * Returns students who have portal access but unused chatbot entitlement
   * or who are on Free/Pro and would benefit from an upgrade.
   */
  static getUpsellSegment(
    profiles: StudentChannelProfile[],
    targetChannel: ChatbotChannel
  ): { userId: string; reason: string; suggestedAction: string }[] {
    return profiles
      .map(p => {
        const result = this.checkAccess(p, targetChannel);
        if (!result.allowed && result.upgradeHint) {
          return {
            userId: p.userId,
            reason: result.reason,
            suggestedAction: result.upgradeHint.message,
          };
        }
        return null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }
}
