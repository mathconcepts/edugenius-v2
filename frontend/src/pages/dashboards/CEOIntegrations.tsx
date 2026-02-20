/**
 * CEO Integrations Dashboard
 * Manage all external API keys and connections
 */

import React, { useState } from 'react';

// Integration status types
type IntegrationStatus = 'active' | 'inactive' | 'error' | 'pending';

interface IntegrationConfig {
  id: string;
  name: string;
  description: string;
  category: string;
  required: boolean;
  status: IntegrationStatus;
  lastChecked?: string;
  health?: number;
  fields: IntegrationField[];
  fallbackStrategy?: string;
  docsUrl?: string;
}

interface IntegrationField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select';
  placeholder?: string;
  required?: boolean;
  value?: string;
  options?: { value: string; label: string }[];
  hint?: string;
}

// All integrations configuration
const integrations: IntegrationConfig[] = [
  // LLM Providers
  {
    id: 'gemini',
    name: 'Google Gemini',
    description: 'Primary AI provider for tutoring and content generation',
    category: 'AI Providers',
    required: true,
    status: 'inactive',
    fields: [
      {
        key: 'GEMINI_API_KEY',
        label: 'API Key',
        type: 'password',
        placeholder: 'AIza...',
        required: true,
        hint: 'Get from Google AI Studio'
      }
    ],
    fallbackStrategy: 'Uses Anthropic → OpenAI → Ollama as fallbacks',
    docsUrl: 'https://aistudio.google.com/'
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description: 'Quality-critical AI tasks and complex reasoning',
    category: 'AI Providers',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'ANTHROPIC_API_KEY',
        label: 'API Key',
        type: 'password',
        placeholder: 'sk-ant-...',
        required: true,
        hint: 'Get from Anthropic Console'
      }
    ],
    fallbackStrategy: 'Falls back to Gemini Pro',
    docsUrl: 'https://console.anthropic.com/'
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models as tertiary fallback',
    category: 'AI Providers',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'OPENAI_API_KEY',
        label: 'API Key',
        type: 'password',
        placeholder: 'sk-...',
        required: true,
        hint: 'Get from OpenAI Platform'
      }
    ],
    docsUrl: 'https://platform.openai.com/'
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    description: 'Self-hosted models for cost savings',
    category: 'AI Providers',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'OLLAMA_URL',
        label: 'Server URL',
        type: 'url',
        placeholder: 'http://localhost:11434',
        required: true,
        hint: 'Your Ollama server endpoint'
      }
    ],
    fallbackStrategy: 'FREE - runs on your hardware'
  },

  // Database
  {
    id: 'postgres',
    name: 'PostgreSQL',
    description: 'Primary database for all data storage',
    category: 'Database',
    required: true,
    status: 'inactive',
    fields: [
      {
        key: 'DATABASE_URL',
        label: 'Connection URL',
        type: 'password',
        placeholder: 'postgres://user:pass@host:5432/edugenius',
        required: true,
        hint: 'Full PostgreSQL connection string'
      }
    ],
    fallbackStrategy: 'No fallback - required for operation'
  },
  {
    id: 'redis',
    name: 'Redis',
    description: 'Caching, sessions, and real-time events',
    category: 'Database',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'REDIS_URL',
        label: 'Connection URL',
        type: 'password',
        placeholder: 'redis://localhost:6379',
        required: true,
        hint: 'Redis connection string'
      }
    ],
    fallbackStrategy: 'Uses in-memory cache (not recommended for production)'
  },

  // Payments
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'International payment processing',
    category: 'Payments',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'STRIPE_PUBLISHABLE_KEY',
        label: 'Publishable Key',
        type: 'text',
        placeholder: 'pk_live_...',
        required: true,
        hint: 'Starts with pk_'
      },
      {
        key: 'STRIPE_SECRET_KEY',
        label: 'Secret Key',
        type: 'password',
        placeholder: 'sk_live_...',
        required: true,
        hint: 'Starts with sk_'
      },
      {
        key: 'STRIPE_WEBHOOK_SECRET',
        label: 'Webhook Secret',
        type: 'password',
        placeholder: 'whsec_...',
        required: true,
        hint: 'From Stripe webhook settings'
      }
    ],
    fallbackStrategy: 'Use Razorpay for India payments',
    docsUrl: 'https://dashboard.stripe.com/'
  },
  {
    id: 'razorpay',
    name: 'Razorpay',
    description: 'India payment processing (UPI, cards, wallets)',
    category: 'Payments',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'RAZORPAY_KEY_ID',
        label: 'Key ID',
        type: 'text',
        placeholder: 'rzp_live_...',
        required: true,
        hint: 'Starts with rzp_'
      },
      {
        key: 'RAZORPAY_KEY_SECRET',
        label: 'Key Secret',
        type: 'password',
        placeholder: 'Your secret key',
        required: true
      },
      {
        key: 'RAZORPAY_WEBHOOK_SECRET',
        label: 'Webhook Secret',
        type: 'password',
        placeholder: 'Webhook signing secret',
        required: true
      }
    ],
    fallbackStrategy: 'Use Stripe for international payments',
    docsUrl: 'https://dashboard.razorpay.com/'
  },

  // Email
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Transactional and marketing emails',
    category: 'Email',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'SENDGRID_API_KEY',
        label: 'API Key',
        type: 'password',
        placeholder: 'SG...',
        required: true,
        hint: 'Starts with SG.'
      }
    ],
    fallbackStrategy: 'Use Resend or SMTP',
    docsUrl: 'https://app.sendgrid.com/'
  },
  {
    id: 'resend',
    name: 'Resend',
    description: 'Modern email API alternative',
    category: 'Email',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'RESEND_API_KEY',
        label: 'API Key',
        type: 'password',
        placeholder: 're_...',
        required: true,
        hint: 'Starts with re_'
      }
    ],
    fallbackStrategy: 'Use SendGrid or SMTP',
    docsUrl: 'https://resend.com/'
  },

  // Auth
  {
    id: 'jwt',
    name: 'JWT Configuration',
    description: 'Authentication token settings',
    category: 'Authentication',
    required: true,
    status: 'inactive',
    fields: [
      {
        key: 'JWT_SECRET',
        label: 'JWT Secret',
        type: 'password',
        placeholder: 'Click generate or enter 64+ char secret',
        required: true,
        hint: '64+ random characters for signing tokens'
      },
      {
        key: 'SITE_URL',
        label: 'Site URL',
        type: 'url',
        placeholder: 'https://edugenius.in',
        required: true,
        hint: 'Your public domain'
      }
    ]
  },
  {
    id: 'google-oauth',
    name: 'Google OAuth',
    description: 'Sign in with Google',
    category: 'Authentication',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'GOOGLE_CLIENT_ID',
        label: 'Client ID',
        type: 'text',
        placeholder: '...apps.googleusercontent.com',
        required: true
      },
      {
        key: 'GOOGLE_CLIENT_SECRET',
        label: 'Client Secret',
        type: 'password',
        placeholder: 'GOCSPX-...',
        required: true
      },
      {
        key: 'GOOGLE_REDIRECT_URI',
        label: 'Redirect URI',
        type: 'url',
        placeholder: 'https://edugenius.in/auth/google/callback',
        required: true
      }
    ],
    fallbackStrategy: 'Email/password authentication',
    docsUrl: 'https://console.cloud.google.com/apis/credentials'
  },
  {
    id: 'microsoft-oauth',
    name: 'Microsoft OAuth',
    description: 'Sign in with Microsoft',
    category: 'Authentication',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'MICROSOFT_CLIENT_ID',
        label: 'Client ID',
        type: 'text',
        placeholder: 'Azure AD Application ID',
        required: true
      },
      {
        key: 'MICROSOFT_CLIENT_SECRET',
        label: 'Client Secret',
        type: 'password',
        placeholder: 'Azure AD secret',
        required: true
      },
      {
        key: 'MICROSOFT_REDIRECT_URI',
        label: 'Redirect URI',
        type: 'url',
        placeholder: 'https://edugenius.in/auth/microsoft/callback',
        required: true
      }
    ],
    docsUrl: 'https://portal.azure.com/'
  },

  // Chat Channels
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'WhatsApp tutoring channel',
    category: 'Chat Channels',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'WHATSAPP_PHONE_NUMBER_ID',
        label: 'Phone Number ID',
        type: 'text',
        placeholder: '1234567890',
        required: true,
        hint: 'From Meta Business Suite'
      },
      {
        key: 'WHATSAPP_ACCESS_TOKEN',
        label: 'Access Token',
        type: 'password',
        placeholder: 'EAAxxxxxxx...',
        required: true,
        hint: 'Meta Graph API token'
      },
      {
        key: 'WHATSAPP_VERIFY_TOKEN',
        label: 'Verify Token',
        type: 'password',
        placeholder: 'Your webhook verify token',
        required: true
      },
      {
        key: 'WHATSAPP_APP_SECRET',
        label: 'App Secret',
        type: 'password',
        placeholder: 'Meta app secret',
        required: true
      }
    ],
    fallbackStrategy: 'Web chat only',
    docsUrl: 'https://business.facebook.com/'
  },
  {
    id: 'telegram',
    name: 'Telegram Bot',
    description: 'Telegram tutoring channel',
    category: 'Chat Channels',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'TELEGRAM_BOT_TOKEN',
        label: 'Bot Token',
        type: 'password',
        placeholder: '123456:ABC-DEF...',
        required: true,
        hint: 'From @BotFather'
      },
      {
        key: 'TELEGRAM_WEBHOOK_SECRET',
        label: 'Webhook Secret',
        type: 'password',
        placeholder: 'Optional signing secret',
        required: false
      }
    ],
    fallbackStrategy: 'Web chat only',
    docsUrl: 'https://t.me/BotFather'
  },

  // Vector Store
  {
    id: 'pinecone',
    name: 'Pinecone',
    description: 'Vector database for semantic search',
    category: 'Vector Store',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'PINECONE_API_KEY',
        label: 'API Key',
        type: 'password',
        placeholder: 'Your Pinecone API key',
        required: true
      },
      {
        key: 'PINECONE_ENVIRONMENT',
        label: 'Environment',
        type: 'text',
        placeholder: 'us-east1-gcp',
        required: true
      },
      {
        key: 'PINECONE_INDEX',
        label: 'Index Name',
        type: 'text',
        placeholder: 'edugenius',
        required: true
      }
    ],
    fallbackStrategy: 'Uses Qdrant or in-memory (limited)',
    docsUrl: 'https://app.pinecone.io/'
  },
  {
    id: 'qdrant',
    name: 'Qdrant',
    description: 'Self-hosted vector database option',
    category: 'Vector Store',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'QDRANT_URL',
        label: 'Server URL',
        type: 'url',
        placeholder: 'http://localhost:6333',
        required: true
      },
      {
        key: 'QDRANT_API_KEY',
        label: 'API Key',
        type: 'password',
        placeholder: 'Optional for cloud',
        required: false
      },
      {
        key: 'QDRANT_COLLECTION',
        label: 'Collection Name',
        type: 'text',
        placeholder: 'edugenius',
        required: true
      }
    ],
    fallbackStrategy: 'Uses Pinecone or in-memory',
    docsUrl: 'https://cloud.qdrant.io/'
  },

  // Analytics
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    description: 'User analytics and tracking',
    category: 'Analytics',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'GA4_MEASUREMENT_ID',
        label: 'Measurement ID',
        type: 'text',
        placeholder: 'G-XXXXXXXXXX',
        required: true,
        hint: 'Starts with G-'
      },
      {
        key: 'GA4_API_SECRET',
        label: 'API Secret',
        type: 'password',
        placeholder: 'For server-side events',
        required: false
      }
    ],
    fallbackStrategy: 'Internal Oracle analytics only',
    docsUrl: 'https://analytics.google.com/'
  },
  {
    id: 'mixpanel',
    name: 'Mixpanel',
    description: 'Product analytics platform',
    category: 'Analytics',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'MIXPANEL_TOKEN',
        label: 'Project Token',
        type: 'text',
        placeholder: 'Your project token',
        required: true
      },
      {
        key: 'MIXPANEL_API_SECRET',
        label: 'API Secret',
        type: 'password',
        placeholder: 'For server-side events',
        required: false
      }
    ],
    fallbackStrategy: 'Internal Oracle analytics only',
    docsUrl: 'https://mixpanel.com/'
  },

  // Content Verification
  {
    id: 'wolfram',
    name: 'Wolfram Alpha',
    description: 'Math & science verification - validates all generated solutions',
    category: 'Content Verification',
    required: true,
    status: 'inactive',
    fields: [
      {
        key: 'WOLFRAM_APP_ID',
        label: 'App ID',
        type: 'password',
        placeholder: 'Your Wolfram App ID',
        required: true,
        hint: 'Get from Wolfram Developer Portal'
      }
    ],
    fallbackStrategy: 'Uses LLM consensus + SymPy for verification',
    docsUrl: 'https://developer.wolframalpha.com/'
  },
  {
    id: 'sympy',
    name: 'SymPy Cloud',
    description: 'Symbolic math verification using Python SymPy',
    category: 'Content Verification',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'SYMPY_ENDPOINT',
        label: 'Cloud Endpoint',
        type: 'url',
        placeholder: 'https://your-sympy-function.run.app',
        required: true,
        hint: 'Cloud function endpoint for SymPy'
      },
      {
        key: 'SYMPY_API_KEY',
        label: 'API Key',
        type: 'password',
        placeholder: 'Optional API key',
        required: false
      }
    ],
    fallbackStrategy: 'Falls back to Wolfram Alpha'
  },

  // Additional LLM Providers (modular)
  {
    id: 'groq',
    name: 'Groq',
    description: 'Ultra-fast inference for Llama models',
    category: 'AI Providers',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'GROQ_API_KEY',
        label: 'API Key',
        type: 'password',
        placeholder: 'gsk_...',
        required: true,
        hint: 'Fast inference provider'
      }
    ],
    fallbackStrategy: 'Alternative to Gemini Flash',
    docsUrl: 'https://console.groq.com/'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'Cost-effective reasoning models (R1, V3)',
    category: 'AI Providers',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'DEEPSEEK_API_KEY',
        label: 'API Key',
        type: 'password',
        placeholder: 'Your DeepSeek API key',
        required: true
      }
    ],
    fallbackStrategy: 'Alternative reasoning model',
    docsUrl: 'https://platform.deepseek.com/'
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    description: 'European AI provider with code specialization',
    category: 'AI Providers',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'MISTRAL_API_KEY',
        label: 'API Key',
        type: 'password',
        placeholder: 'Your Mistral API key',
        required: true
      }
    ],
    fallbackStrategy: 'Alternative to OpenAI/Anthropic',
    docsUrl: 'https://console.mistral.ai/'
  },
  {
    id: 'together',
    name: 'Together AI',
    description: 'Open-source model hosting (Llama, Qwen, DeepSeek)',
    category: 'AI Providers',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'TOGETHER_API_KEY',
        label: 'API Key',
        type: 'password',
        placeholder: 'Your Together API key',
        required: true
      }
    ],
    fallbackStrategy: 'Alternative open-source provider',
    docsUrl: 'https://www.together.ai/'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Unified API for 100+ models from all providers',
    category: 'AI Providers',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'OPENROUTER_API_KEY',
        label: 'API Key',
        type: 'password',
        placeholder: 'sk-or-...',
        required: true
      },
      {
        key: 'OPENROUTER_SITE_URL',
        label: 'Site URL',
        type: 'url',
        placeholder: 'https://edugenius.in',
        required: false,
        hint: 'For rankings and rate limits'
      }
    ],
    fallbackStrategy: 'Universal fallback - access all providers',
    docsUrl: 'https://openrouter.ai/'
  },
  {
    id: 'learnlm',
    name: 'LearnLM (Educational)',
    description: 'Google\'s pedagogically-optimized model',
    category: 'AI Providers',
    required: false,
    status: 'inactive',
    fields: [
      {
        key: 'LEARNLM_API_KEY',
        label: 'API Key (uses Gemini)',
        type: 'password',
        placeholder: 'Same as Gemini API key',
        required: true,
        hint: 'LearnLM uses Gemini API authentication'
      }
    ],
    fallbackStrategy: 'Specialized for education - falls back to standard models',
    docsUrl: 'https://ai.google.dev/gemini-api/docs/learnlm'
  }
];

// Status badge component
const StatusBadge: React.FC<{ status: IntegrationStatus }> = ({ status }) => {
  const styles: Record<IntegrationStatus, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
    error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
  };

  const labels: Record<IntegrationStatus, string> = {
    active: '✅ Active',
    inactive: '⚪ Not Configured',
    error: '❌ Error',
    pending: '⏳ Pending'
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>
      {labels[status]}
    </span>
  );
};

// Health bar component
const HealthBar: React.FC<{ health: number }> = ({ health }) => {
  const color = health >= 90 ? 'bg-green-500' : health >= 70 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${health}%` }} />
      </div>
      <span className="text-xs text-gray-500">{health}%</span>
    </div>
  );
};

// Integration card component
const IntegrationCard: React.FC<{
  integration: IntegrationConfig;
  onConfigure: (id: string) => void;
  onTest: (id: string) => void;
}> = ({ integration, onConfigure, onTest }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">{integration.name}</h3>
            {integration.required && (
              <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
                Required
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{integration.description}</p>
        </div>
        <StatusBadge status={integration.status} />
      </div>

      {integration.status === 'active' && integration.health !== undefined && (
        <div className="mb-3">
          <div className="flex justify-between items-center text-xs text-gray-500 mb-1">
            <span>Health</span>
            {integration.lastChecked && <span>Checked {integration.lastChecked}</span>}
          </div>
          <HealthBar health={integration.health} />
        </div>
      )}

      {integration.fallbackStrategy && integration.status === 'inactive' && (
        <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
          💡 {integration.fallbackStrategy}
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onConfigure(integration.id)}
          className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {integration.status === 'active' ? 'Edit' : 'Configure'}
        </button>
        {integration.status === 'active' && (
          <button
            onClick={() => onTest(integration.id)}
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Test
          </button>
        )}
        {integration.docsUrl && (
          <a
            href={integration.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Documentation"
          >
            📄
          </a>
        )}
      </div>
    </div>
  );
};

// Configuration modal
const ConfigureModal: React.FC<{
  integration: IntegrationConfig | null;
  onClose: () => void;
  onSave: (id: string, values: Record<string, string>) => void;
}> = ({ integration, onClose, onSave }) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  if (!integration) return null;

  const handleSave = () => {
    onSave(integration.id, values);
    onClose();
  };

  const generateSecret = (key: string) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let secret = '';
    for (let i = 0; i < 64; i++) {
      secret += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setValues({ ...values, [key]: secret });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Configure {integration.name}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {integration.description}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {integration.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <div className="relative">
                <input
                  type={field.type === 'password' && !showSecrets[field.key] ? 'password' : 'text'}
                  value={values[field.key] || field.value || ''}
                  onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {field.type === 'password' && (
                  <button
                    type="button"
                    onClick={() => setShowSecrets({ ...showSecrets, [field.key]: !showSecrets[field.key] })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showSecrets[field.key] ? '🙈' : '👁️'}
                  </button>
                )}
              </div>
              {field.hint && (
                <p className="text-xs text-gray-500 mt-1">{field.hint}</p>
              )}
              {field.key === 'JWT_SECRET' && (
                <button
                  type="button"
                  onClick={() => generateSecret(field.key)}
                  className="mt-1 text-xs text-blue-600 hover:text-blue-700"
                >
                  🎲 Generate secure secret
                </button>
              )}
            </div>
          ))}

          {integration.fallbackStrategy && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>💡 Fallback:</strong> {integration.fallbackStrategy}
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};

// Category icons
const categoryIcons: Record<string, string> = {
  'AI Providers': '🧠',
  'Database': '🗄️',
  'Payments': '💳',
  'Email': '📧',
  'Authentication': '🔐',
  'Chat Channels': '💬',
  'Vector Store': '🔍',
  'Analytics': '📊',
  'Content Verification': '✅'
};

// Main component
export const CEOIntegrations: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [configuringIntegration, setConfiguringIntegration] = useState<IntegrationConfig | null>(null);
  const [integrationsState, setIntegrationsState] = useState(integrations);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Get unique categories
  const categories = ['all', ...new Set(integrations.map(i => i.category))];

  // Filter integrations
  const filteredIntegrations = integrationsState.filter(i => {
    const matchesCategory = selectedCategory === 'all' || i.category === selectedCategory;
    const matchesSearch = i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          i.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Group by category
  const groupedIntegrations = filteredIntegrations.reduce((acc, i) => {
    if (!acc[i.category]) acc[i.category] = [];
    acc[i.category].push(i);
    return acc;
  }, {} as Record<string, IntegrationConfig[]>);

  // Stats
  const stats = {
    total: integrationsState.length,
    active: integrationsState.filter(i => i.status === 'active').length,
    required: integrationsState.filter(i => i.required).length,
    requiredActive: integrationsState.filter(i => i.required && i.status === 'active').length
  };

  const handleConfigure = (id: string) => {
    const integration = integrationsState.find(i => i.id === id);
    setConfiguringIntegration(integration || null);
  };

  const handleSave = (id: string, values: Record<string, string>) => {
    void values; // used in real implementation
    // Update local state to show as active
    setIntegrationsState(prev => prev.map(i => 
      i.id === id 
        ? { ...i, status: 'active' as IntegrationStatus, health: 100, lastChecked: 'just now' }
        : i
    ));
    setToast(`Configuration saved for ${id}`);
    setTimeout(() => setToast(null), 3000);
  };

  const handleTest = (id: string) => {
    setToast(`Testing ${id} connection...`);
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-4 right-4 bg-surface-800 border border-surface-700 rounded-xl p-4 text-sm text-white shadow-xl z-50 flex items-center gap-3">
          {toast}
          <button onClick={() => setToast(null)} className="ml-3 text-surface-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🔌 Integrations
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Configure external services and API connections
          </p>
        </div>
        <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
          📥 Import .env
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.active}/{stats.total}</div>
          <div className="text-sm text-gray-500">Active Integrations</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-green-600">{stats.requiredActive}/{stats.required}</div>
          <div className="text-sm text-gray-500">Required Ready</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-blue-600">{categories.length - 1}</div>
          <div className="text-sm text-gray-500">Categories</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-purple-600">
            {stats.requiredActive === stats.required ? '✅' : '⚠️'}
          </div>
          <div className="text-sm text-gray-500">System Status</div>
        </div>
      </div>

      {/* Required integrations warning */}
      {stats.requiredActive < stats.required && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                Required Integrations Missing
              </h3>
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                Configure the following to run EduGenius:
              </p>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-2 space-y-1">
                {integrationsState
                  .filter(i => i.required && i.status !== 'active')
                  .map(i => (
                    <li key={i.id} className="flex items-center gap-2">
                      <span>•</span>
                      <button
                        onClick={() => handleConfigure(i.id)}
                        className="underline hover:no-underline"
                      >
                        {i.name}
                      </button>
                    </li>
                  ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Search and filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Integrations by category */}
      {Object.entries(groupedIntegrations).map(([category, items]) => (
        <div key={category}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            {categoryIcons[category] || '📦'}
            {category}
            <span className="text-sm font-normal text-gray-500">
              ({items.filter(i => i.status === 'active').length}/{items.length} active)
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map(integration => (
              <IntegrationCard
                key={integration.id}
                integration={integration}
                onConfigure={handleConfigure}
                onTest={handleTest}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Empty state */}
      {filteredIntegrations.length === 0 && (
        <div className="text-center py-12">
          <span className="text-4xl">🔌</span>
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No integrations found
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Try adjusting your search or filter
          </p>
        </div>
      )}

      {/* Quick setup guide */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
          🚀 Quick Setup Guide
        </h3>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              1. Minimum Viable
            </h4>
            <ul className="text-blue-700 dark:text-blue-300 space-y-1">
              <li>✓ Gemini API Key</li>
              <li>✓ PostgreSQL</li>
              <li>✓ JWT Secret</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              2. Ready for Payments
            </h4>
            <ul className="text-blue-700 dark:text-blue-300 space-y-1">
              <li>+ Stripe or Razorpay</li>
              <li>+ SendGrid for emails</li>
              <li>+ Google OAuth</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
              3. Full Production
            </h4>
            <ul className="text-blue-700 dark:text-blue-300 space-y-1">
              <li>+ Multiple LLM fallbacks</li>
              <li>+ WhatsApp/Telegram</li>
              <li>+ Redis + Pinecone</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Configure modal */}
      <ConfigureModal
        integration={configuringIntegration}
        onClose={() => setConfiguringIntegration(null)}
        onSave={handleSave}
      />
    </div>
  );
};

export default CEOIntegrations;