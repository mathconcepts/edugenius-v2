/**
 * Multi-Channel Chat Module
 * WhatsApp, Telegram, Google Meet
 */

// Main service
export {
  setEventBus,
  setMessageHandler,
  createConversation,
  getConversation,
  getOrCreateConversation,
  updateConversationContext,
  endConversation,
  sendMessage,
  handleWebhook,
  getMessages,
  listConversations,
  meet
} from './service';

// Types
export * from './types';

// Channel adapters
export * as whatsapp from './whatsapp';
export * as telegram from './telegram';
export * as googleMeet from './meet';
