/**
 * channelBotHandler.ts — Inbound Bot Message Router
 *
 * When a WhatsApp or Telegram message arrives:
 * 1. Identify the user by phone/chatId → getUserByChannelId()
 * 2. If unknown → trigger linking flow (send them their EG-XXXXXX link code)
 * 3. Validate channel access (isChannelAllowed)
 * 4. Validate exam subscription (active subscription?)
 * 5. Compute MCP privileges for this session
 * 6. Build the RouterQuery with the user's allowed sources
 * 7. Call resolveKnowledge() with filtered sources
 * 8. Adapt response via channelAdapter.ts
 *
 * In production this runs server-side; frontend simulates the routing logic.
 */

import {
  getUserByChannelId,
  getFilteredSources,
  isChannelAllowed,
  EXAM_CATALOG,
  type EGUser,
  type ExamSubscription,
  type MCPPrivileges,
  type ChannelAccess,
} from './userService';
import { generateChannelToken } from './authService';
import { resolveKnowledgeForUser } from './knowledgeRouter';
import { CHANNEL_CAPS, type ChannelCapabilities } from './channelAdapter';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InboundBotMessage {
  channel: 'whatsapp' | 'telegram';
  channelUserId: string;    // phone (WhatsApp) or chat_id (Telegram)
  channelUsername?: string; // Telegram @username
  text: string;
  attachments?: string[];
  timestamp: string;
  messageId: string;
}

export interface BotSessionContext {
  user: EGUser | null;
  isAuthenticated: boolean;
  activeExam: ExamSubscription | null;
  mcpPrivileges: MCPPrivileges;
  channelCapabilities: ChannelCapabilities;
}

export interface BotResponse {
  text: string;
  channel: 'whatsapp' | 'telegram';
  to: string;
  quickReplies?: string[];
  buttons?: { text: string; payload: string }[];
  mediaUrl?: string;
}

const DEFAULT_MCP: MCPPrivileges = {
  allowedSources: ['static-pyq-bundle', 'llm-fallback'],
  wolframEnabled: false,
  customMcpEnabled: false,
  externalApiEnabled: false,
  ragEnabled: false,
  maxKnowledgeSources: 1,
};

// ─── Session Builder ──────────────────────────────────────────────────────────

export function buildBotSession(msg: InboundBotMessage): BotSessionContext {
  const user = getUserByChannelId(msg.channel, msg.channelUserId) ?? null;
  const caps = CHANNEL_CAPS[msg.channel] as ChannelCapabilities;

  if (!user) {
    return {
      user: null,
      isAuthenticated: false,
      activeExam: null,
      mcpPrivileges: DEFAULT_MCP,
      channelCapabilities: caps,
    };
  }

  // Find active exam (prefer preferred exam, else first active)
  const activeExams = user.examSubscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trial'
  );
  const preferred = user.preferences.preferredExamId
    ? activeExams.find((s) => s.examId === user.preferences.preferredExamId)
    : null;
  const activeExam = preferred ?? activeExams[0] ?? null;

  return {
    user,
    isAuthenticated: true,
    activeExam,
    mcpPrivileges: user.mcpPrivileges,
    channelCapabilities: caps,
  };
}

// ─── Command Handler ──────────────────────────────────────────────────────────

export function handleCommand(text: string, session: BotSessionContext): BotResponse | null {
  const cmd = text.trim().toLowerCase().split(/\s+/)[0];
  const { user } = session;

  switch (cmd) {
    case '/start': {
      if (!user) {
        return null; // Will be handled by linking flow
      }
      const examList = EXAM_CATALOG.map((e) => `${e.emoji} ${e.name}`).join('\n');
      return {
        text: `🎓 *Welcome back, ${user.name}!*\n\nYour EduGenius ID: \`${user.uid}\`\n\nAvailable exams:\n${examList}\n\nType /exam to switch your active exam, or just ask me any question!`,
        channel: session.channelCapabilities === CHANNEL_CAPS.telegram ? 'telegram' : 'whatsapp',
        to: user.channelAccess.telegramChatId ?? user.channelAccess.whatsappPhone ?? '',
        quickReplies: ['/exam', '/status', '/help'],
      };
    }

    case '/exam': {
      if (!user) return null;
      const active = user.examSubscriptions.filter(
        (s) => s.status === 'active' || s.status === 'trial'
      );
      if (active.length === 0) {
        return {
          text: '📚 You have no active exam subscriptions.\n\nVisit https://edugenius-ui.netlify.app to subscribe to an exam.',
          channel: 'whatsapp',
          to: user.channelAccess.whatsappPhone ?? user.channelAccess.telegramChatId ?? '',
          buttons: [{ text: '🌐 Subscribe Now', payload: 'https://edugenius-ui.netlify.app/users' }],
        };
      }
      const examList = active.map((s) => `${s.examName} (${s.plan})`).join('\n');
      const current = session.activeExam ? `Current: *${session.activeExam.examName}*\n\n` : '';
      return {
        text: `${current}Your subscribed exams:\n${examList}\n\nReply with the exam name to switch.`,
        channel: 'telegram',
        to: user.channelAccess.telegramChatId ?? user.channelAccess.whatsappPhone ?? '',
        buttons: active.map((s) => ({ text: s.examName, payload: `/setexam ${s.examId}` })),
      };
    }

    case '/status': {
      if (!user) return null;
      const subs = user.examSubscriptions;
      if (subs.length === 0) {
        return {
          text: `📋 *Account Status*\nID: ${user.uid}\nRole: ${user.role}\nStatus: ${user.status}\n\nNo exam subscriptions yet.`,
          channel: 'telegram',
          to: user.channelAccess.telegramChatId ?? user.channelAccess.whatsappPhone ?? '',
        };
      }
      const subList = subs
        .map(
          (s) =>
            `• ${s.examName} — ${s.plan.toUpperCase()} (${s.status}${s.expiresAt ? ', expires ' + s.expiresAt.slice(0, 10) : ''})`
        )
        .join('\n');
      return {
        text: `📋 *Account Status*\nID: ${user.uid}\nName: ${user.name}\nStatus: ${user.status}\n\n*Subscriptions:*\n${subList}`,
        channel: 'telegram',
        to: user.channelAccess.telegramChatId ?? user.channelAccess.whatsappPhone ?? '',
        quickReplies: ['/exam', '/help'],
      };
    }

    case '/help': {
      const to = user?.channelAccess.telegramChatId ?? user?.channelAccess.whatsappPhone ?? session.channelCapabilities === CHANNEL_CAPS.telegram ? 'telegram' : 'whatsapp';
      return {
        text: `🤖 *EduGenius Bot Commands*\n\n/start — Welcome & show exams\n/exam — Switch active exam\n/status — View subscription status\n/help — Show this help\n\nOr just type any question and I'll help you study! 📚`,
        channel: 'telegram',
        to: String(to),
        quickReplies: ['/start', '/exam', '/status'],
      };
    }

    default:
      return null;
  }
}

// ─── Linking Flow ─────────────────────────────────────────────────────────────

export function buildLinkingFlow(
  channel: 'whatsapp' | 'telegram',
  channelUserId: string
): BotResponse {
  const token = generateChannelToken(channel, channelUserId);
  const platformName = channel === 'whatsapp' ? 'WhatsApp' : 'Telegram';

  return {
    text:
      `👋 Welcome to *EduGenius*! 🎓\n\n` +
      `I don't recognize your ${platformName} account yet.\n\n` +
      `To get started:\n` +
      `1. Visit https://edugenius-ui.netlify.app/login\n` +
      `2. Enter your linking code: *${token}*\n` +
      `3. Come back and start learning!\n\n` +
      `Your code expires in 30 minutes.`,
    channel,
    to: channelUserId,
    buttons: [
      { text: '🔗 Link Account', payload: `https://edugenius-ui.netlify.app/login?token=${token}&channel=${channel}` },
    ],
  };
}

// ─── Exam Selection Prompt ────────────────────────────────────────────────────

export function buildExamSelectionPrompt(user: EGUser): string {
  const active = user.examSubscriptions.filter(
    (s) => s.status === 'active' || s.status === 'trial'
  );
  if (active.length === 0) {
    return `Hi ${user.name}! 👋 You don't have any active exam subscriptions yet. Visit EduGenius to subscribe.`;
  }
  const examList = active.map((s) => `• ${s.examName} (${s.plan})`).join('\n');
  return `Hi ${user.name}! 👋 Which exam would you like to study for today?\n\n${examList}\n\nJust tell me your exam name to begin!`;
}

// ─── Main Route to Sage ───────────────────────────────────────────────────────

export async function routeToSage(
  msg: InboundBotMessage,
  session: BotSessionContext
): Promise<BotResponse> {
  const { user, activeExam, mcpPrivileges } = session;
  const to =
    msg.channel === 'telegram'
      ? user?.channelAccess.telegramChatId ?? msg.channelUserId
      : user?.channelAccess.whatsappPhone ?? msg.channelUserId;

  if (!user || !activeExam) {
    const text = user ? buildExamSelectionPrompt(user) : 'Please link your account first.';
    return { text, channel: msg.channel, to };
  }

  try {
    const filteredSources = getFilteredSources(user);
    const kResult = await resolveKnowledgeForUser(
      {
        text: msg.text,
        examId: activeExam.examId,
        sessionId: `bot-${msg.channel}-${msg.channelUserId}`,
      },
      filteredSources
    );

    let responseText = kResult.answer;

    // Append source attribution on channel if verified
    if (kResult.verified && kResult.citations?.length) {
      responseText += `\n\n📚 Source: ${kResult.citations[0]}`;
    }

    // Channel-specific formatting
    if (msg.channel === 'whatsapp') {
      // Strip markdown for WhatsApp
      responseText = responseText.replace(/\*\*/g, '*').replace(/#{1,6} /g, '');
    }

    // Append plan upgrade nudge for free users
    if (mcpPrivileges.maxKnowledgeSources <= 1 && !kResult.verified) {
      responseText += '\n\n💡 _Upgrade to Pro for Wolfram-verified answers!_';
    }

    return {
      text: responseText,
      channel: msg.channel,
      to,
      quickReplies: ['/status', '/exam', '/help'],
    };
  } catch {
    return {
      text: `Sorry, I couldn't process your question right now. Please try again! 🙏\n\nFor study help, visit https://edugenius-ui.netlify.app`,
      channel: msg.channel,
      to,
    };
  }
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

export async function handleBotMessage(msg: InboundBotMessage): Promise<BotResponse> {
  const session = buildBotSession(msg);
  const { user } = session;

  // 1. Unknown user → linking flow
  if (!user) {
    if (msg.text.trim() === '/start') {
      return buildLinkingFlow(msg.channel, msg.channelUserId);
    }
    return buildLinkingFlow(msg.channel, msg.channelUserId);
  }

  // 2. Channel access check
  const channelKey = msg.channel as keyof ChannelAccess;
  if (!isChannelAllowed(user, channelKey)) {
    const to =
      msg.channel === 'telegram'
        ? user.channelAccess.telegramChatId ?? msg.channelUserId
        : user.channelAccess.whatsappPhone ?? msg.channelUserId;
    return {
      text: `Your account doesn't have ${msg.channel} access enabled. Please contact your admin or visit EduGenius to enable it.`,
      channel: msg.channel,
      to,
    };
  }

  // 3. Command handling
  const commandResponse = handleCommand(msg.text, session);
  if (commandResponse) return commandResponse;

  // 4. Route to Sage for knowledge queries
  return routeToSage(msg, session);
}
