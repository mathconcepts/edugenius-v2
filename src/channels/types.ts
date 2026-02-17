/**
 * Multi-Channel Chat Types
 * WhatsApp, Telegram, Google Meet, Web
 */

// Supported channels
export type Channel = 'web' | 'whatsapp' | 'telegram' | 'meet' | 'slack' | 'discord';

// Message direction
export type MessageDirection = 'inbound' | 'outbound';

// Message status
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

// Message type
export type MessageType = 
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'location'
  | 'contact'
  | 'sticker'
  | 'reaction'
  | 'interactive'
  | 'template';

/**
 * Unified message format
 */
export interface Message {
  id: string;
  
  // Channel info
  channel: Channel;
  channelMessageId?: string;
  
  // Conversation
  conversationId: string;
  
  // Sender/Receiver
  from: Participant;
  to: Participant;
  direction: MessageDirection;
  
  // Content
  type: MessageType;
  content: MessageContent;
  
  // Reply context
  replyTo?: string;
  
  // Status
  status: MessageStatus;
  
  // Timestamps
  timestamp: Date;
  deliveredAt?: Date;
  readAt?: Date;
  
  // Metadata
  metadata?: Record<string, any>;
}

export interface Participant {
  id: string;
  type: 'user' | 'bot' | 'agent';
  name?: string;
  phone?: string;
  email?: string;
  avatar?: string;
  channelUserId?: string;
}

export interface MessageContent {
  // Text
  text?: string;
  
  // Media
  media?: MediaContent;
  
  // Location
  location?: LocationContent;
  
  // Contact
  contact?: ContactContent;
  
  // Interactive
  interactive?: InteractiveContent;
  
  // Template
  template?: TemplateContent;
}

export interface MediaContent {
  type: 'image' | 'audio' | 'video' | 'document' | 'sticker';
  url: string;
  mimeType?: string;
  filename?: string;
  caption?: string;
  size?: number;
  duration?: number; // For audio/video
  thumbnail?: string;
}

export interface LocationContent {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface ContactContent {
  name: string;
  phones: Array<{ type: string; phone: string }>;
  emails?: Array<{ type: string; email: string }>;
}

export interface InteractiveContent {
  type: 'button' | 'list' | 'product' | 'flow';
  header?: { type: 'text' | 'image' | 'video' | 'document'; content: string };
  body: string;
  footer?: string;
  buttons?: Array<{ id: string; title: string; type?: string }>;
  sections?: Array<{ title: string; rows: Array<{ id: string; title: string; description?: string }> }>;
}

export interface TemplateContent {
  name: string;
  language: string;
  components: Array<{
    type: 'header' | 'body' | 'button';
    parameters: Array<{ type: string; value: string }>;
  }>;
}

/**
 * Conversation
 */
export interface Conversation {
  id: string;
  
  // Channel
  channel: Channel;
  channelConversationId?: string;
  
  // Participants
  user: Participant;
  bot: Participant;
  
  // Context
  context: ConversationContext;
  
  // State
  state: 'active' | 'paused' | 'ended';
  
  // Stats
  messageCount: number;
  lastMessageAt: Date;
  
  // Timestamps
  startedAt: Date;
  endedAt?: Date;
}

export interface ConversationContext {
  // User context
  userId?: string;
  studentId?: string;
  
  // Learning context
  examCode?: string;
  subject?: string;
  topic?: string;
  
  // Session
  sessionType?: 'tutoring' | 'quiz' | 'doubt' | 'general';
  
  // Agent context
  agentId?: string;
  agentPersonality?: string;
  
  // Custom data
  data?: Record<string, any>;
}

/**
 * Channel configuration
 */
export interface ChannelConfig {
  channel: Channel;
  enabled: boolean;
  credentials: ChannelCredentials;
  settings: ChannelSettings;
  webhookUrl?: string;
}

export interface ChannelCredentials {
  // WhatsApp (Meta Cloud API)
  whatsapp?: {
    phoneNumberId: string;
    accessToken: string;
    businessAccountId: string;
    verifyToken: string;
  };
  
  // Telegram
  telegram?: {
    botToken: string;
    botUsername: string;
  };
  
  // Google Meet (via Google Calendar API)
  meet?: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
  };
  
  // Slack
  slack?: {
    botToken: string;
    signingSecret: string;
    appId: string;
  };
  
  // Discord
  discord?: {
    botToken: string;
    applicationId: string;
    publicKey: string;
  };
}

export interface ChannelSettings {
  // Response settings
  typingIndicator: boolean;
  readReceipts: boolean;
  
  // Rate limiting
  maxMessagesPerMinute: number;
  
  // Features
  supportsMedia: boolean;
  supportsInteractive: boolean;
  supportsTemplates: boolean;
  
  // Webhooks
  webhookSecret?: string;
}

/**
 * Webhook event
 */
export interface WebhookEvent {
  id: string;
  channel: Channel;
  type: WebhookEventType;
  data: any;
  timestamp: Date;
  processed: boolean;
  processedAt?: Date;
  error?: string;
}

export type WebhookEventType =
  | 'message.received'
  | 'message.delivered'
  | 'message.read'
  | 'message.failed'
  | 'conversation.started'
  | 'conversation.ended'
  | 'user.joined'
  | 'user.left'
  | 'reaction.added'
  | 'reaction.removed';

/**
 * Bot response
 */
export interface BotResponse {
  messages: Message[];
  actions?: BotAction[];
  context?: Partial<ConversationContext>;
}

export interface BotAction {
  type: 'handoff' | 'end_conversation' | 'schedule_followup' | 'update_context';
  data?: Record<string, any>;
}
