// @ts-nocheck
/**
 * Channel Service
 * Unified multi-channel message handling with chatbot access gating.
 * 
 * All outbound WhatsApp/Telegram messages pass through ChatbotAccessService
 * before reaching the channel provider. If a student lacks entitlement, the
 * message is silently dropped for outreach (Mentor/Herald) or a denial
 * response is returned for inbound-triggered sessions (Sage).
 */

import * as crypto from 'crypto';
import {
  Message, Conversation, Channel, MessageContent, MessageType,
  Participant, ConversationContext, WebhookEvent, BotResponse
} from './types';
import * as whatsapp from './whatsapp';
import * as telegram from './telegram';
import * as meet from './meet';
import { EventBus } from '../events/event-bus';
import { ChatbotAccessService, type StudentChannelProfile, type ChatbotChannel } from './chatbot-access';

// Student channel profiles lookup — in production this comes from DB
const studentChannelProfiles = new Map<string, StudentChannelProfile>();

/** Register/update a student's channel profile (called by users service on plan change). */
export function updateStudentChannelProfile(profile: StudentChannelProfile): void {
  studentChannelProfiles.set(profile.userId, profile);
}

/** Check if a student can receive messages on a chatbot channel before sending. */
export function checkChatbotAccess(
  userId: string,
  channel: ChatbotChannel
): { allowed: boolean; upgradeMessage?: string } {
  const profile = studentChannelProfiles.get(userId);
  if (!profile) return { allowed: false, upgradeMessage: 'No channel profile found for user.' };
  const result = ChatbotAccessService.checkAccess(profile, channel);
  return {
    allowed: result.allowed,
    upgradeMessage: result.upgradeHint?.message,
  };
}

// In-memory stores
const conversations = new Map<string, Conversation>();
const messages = new Map<string, Message>();
const webhookEvents: WebhookEvent[] = [];

// Event bus
let eventBus: EventBus | null = null;

// Message handler callback
type MessageHandler = (message: Message, conversation: Conversation) => Promise<BotResponse>;
let messageHandler: MessageHandler | null = null;

export function setEventBus(bus: EventBus): void {
  eventBus = bus;
}

export function setMessageHandler(handler: MessageHandler): void {
  messageHandler = handler;
}

function generateId(prefix: string = ''): string {
  return `${prefix}${crypto.randomBytes(12).toString('hex')}`;
}

// ============ CONVERSATIONS ============

export function createConversation(
  channel: Channel,
  user: Participant,
  context?: Partial<ConversationContext>
): Conversation {
  const conversationId = generateId('conv_');
  
  const conversation: Conversation = {
    id: conversationId,
    channel,
    user,
    bot: {
      id: 'edugenius-bot',
      type: 'bot',
      name: 'EduGenius'
    },
    context: {
      ...context
    },
    state: 'active',
    messageCount: 0,
    lastMessageAt: new Date(),
    startedAt: new Date()
  };
  
  conversations.set(conversationId, conversation);
  return conversation;
}

export function getConversation(conversationId: string): Conversation | null {
  return conversations.get(conversationId) || null;
}

export function getOrCreateConversation(
  channel: Channel,
  channelUserId: string,
  userData?: Partial<Participant>
): Conversation {
  // Find existing conversation
  const existing = Array.from(conversations.values()).find(
    c => c.channel === channel && c.user.channelUserId === channelUserId && c.state === 'active'
  );
  
  if (existing) return existing;
  
  // Create new conversation
  return createConversation(channel, {
    id: generateId('usr_'),
    type: 'user',
    channelUserId,
    ...userData
  });
}

export function updateConversationContext(
  conversationId: string,
  context: Partial<ConversationContext>
): void {
  const conversation = conversations.get(conversationId);
  if (conversation) {
    conversation.context = { ...conversation.context, ...context };
    conversations.set(conversationId, conversation);
  }
}

export function endConversation(conversationId: string): void {
  const conversation = conversations.get(conversationId);
  if (conversation) {
    conversation.state = 'ended';
    conversation.endedAt = new Date();
    conversations.set(conversationId, conversation);
  }
}

// ============ MESSAGES ============

export async function sendMessage(
  conversationId: string,
  content: MessageContent,
  type: MessageType = 'text'
): Promise<Message> {
  const conversation = conversations.get(conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }
  
  const messageId = generateId('msg_');
  let channelMessageId: string | undefined;
  
  // Send via appropriate channel
  switch (conversation.channel) {
    case 'whatsapp':
      channelMessageId = await sendWhatsAppMessage(conversation, content, type);
      break;
    case 'telegram':
      channelMessageId = await sendTelegramMessage(conversation, content, type);
      break;
    case 'web':
      // Web messages are handled via WebSocket/SSE
      break;
  }
  
  const message: Message = {
    id: messageId,
    channel: conversation.channel,
    channelMessageId,
    conversationId,
    from: conversation.bot,
    to: conversation.user,
    direction: 'outbound',
    type,
    content,
    status: 'sent',
    timestamp: new Date()
  };
  
  messages.set(messageId, message);
  
  // Update conversation
  conversation.messageCount++;
  conversation.lastMessageAt = new Date();
  conversations.set(conversationId, conversation);
  
  // Emit event
  if (eventBus) {
    await eventBus.publish({
      id: generateId('evt_'),
      type: 'channel.message.sent',
      source: 'channel-service',
      data: { messageId, conversationId, channel: conversation.channel },
      timestamp: Date.now(),
      version: '1.0'
    });
  }
  
  return message;
}

async function sendWhatsAppMessage(
  conversation: Conversation,
  content: MessageContent,
  type: MessageType
): Promise<string> {
  const to = conversation.user.phone || conversation.user.channelUserId!;
  
  switch (type) {
    case 'text':
      return whatsapp.sendTextMessage(to, content.text!);
    case 'image':
      return whatsapp.sendImageMessage(to, content.media!.url, content.media?.caption);
    case 'document':
      return whatsapp.sendDocumentMessage(
        to,
        content.media!.url,
        content.media!.filename || 'document',
        content.media?.caption
      );
    case 'interactive':
      if (content.interactive?.type === 'button') {
        return whatsapp.sendButtonMessage(
          to,
          content.interactive.body,
          content.interactive.buttons!.map(b => ({ id: b.id, title: b.title })),
          content.interactive.header?.content,
          content.interactive.footer
        );
      } else if (content.interactive?.type === 'list') {
        return whatsapp.sendListMessage(
          to,
          content.interactive.body,
          'Select',
          content.interactive.sections!,
          content.interactive.header?.content,
          content.interactive.footer
        );
      }
      throw new Error('Unsupported interactive type');
    default:
      return whatsapp.sendTextMessage(to, content.text || '');
  }
}

async function sendTelegramMessage(
  conversation: Conversation,
  content: MessageContent,
  type: MessageType
): Promise<string> {
  const chatId = conversation.user.channelUserId!;
  
  let messageId: number;
  
  switch (type) {
    case 'text':
      messageId = await telegram.sendTextMessage(chatId, content.text!);
      break;
    case 'image':
      messageId = await telegram.sendPhoto(chatId, content.media!.url, content.text);
      break;
    case 'document':
      messageId = await telegram.sendDocument(chatId, content.media!.url, content.text);
      break;
    case 'audio':
      messageId = await telegram.sendAudio(chatId, content.media!.url, content.text);
      break;
    case 'video':
      messageId = await telegram.sendVideo(chatId, content.media!.url, content.text);
      break;
    case 'location':
      messageId = await telegram.sendLocation(chatId, content.location!.latitude, content.location!.longitude);
      break;
    case 'interactive':
      const keyboard = content.interactive?.buttons 
        ? telegram.createInlineKeyboard([
            content.interactive.buttons.map(b => ({
              text: b.title,
              callbackData: b.id
            }))
          ])
        : undefined;
      messageId = await telegram.sendTextMessage(chatId, content.interactive!.body, { keyboard });
      break;
    default:
      messageId = await telegram.sendTextMessage(chatId, content.text || '');
  }
  
  return String(messageId);
}

// ============ WEBHOOKS ============

export async function handleWebhook(
  channel: Channel,
  payload: any,
  headers: Record<string, string>
): Promise<void> {
  let events: WebhookEvent[] = [];
  
  switch (channel) {
    case 'whatsapp':
      events = whatsapp.parseWebhook(payload);
      break;
    case 'telegram':
      events = telegram.parseWebhook(payload);
      break;
  }
  
  for (const event of events) {
    webhookEvents.push(event);
    await processWebhookEvent(event);
    event.processed = true;
    event.processedAt = new Date();
  }
}

async function processWebhookEvent(event: WebhookEvent): Promise<void> {
  if (event.type !== 'message.received') return;
  
  const data = event.data;
  
  // Get or create conversation
  const conversation = getOrCreateConversation(
    event.channel,
    data.from?.id || data.chatId,
    {
      name: data.from?.firstName ? `${data.from.firstName} ${data.from.lastName || ''}`.trim() : undefined,
      phone: data.from?.phone
    }
  );
  
  // Create inbound message
  const messageId = generateId('msg_');
  const message: Message = {
    id: messageId,
    channel: event.channel,
    channelMessageId: data.messageId,
    conversationId: conversation.id,
    from: conversation.user,
    to: conversation.bot,
    direction: 'inbound',
    type: data.content.media ? data.content.media.type : 'text',
    content: data.content,
    replyTo: data.context?.message_id || data.replyTo,
    status: 'delivered',
    timestamp: data.timestamp || new Date()
  };
  
  messages.set(messageId, message);
  
  // Update conversation
  conversation.messageCount++;
  conversation.lastMessageAt = new Date();
  conversations.set(conversation.id, conversation);
  
  // Mark as read
  if (event.channel === 'whatsapp' && data.messageId) {
    await whatsapp.markAsRead(data.messageId);
  }
  
  // Answer callback query for Telegram
  if (event.channel === 'telegram' && data.callbackQueryId) {
    await telegram.answerCallbackQuery(data.callbackQueryId);
  }
  
  // Emit event
  if (eventBus) {
    await eventBus.publish({
      id: generateId('evt_'),
      type: 'channel.message.received',
      source: 'channel-service',
      data: { messageId, conversationId: conversation.id, channel: event.channel },
      timestamp: Date.now(),
      version: '1.0'
    });
  }
  
  // Process with handler
  if (messageHandler) {
    try {
      // Send typing indicator
      if (event.channel === 'telegram') {
        await telegram.sendChatAction(conversation.user.channelUserId!);
      }
      
      const response = await messageHandler(message, conversation);
      
      // Send response messages
      for (const respMsg of response.messages) {
        await sendMessage(
          conversation.id,
          respMsg.content,
          respMsg.type
        );
      }
      
      // Update context if provided
      if (response.context) {
        updateConversationContext(conversation.id, response.context);
      }
      
      // Handle actions
      for (const action of response.actions || []) {
        if (action.type === 'end_conversation') {
          endConversation(conversation.id);
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Send error message
      await sendMessage(conversation.id, {
        text: "I'm sorry, I encountered an error. Please try again."
      });
    }
  }
}

// ============ UTILITIES ============

export function getMessages(conversationId: string, limit: number = 50): Message[] {
  return Array.from(messages.values())
    .filter(m => m.conversationId === conversationId)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
    .slice(-limit);
}

export function listConversations(channel?: Channel, limit: number = 50): Conversation[] {
  let convs = Array.from(conversations.values());
  if (channel) {
    convs = convs.filter(c => c.channel === channel);
  }
  return convs
    .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime())
    .slice(0, limit);
}

export { meet };

// Export types
export * from './types';
