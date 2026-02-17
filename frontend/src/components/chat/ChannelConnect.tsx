/**
 * Channel Connect Component
 * Connect WhatsApp, Telegram, or use Web chat
 */

import React, { useState } from 'react';

interface ChannelConnectProps {
  whatsappNumber?: string;
  telegramBotUsername?: string;
  onWebChatStart?: () => void;
}

export const ChannelConnect: React.FC<ChannelConnectProps> = ({
  whatsappNumber = '+1234567890',
  telegramBotUsername = 'EduGeniusBot',
  onWebChatStart
}) => {
  const [selectedChannel, setSelectedChannel] = useState<'whatsapp' | 'telegram' | 'web' | null>(null);

  const channels = [
    {
      id: 'whatsapp' as const,
      name: 'WhatsApp',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      ),
      color: 'bg-green-500 hover:bg-green-600',
      description: 'Chat with our AI tutor on WhatsApp',
      action: () => {
        const message = encodeURIComponent('Hi! I want to start learning with EduGenius');
        window.open(`https://wa.me/${whatsappNumber.replace(/\D/g, '')}?text=${message}`, '_blank');
      }
    },
    {
      id: 'telegram' as const,
      name: 'Telegram',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
        </svg>
      ),
      color: 'bg-blue-500 hover:bg-blue-600',
      description: 'Start chatting on Telegram',
      action: () => {
        window.open(`https://t.me/${telegramBotUsername}`, '_blank');
      }
    },
    {
      id: 'web' as const,
      name: 'Web Chat',
      icon: (
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
      color: 'bg-purple-500 hover:bg-purple-600',
      description: 'Chat right here in your browser',
      action: () => {
        onWebChatStart?.();
      }
    }
  ];

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Connect with EduGenius AI Tutor
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Choose your preferred way to chat with our AI tutor
        </p>
      </div>

      <div className="grid gap-4">
        {channels.map(channel => (
          <button
            key={channel.id}
            onClick={() => {
              setSelectedChannel(channel.id);
              channel.action();
            }}
            className={`flex items-center gap-4 p-6 rounded-xl text-white transition-all transform hover:scale-[1.02] ${channel.color} ${
              selectedChannel === channel.id ? 'ring-4 ring-offset-2 ring-offset-white dark:ring-offset-gray-900' : ''
            }`}
          >
            <div className="flex-shrink-0">
              {channel.icon}
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-lg">{channel.name}</h3>
              <p className="text-white/80 text-sm">{channel.description}</p>
            </div>
            <div className="ml-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          💡 Pro Tip
        </h4>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Use WhatsApp or Telegram for notifications and quick questions. 
          The web chat is best for longer study sessions with diagrams and equations.
        </p>
      </div>

      {/* QR Codes Section */}
      <div className="mt-8 grid md:grid-cols-2 gap-6">
        <div className="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
            Scan for WhatsApp
          </h4>
          <div className="w-32 h-32 mx-auto bg-white p-2 rounded-lg">
            {/* Placeholder for QR code */}
            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
              QR Code
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {whatsappNumber}
          </p>
        </div>

        <div className="text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">
            Scan for Telegram
          </h4>
          <div className="w-32 h-32 mx-auto bg-white p-2 rounded-lg">
            {/* Placeholder for QR code */}
            <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
              QR Code
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            @{telegramBotUsername}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ChannelConnect;
