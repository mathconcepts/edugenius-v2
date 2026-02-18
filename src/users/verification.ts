/**
 * Multi-Channel Verification Service
 * Supports Email, SMS, WhatsApp, Telegram verification
 */

import { EventEmitter } from 'events';
import type { VerificationChannel, VerificationStatus } from './types';

// ============================================
// CONFIGURATION
// ============================================

export interface VerificationConfig {
  // OTP settings
  otpLength: number;
  otpExpiryMinutes: number;
  maxAttempts: number;
  cooldownMinutes: number;
  
  // Channel-specific
  sms: {
    provider: 'twilio' | 'msg91' | 'textlocal';
    senderId: string;
    templateId?: string;
  };
  whatsapp: {
    provider: 'twilio' | 'gupshup' | 'interakt';
    templateName: string;
    businessAccountId: string;
  };
  telegram: {
    botToken: string;
    botUsername: string;
  };
  email: {
    provider: 'sendgrid' | 'resend' | 'ses';
    fromEmail: string;
    fromName: string;
  };
}

export const DEFAULT_CONFIG: VerificationConfig = {
  otpLength: 6,
  otpExpiryMinutes: 10,
  maxAttempts: 3,
  cooldownMinutes: 1,
  
  sms: {
    provider: 'twilio',
    senderId: 'EDUGEN',
  },
  whatsapp: {
    provider: 'twilio',
    templateName: 'otp_verification',
    businessAccountId: 'PLACEHOLDER',
  },
  telegram: {
    botToken: 'PLACEHOLDER_BOT_TOKEN',
    botUsername: 'EduGeniusBot',
  },
  email: {
    provider: 'sendgrid',
    fromEmail: 'verify@edugenius.ai',
    fromName: 'EduGenius',
  },
};

// ============================================
// VERIFICATION RECORD
// ============================================

export interface VerificationRecord {
  id: string;
  userId: string;
  channel: VerificationChannel;
  identifier: string; // phone or email
  code: string;
  status: VerificationStatus;
  attempts: number;
  sentAt: Date;
  expiresAt: Date;
  verifiedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================
// VERIFICATION SERVICE
// ============================================

export class VerificationService {
  private records: Map<string, VerificationRecord> = new Map();
  private events: EventEmitter = new EventEmitter();
  private config: VerificationConfig;

  constructor(config: Partial<VerificationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ============================================
  // SEND VERIFICATION
  // ============================================

  async sendVerification(
    userId: string,
    channel: VerificationChannel,
    identifier: string,
    options?: { ipAddress?: string; userAgent?: string }
  ): Promise<{ success: boolean; expiresAt: Date; error?: string }> {
    // Check cooldown
    const existingRecord = this.findActiveRecord(userId, channel);
    if (existingRecord) {
      const cooldownEnd = new Date(existingRecord.sentAt.getTime() + this.config.cooldownMinutes * 60 * 1000);
      if (new Date() < cooldownEnd) {
        const waitSeconds = Math.ceil((cooldownEnd.getTime() - Date.now()) / 1000);
        return {
          success: false,
          expiresAt: cooldownEnd,
          error: `Please wait ${waitSeconds} seconds before requesting a new code`,
        };
      }
    }

    // Generate OTP
    const code = this.generateOTP();
    const expiresAt = new Date(Date.now() + this.config.otpExpiryMinutes * 60 * 1000);

    // Create record
    const record: VerificationRecord = {
      id: this.generateId(),
      userId,
      channel,
      identifier: this.normalizeIdentifier(channel, identifier),
      code,
      status: 'pending',
      attempts: 0,
      sentAt: new Date(),
      expiresAt,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    };

    this.records.set(record.id, record);

    // Send via appropriate channel
    try {
      await this.dispatchVerification(record);
      record.status = 'sent';
      this.events.emit('verification:sent', { userId, channel, identifier });
      
      return { success: true, expiresAt };
    } catch (error) {
      record.status = 'failed';
      return { success: false, expiresAt, error: 'Failed to send verification code' };
    }
  }

  // ============================================
  // VERIFY CODE
  // ============================================

  async verifyCode(
    userId: string,
    channel: VerificationChannel,
    code: string
  ): Promise<{ success: boolean; error?: string }> {
    const record = this.findActiveRecord(userId, channel);
    
    if (!record) {
      return { success: false, error: 'No pending verification found' };
    }

    if (record.status === 'verified') {
      return { success: true };
    }

    if (record.status === 'expired' || new Date() > record.expiresAt) {
      record.status = 'expired';
      return { success: false, error: 'Verification code has expired' };
    }

    if (record.attempts >= this.config.maxAttempts) {
      record.status = 'failed';
      return { success: false, error: 'Maximum attempts exceeded' };
    }

    record.attempts++;

    if (record.code !== code) {
      const remaining = this.config.maxAttempts - record.attempts;
      return {
        success: false,
        error: remaining > 0 
          ? `Invalid code. ${remaining} attempts remaining.`
          : 'Maximum attempts exceeded',
      };
    }

    // Success!
    record.status = 'verified';
    record.verifiedAt = new Date();

    this.events.emit('verification:verified', {
      userId,
      channel,
      identifier: record.identifier,
    });

    return { success: true };
  }

  // ============================================
  // TELEGRAM DEEP LINK
  // ============================================

  generateTelegramDeepLink(userId: string): string {
    const token = this.generateToken(userId, 'telegram');
    return `https://t.me/${this.config.telegram.botUsername}?start=${token}`;
  }

  async verifyTelegramCallback(
    token: string,
    telegramUserId: string,
    telegramChatId: string,
    telegramUsername?: string
  ): Promise<{ success: boolean; userId?: string; error?: string }> {
    const decoded = this.decodeToken(token);
    if (!decoded || decoded.channel !== 'telegram') {
      return { success: false, error: 'Invalid token' };
    }

    const record: VerificationRecord = {
      id: this.generateId(),
      userId: decoded.userId,
      channel: 'telegram',
      identifier: telegramUsername || telegramUserId,
      code: token,
      status: 'verified',
      attempts: 0,
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      verifiedAt: new Date(),
    };

    this.records.set(record.id, record);

    this.events.emit('telegram:connected', {
      userId: decoded.userId,
      telegramUserId,
      telegramChatId,
      telegramUsername,
    });

    return { success: true, userId: decoded.userId };
  }

  // ============================================
  // WHATSAPP BUSINESS
  // ============================================

  async sendWhatsAppOTP(
    phone: string,
    code: string,
    language: string = 'en'
  ): Promise<boolean> {
    // This would integrate with WhatsApp Business API
    // Using template messages for OTP delivery
    
    const payload = {
      messaging_product: 'whatsapp',
      to: phone,
      type: 'template',
      template: {
        name: this.config.whatsapp.templateName,
        language: { code: language },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: code },
              { type: 'text', text: `${this.config.otpExpiryMinutes}` },
            ],
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [
              { type: 'text', text: code },
            ],
          },
        ],
      },
    };

    // Emit event for actual sending (would be handled by channel integration)
    this.events.emit('whatsapp:send', payload);

    console.log('[WhatsApp] Would send OTP:', { phone, code });
    return true;
  }

  // ============================================
  // DISPATCH TO CHANNELS
  // ============================================

  private async dispatchVerification(record: VerificationRecord): Promise<void> {
    switch (record.channel) {
      case 'email':
        await this.sendEmailOTP(record.identifier, record.code);
        break;
      case 'phone_sms':
        await this.sendSmsOTP(record.identifier, record.code);
        break;
      case 'whatsapp':
        await this.sendWhatsAppOTP(record.identifier, record.code);
        break;
      case 'telegram':
        // Telegram uses deep links, not OTP
        break;
    }
  }

  private async sendEmailOTP(email: string, code: string): Promise<void> {
    const emailPayload = {
      to: email,
      from: {
        email: this.config.email.fromEmail,
        name: this.config.email.fromName,
      },
      subject: `${code} is your EduGenius verification code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #3B82F6;">Verify your email</h1>
          <p>Your verification code is:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; 
                      background: #F3F4F6; padding: 20px; text-align: center; 
                      border-radius: 8px; margin: 20px 0;">
            ${code}
          </div>
          <p>This code expires in ${this.config.otpExpiryMinutes} minutes.</p>
          <p style="color: #6B7280; font-size: 12px;">
            If you didn't request this code, please ignore this email.
          </p>
        </div>
      `,
    };

    this.events.emit('email:send', emailPayload);
    console.log('[Email] Would send OTP:', { email, code });
  }

  private async sendSmsOTP(phone: string, code: string): Promise<void> {
    const smsPayload = {
      to: phone,
      from: this.config.sms.senderId,
      body: `${code} is your EduGenius verification code. Valid for ${this.config.otpExpiryMinutes} minutes. Do not share this code.`,
    };

    this.events.emit('sms:send', smsPayload);
    console.log('[SMS] Would send OTP:', { phone, code });
  }

  // ============================================
  // HELPERS
  // ============================================

  private generateId(): string {
    return `ver_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateOTP(): string {
    const min = Math.pow(10, this.config.otpLength - 1);
    const max = Math.pow(10, this.config.otpLength) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }

  private generateToken(userId: string, channel: string): string {
    const payload = { userId, channel, ts: Date.now() };
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  private decodeToken(token: string): { userId: string; channel: string } | null {
    try {
      const decoded = JSON.parse(Buffer.from(token, 'base64url').toString());
      // Check expiry (1 hour)
      if (Date.now() - decoded.ts > 60 * 60 * 1000) return null;
      return decoded;
    } catch {
      return null;
    }
  }

  private normalizeIdentifier(channel: VerificationChannel, identifier: string): string {
    if (channel === 'email') {
      return identifier.toLowerCase().trim();
    } else {
      // Phone: remove non-digits, ensure country code
      let phone = identifier.replace(/\D/g, '');
      if (phone.length === 10) {
        phone = '91' + phone; // Default to India
      }
      return '+' + phone;
    }
  }

  private findActiveRecord(
    userId: string,
    channel: VerificationChannel
  ): VerificationRecord | undefined {
    for (const record of this.records.values()) {
      if (record.userId === userId && 
          record.channel === channel && 
          record.status !== 'verified' &&
          record.status !== 'failed' &&
          new Date() < record.expiresAt) {
        return record;
      }
    }
    return undefined;
  }

  // Event subscription
  on(event: string, handler: (...args: any[]) => void): void {
    this.events.on(event, handler);
  }
}

// ============================================
// DEPENDENCIES CHECKLIST
// ============================================

export const VERIFICATION_DEPENDENCIES = {
  email: {
    providers: [
      { id: 'sendgrid', name: 'SendGrid', docsUrl: 'https://docs.sendgrid.com/api-reference/mail-send/mail-send' },
      { id: 'resend', name: 'Resend', docsUrl: 'https://resend.com/docs/send-with-nodejs' },
      { id: 'ses', name: 'AWS SES', docsUrl: 'https://docs.aws.amazon.com/ses/' },
    ],
    requiredEnv: ['EMAIL_API_KEY', 'EMAIL_FROM_ADDRESS'],
  },
  sms: {
    providers: [
      { id: 'twilio', name: 'Twilio', docsUrl: 'https://www.twilio.com/docs/sms/quickstart/node' },
      { id: 'msg91', name: 'MSG91', docsUrl: 'https://docs.msg91.com/reference/send-otp' },
      { id: 'textlocal', name: 'TextLocal', docsUrl: 'https://api.textlocal.in/docs/' },
    ],
    requiredEnv: ['SMS_ACCOUNT_SID', 'SMS_AUTH_TOKEN', 'SMS_FROM_NUMBER'],
  },
  whatsapp: {
    providers: [
      { id: 'twilio', name: 'Twilio', docsUrl: 'https://www.twilio.com/docs/whatsapp/api' },
      { id: 'gupshup', name: 'Gupshup', docsUrl: 'https://docs.gupshup.io/docs/send-text-message' },
      { id: 'interakt', name: 'Interakt', docsUrl: 'https://api.interakt.ai/docs/' },
    ],
    requiredEnv: ['WHATSAPP_API_KEY', 'WHATSAPP_BUSINESS_ACCOUNT_ID', 'WHATSAPP_PHONE_NUMBER_ID'],
    notes: [
      'Requires WhatsApp Business API access',
      'OTP templates must be pre-approved by Meta',
      'Template format: "Your code is {{1}}. Valid for {{2}} minutes."',
    ],
  },
  telegram: {
    providers: [
      { id: 'telegram', name: 'Telegram Bot API', docsUrl: 'https://core.telegram.org/bots/api' },
    ],
    requiredEnv: ['TELEGRAM_BOT_TOKEN'],
    setup: [
      '1. Create bot via @BotFather',
      '2. Get bot token',
      '3. Set webhook URL for callbacks',
      '4. Enable inline mode if needed',
    ],
  },
};

// Singleton instance
export const verificationService = new VerificationService();
export default verificationService;
