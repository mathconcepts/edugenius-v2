// @ts-nocheck
/**
 * WhatsApp Channel Adapter
 * Meta Cloud API integration
 */

import * as crypto from 'crypto';
import {
  Message, Conversation, MessageContent, MessageType,
  ChannelConfig, WebhookEvent, Participant
} from './types';

// WhatsApp Cloud API base URL
const WHATSAPP_API_BASE = 'https://graph.facebook.com/v18.0';

// Configuration
let whatsappConfig: ChannelConfig['credentials']['whatsapp'] | null = null;

export function configureWhatsApp(config: NonNullable<ChannelConfig['credentials']['whatsapp']>): void {
  whatsappConfig = config;
}

function getConfig(): NonNullable<ChannelConfig['credentials']['whatsapp']> {
  if (!whatsappConfig) {
    throw new Error('WhatsApp not configured');
  }
  return whatsappConfig;
}

/**
 * Send a text message
 */
export async function sendTextMessage(
  to: string,
  text: string,
  replyTo?: string
): Promise<string> {
  const config = getConfig();
  
  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text }
  };
  
  if (replyTo) {
    payload.context = { message_id: replyTo };
  }
  
  const response = await fetch(
    `${WHATSAPP_API_BASE}/${config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WhatsApp API error: ${error}`);
  }
  
  const result = await response.json();
  return result.messages[0].id;
}

/**
 * Send an image message
 */
export async function sendImageMessage(
  to: string,
  imageUrl: string,
  caption?: string
): Promise<string> {
  const config = getConfig();
  
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'image',
    image: {
      link: imageUrl,
      caption
    }
  };
  
  const response = await fetch(
    `${WHATSAPP_API_BASE}/${config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WhatsApp API error: ${error}`);
  }
  
  const result = await response.json();
  return result.messages[0].id;
}

/**
 * Send a document
 */
export async function sendDocumentMessage(
  to: string,
  documentUrl: string,
  filename: string,
  caption?: string
): Promise<string> {
  const config = getConfig();
  
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'document',
    document: {
      link: documentUrl,
      filename,
      caption
    }
  };
  
  const response = await fetch(
    `${WHATSAPP_API_BASE}/${config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WhatsApp API error: ${error}`);
  }
  
  const result = await response.json();
  return result.messages[0].id;
}

/**
 * Send interactive buttons
 */
export async function sendButtonMessage(
  to: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
  header?: string,
  footer?: string
): Promise<string> {
  const config = getConfig();
  
  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.slice(0, 3).map(b => ({
          type: 'reply',
          reply: { id: b.id, title: b.title.slice(0, 20) }
        }))
      }
    }
  };
  
  if (header) {
    payload.interactive.header = { type: 'text', text: header };
  }
  
  if (footer) {
    payload.interactive.footer = { text: footer };
  }
  
  const response = await fetch(
    `${WHATSAPP_API_BASE}/${config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WhatsApp API error: ${error}`);
  }
  
  const result = await response.json();
  return result.messages[0].id;
}

/**
 * Send interactive list
 */
export async function sendListMessage(
  to: string,
  body: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ id: string; title: string; description?: string }>;
  }>,
  header?: string,
  footer?: string
): Promise<string> {
  const config = getConfig();
  
  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: {
        button: buttonText,
        sections: sections.map(s => ({
          title: s.title,
          rows: s.rows.map(r => ({
            id: r.id,
            title: r.title.slice(0, 24),
            description: r.description?.slice(0, 72)
          }))
        }))
      }
    }
  };
  
  if (header) {
    payload.interactive.header = { type: 'text', text: header };
  }
  
  if (footer) {
    payload.interactive.footer = { text: footer };
  }
  
  const response = await fetch(
    `${WHATSAPP_API_BASE}/${config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WhatsApp API error: ${error}`);
  }
  
  const result = await response.json();
  return result.messages[0].id;
}

/**
 * Send template message
 */
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  language: string,
  components?: Array<{
    type: 'header' | 'body' | 'button';
    parameters: Array<{ type: string; value: string }>;
  }>
): Promise<string> {
  const config = getConfig();
  
  const payload: any = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      components: components?.map(c => ({
        type: c.type,
        parameters: c.parameters.map(p => ({
          type: p.type,
          [p.type]: p.value
        }))
      }))
    }
  };
  
  const response = await fetch(
    `${WHATSAPP_API_BASE}/${config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`WhatsApp API error: ${error}`);
  }
  
  const result = await response.json();
  return result.messages[0].id;
}

/**
 * Mark message as read
 */
export async function markAsRead(messageId: string): Promise<void> {
  const config = getConfig();
  
  await fetch(
    `${WHATSAPP_API_BASE}/${config.phoneNumberId}/messages`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      })
    }
  );
}

/**
 * Send typing indicator
 */
export async function sendTypingIndicator(to: string): Promise<void> {
  // WhatsApp doesn't support typing indicators via Cloud API
  // This is a no-op placeholder
}

/**
 * Download media
 */
export async function downloadMedia(mediaId: string): Promise<Buffer> {
  const config = getConfig();
  
  // Get media URL
  const urlResponse = await fetch(
    `${WHATSAPP_API_BASE}/${mediaId}`,
    {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`
      }
    }
  );
  
  if (!urlResponse.ok) {
    throw new Error('Failed to get media URL');
  }
  
  const { url } = await urlResponse.json();
  
  // Download media
  const mediaResponse = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${config.accessToken}`
    }
  });
  
  if (!mediaResponse.ok) {
    throw new Error('Failed to download media');
  }
  
  const arrayBuffer = await mediaResponse.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  const providedSignature = signature.replace('sha256=', '');
  
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(providedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Handle webhook verification (GET request)
 */
export function handleWebhookVerification(
  mode: string,
  token: string,
  challenge: string
): string | null {
  const config = getConfig();
  
  if (mode === 'subscribe' && token === config.verifyToken) {
    return challenge;
  }
  
  return null;
}

/**
 * Parse incoming webhook
 */
export function parseWebhook(payload: any): WebhookEvent[] {
  const events: WebhookEvent[] = [];
  
  if (!payload.entry) return events;
  
  for (const entry of payload.entry) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;
      
      const value = change.value;
      
      // Process messages
      for (const message of value.messages || []) {
        events.push({
          id: message.id,
          channel: 'whatsapp',
          type: 'message.received',
          data: {
            messageId: message.id,
            from: message.from,
            timestamp: new Date(parseInt(message.timestamp) * 1000),
            type: message.type,
            content: parseMessageContent(message),
            context: message.context
          },
          timestamp: new Date(),
          processed: false
        });
      }
      
      // Process status updates
      for (const status of value.statuses || []) {
        const eventType = status.status === 'delivered' ? 'message.delivered' :
                          status.status === 'read' ? 'message.read' :
                          status.status === 'failed' ? 'message.failed' : null;
        
        if (eventType) {
          events.push({
            id: status.id,
            channel: 'whatsapp',
            type: eventType,
            data: {
              messageId: status.id,
              recipient: status.recipient_id,
              timestamp: new Date(parseInt(status.timestamp) * 1000),
              errors: status.errors
            },
            timestamp: new Date(),
            processed: false
          });
        }
      }
    }
  }
  
  return events;
}

/**
 * Parse message content from webhook
 */
function parseMessageContent(message: any): MessageContent {
  const content: MessageContent = {};
  
  switch (message.type) {
    case 'text':
      content.text = message.text?.body;
      break;
      
    case 'image':
      content.media = {
        type: 'image',
        url: message.image?.id,
        mimeType: message.image?.mime_type,
        caption: message.image?.caption
      };
      break;
      
    case 'audio':
      content.media = {
        type: 'audio',
        url: message.audio?.id,
        mimeType: message.audio?.mime_type
      };
      break;
      
    case 'video':
      content.media = {
        type: 'video',
        url: message.video?.id,
        mimeType: message.video?.mime_type,
        caption: message.video?.caption
      };
      break;
      
    case 'document':
      content.media = {
        type: 'document',
        url: message.document?.id,
        mimeType: message.document?.mime_type,
        filename: message.document?.filename,
        caption: message.document?.caption
      };
      break;
      
    case 'location':
      content.location = {
        latitude: message.location?.latitude,
        longitude: message.location?.longitude,
        name: message.location?.name,
        address: message.location?.address
      };
      break;
      
    case 'interactive':
      content.text = message.interactive?.button_reply?.title ||
                     message.interactive?.list_reply?.title;
      content.interactive = {
        type: message.interactive?.type,
        body: message.interactive?.button_reply?.id ||
              message.interactive?.list_reply?.id
      };
      break;
      
    case 'button':
      content.text = message.button?.text;
      break;
  }
  
  return content;
}

/**
 * Get business profile
 */
export async function getBusinessProfile(): Promise<any> {
  const config = getConfig();
  
  const response = await fetch(
    `${WHATSAPP_API_BASE}/${config.phoneNumberId}/whatsapp_business_profile`,
    {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`
      }
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to get business profile');
  }
  
  return response.json();
}
