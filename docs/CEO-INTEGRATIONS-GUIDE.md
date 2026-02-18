# EduGenius CEO Integrations Master Guide

> **All external connections configured in one place**

---

## Quick Summary

| Category | Required | Optional | Can Run Without |
|----------|----------|----------|-----------------|
| **LLM Providers** | 1 minimum | 3 others | ❌ No |
| **Database** | PostgreSQL | Redis | ⚠️ Limited |
| **Payments** | 1 minimum | 2nd gateway | ❌ No (for paid) |
| **Email** | 1 minimum | Backup | ⚠️ Limited |
| **Auth/SSO** | JWT Secret | OAuth | ✅ Yes |
| **Chat Channels** | None | All | ✅ Yes |
| **Vector Store** | None | Pinecone/Qdrant | ✅ Yes |
| **Analytics** | None | GA4/Mixpanel | ✅ Yes |

---

## 1. 🧠 LLM PROVIDERS (Core AI)

**Purpose:** Powers all AI tutoring, content generation, and analysis

### Primary: Google Gemini ⭐ REQUIRED

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| API Key | `GEMINI_API_KEY` | Access Gemini Pro/Flash models |

**Entry:** Single API key from [Google AI Studio](https://aistudio.google.com/)

**Cost:** ~$0.001/1K tokens (Flash), ~$0.01/1K tokens (Pro)

### Secondary: Anthropic Claude

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| API Key | `ANTHROPIC_API_KEY` | Claude models for quality-critical tasks |

**Entry:** Single API key from [Anthropic Console](https://console.anthropic.com/)

**Cost:** ~$0.003/1K tokens (Haiku), ~$0.015/1K tokens (Sonnet)

### Tertiary: OpenAI

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| API Key | `OPENAI_API_KEY` | GPT-4/GPT-3.5 fallback |

**Entry:** Single API key from [OpenAI Platform](https://platform.openai.com/)

### Local: Ollama (Free)

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| URL | `OLLAMA_URL` | Self-hosted models (default: localhost:11434) |

**Entry:** URL to Ollama instance

**Cost:** FREE (runs on your hardware)

### 🔄 Fallback Strategy (If Keys Missing)

| Scenario | Strategy |
|----------|----------|
| No Gemini | Use Anthropic → OpenAI → Ollama |
| No Anthropic | Use Gemini Pro for quality tasks |
| No cloud keys | Use Ollama local (requires server) |
| **All missing** | ❌ **CANNOT OPERATE** — at least 1 LLM required |

---

## 2. 🗄️ DATABASE & CACHE

### PostgreSQL ⭐ REQUIRED

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| Host | `POSTGRES_HOST` | Database server |
| Port | `POSTGRES_PORT` | Port (default: 5432) |
| Database | `POSTGRES_DB` | Database name |
| User | `POSTGRES_USER` | Username |
| Password | `POSTGRES_PASSWORD` | Password |
| SSL | `POSTGRES_SSL` | Enable SSL (true/false) |
| **OR** Full URL | `DATABASE_URL` | `postgres://user:pass@host:port/db` |

**Entry:** Either full URL or individual fields

### Redis (Optional but Recommended)

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| URL | `REDIS_URL` | Full connection string |
| **OR** Host | `REDIS_HOST` | Redis server |
| Port | `REDIS_PORT` | Port (default: 6379) |
| Password | `REDIS_PASSWORD` | Password (if set) |
| DB | `REDIS_DB` | Database number |

**Purpose:** Session caching, rate limiting, pub/sub events

### 🔄 Fallback Strategy (If Missing)

| Scenario | Strategy |
|----------|----------|
| No PostgreSQL | ❌ **CANNOT OPERATE** — required for all data |
| No Redis | In-memory caching (not recommended for production) |

---

## 3. 💳 PAYMENTS

### Option A: Stripe (International) ⭐ RECOMMENDED

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| Publishable Key | `STRIPE_PUBLISHABLE_KEY` | Client-side (pk_...) |
| Secret Key | `STRIPE_SECRET_KEY` | Server-side (sk_...) |
| Webhook Secret | `STRIPE_WEBHOOK_SECRET` | Verify webhooks (whsec_...) |

**Entry:** 3 keys from [Stripe Dashboard](https://dashboard.stripe.com/)

**Fees:** 2.9% + $0.30 per transaction

### Option B: Razorpay (India) ⭐ FOR INR

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| Key ID | `RAZORPAY_KEY_ID` | Public key (rzp_...) |
| Key Secret | `RAZORPAY_KEY_SECRET` | Secret key |
| Webhook Secret | `RAZORPAY_WEBHOOK_SECRET` | Verify webhooks |

**Entry:** 3 keys from [Razorpay Dashboard](https://dashboard.razorpay.com/)

**Fees:** 2% per transaction (India)

### 🔄 Fallback Strategy (If Missing)

| Scenario | Strategy |
|----------|----------|
| No Stripe | Use Razorpay only |
| No Razorpay | Use Stripe only (international cards) |
| **Both missing** | ⚠️ **FREE TIER ONLY** — no paid plans |

**Free-only mode:** Platform runs but cannot collect payments. Use for:
- Beta testing
- Pilot programs
- Free-forever users

---

## 4. 📧 EMAIL

### Option A: SendGrid ⭐ RECOMMENDED

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| API Key | `SENDGRID_API_KEY` | Send transactional + marketing emails |

**Entry:** Single API key from [SendGrid](https://app.sendgrid.com/)

**Free tier:** 100 emails/day

### Option B: Resend

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| API Key | `RESEND_API_KEY` | Modern email API |

**Entry:** Single API key from [Resend](https://resend.com/)

**Free tier:** 100 emails/day

### Option C: SMTP (Any Provider)

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| Username | `SMTP_USER` | SMTP username/email |
| Password | `SMTP_PASS` | SMTP password/app password |
| Host | `SMTP_HOST` | SMTP server (e.g., smtp.gmail.com) |
| Port | `SMTP_PORT` | Port (587 for TLS) |

**Entry:** SMTP credentials from any email provider

### 🔄 Fallback Strategy (If Missing)

| Scenario | Strategy |
|----------|----------|
| No SendGrid | Use Resend → SMTP |
| **All missing** | ⚠️ **NO EMAIL** — users don't receive: welcome emails, password resets, exam reminders, progress reports |

**No-email mode impacts:**
- Password reset → must use in-app recovery
- Welcome → skip onboarding emails
- Reminders → push/in-app only
- Progress → dashboard only (no digest)

---

## 5. 🔐 AUTHENTICATION

### Core (Always Required)

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| JWT Secret | `JWT_SECRET` | Sign auth tokens (generate: 64 random chars) |
| Site URL | `SITE_URL` | Your domain (e.g., https://edugenius.in) |

**Generate JWT Secret:**
```bash
openssl rand -hex 32
```

### OAuth: Google SSO ⭐ RECOMMENDED

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| Client ID | `GOOGLE_CLIENT_ID` | OAuth client ID |
| Client Secret | `GOOGLE_CLIENT_SECRET` | OAuth secret |
| Redirect URI | `GOOGLE_REDIRECT_URI` | Callback URL |

**Entry:** From [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

### OAuth: Microsoft SSO

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| Client ID | `MICROSOFT_CLIENT_ID` | Azure AD client ID |
| Client Secret | `MICROSOFT_CLIENT_SECRET` | Azure AD secret |
| Redirect URI | `MICROSOFT_REDIRECT_URI` | Callback URL |

**Entry:** From [Azure Portal](https://portal.azure.com/)

### OAuth: Apple SSO

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| Client ID | `APPLE_CLIENT_ID` | Services ID |
| Client Secret | `APPLE_CLIENT_SECRET` | Generated JWT |
| Redirect URI | `APPLE_REDIRECT_URI` | Callback URL |

**Entry:** From [Apple Developer Portal](https://developer.apple.com/)

### 🔄 Fallback Strategy (If Missing)

| Scenario | Strategy |
|----------|----------|
| No JWT Secret | ❌ **CANNOT OPERATE** — required |
| No Google SSO | Email/password only (higher friction) |
| No Microsoft/Apple | Skip those login options |

**Email-only auth mode:** Works fine, but:
- Higher signup friction
- Must handle password resets
- No instant verification

---

## 6. 💬 CHAT CHANNELS

### WhatsApp Business

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| Phone Number ID | `WHATSAPP_PHONE_NUMBER_ID` | Your WhatsApp Business number ID |
| Access Token | `WHATSAPP_ACCESS_TOKEN` | Meta Graph API token |
| Verify Token | `WHATSAPP_VERIFY_TOKEN` | Webhook verification |
| App Secret | `WHATSAPP_APP_SECRET` | Verify webhook signatures |

**Entry:** From [Meta Business Suite](https://business.facebook.com/)

**Setup:**
1. Create Meta Business account
2. Set up WhatsApp Business API
3. Get phone number ID and access token
4. Configure webhook URL

### Telegram Bot

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| Bot Token | `TELEGRAM_BOT_TOKEN` | From @BotFather |
| Webhook Secret | `TELEGRAM_WEBHOOK_SECRET` | Verify webhooks (optional) |

**Entry:** From [@BotFather](https://t.me/BotFather) on Telegram

**Setup:**
1. Message @BotFather → /newbot
2. Get bot token
3. Set webhook URL via API

### Google Meet (Video Tutoring)

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| Client ID | `GOOGLE_CLIENT_ID` | Same as Google SSO |
| Client Secret | `GOOGLE_CLIENT_SECRET` | Same as Google SSO |
| Refresh Token | `GOOGLE_REFRESH_TOKEN` | For calendar access |

**Entry:** Reuse Google OAuth credentials + generate refresh token

### 🔄 Fallback Strategy (If Missing)

| Scenario | Strategy |
|----------|----------|
| No WhatsApp | Web/app chat only |
| No Telegram | Web/app chat only |
| No Meet | No video tutoring (text only) |
| **All missing** | ✅ **WORKS FINE** — web platform is primary |

**Web-only mode:** Fully functional. Chat channels are reach extensions, not requirements.

---

## 7. 🔍 VECTOR STORE (Semantic Search)

### Option A: Pinecone

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| API Key | `PINECONE_API_KEY` | Access Pinecone |
| Environment | `PINECONE_ENVIRONMENT` | Region (e.g., us-east1-gcp) |
| Index | `PINECONE_INDEX` | Index name |

**Entry:** From [Pinecone Console](https://app.pinecone.io/)

### Option B: Qdrant

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| URL | `QDRANT_URL` | Qdrant server URL |
| API Key | `QDRANT_API_KEY` | Access key (if cloud) |
| Collection | `QDRANT_COLLECTION` | Collection name |

**Entry:** Self-hosted or [Qdrant Cloud](https://cloud.qdrant.io/)

### Configuration

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| Provider | `VECTOR_STORE_PROVIDER` | `pinecone`, `qdrant`, or `memory` |

### 🔄 Fallback Strategy (If Missing)

| Scenario | Strategy |
|----------|----------|
| No Pinecone | Use Qdrant |
| No Qdrant | Use in-memory (limited to 10K vectors) |
| **Both missing** | ✅ In-memory works for small scale |

**In-memory mode:** Works for:
- Development
- Small content libraries (<10K items)
- Single-server deployments

---

## 8. 📊 ANALYTICS (Optional)

### Google Analytics 4

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| Measurement ID | `GA4_MEASUREMENT_ID` | GA4 property ID (G-XXXXX) |
| API Secret | `GA4_API_SECRET` | Server-side events |

**Entry:** From [Google Analytics](https://analytics.google.com/)

### Mixpanel

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| Token | `MIXPANEL_TOKEN` | Project token |
| API Secret | `MIXPANEL_API_SECRET` | Server-side events |

**Entry:** From [Mixpanel](https://mixpanel.com/)

### 🔄 Fallback Strategy (If Missing)

| Scenario | Strategy |
|----------|----------|
| **All missing** | ✅ **WORKS FINE** — internal Oracle analytics only |

**No external analytics mode:** Oracle agent tracks everything internally. External tools just add more visibility.

---

## 9. 🌐 INFRASTRUCTURE

### Core

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| Node Environment | `NODE_ENV` | `development`, `staging`, `production` |
| Port | `PORT` | Server port (default: 3000) |
| Site URL | `SITE_URL` | Public URL |

### CDN/Storage (Future)

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| AWS Access Key | `AWS_ACCESS_KEY_ID` | S3/CloudFront |
| AWS Secret | `AWS_SECRET_ACCESS_KEY` | S3/CloudFront |
| GCS Credentials | `GOOGLE_APPLICATION_CREDENTIALS` | GCS bucket |

---

## 🎯 MINIMUM VIABLE SETUP

To run EduGenius at minimum, you need:

```env
# === ABSOLUTELY REQUIRED ===
GEMINI_API_KEY=your_gemini_key          # AI tutoring
DATABASE_URL=postgres://...             # Data storage
JWT_SECRET=random_64_char_string        # Auth tokens

# === RECOMMENDED ===
STRIPE_SECRET_KEY=sk_...                # Payments (or Razorpay)
STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
SENDGRID_API_KEY=SG....                 # Email (or Resend)

# === NICE TO HAVE ===
GOOGLE_CLIENT_ID=...                    # SSO
GOOGLE_CLIENT_SECRET=...
REDIS_URL=redis://...                   # Caching
```

---

## 🚀 RECOMMENDED PRODUCTION SETUP

```env
# === LLM (Primary + Fallback) ===
GEMINI_API_KEY=...
ANTHROPIC_API_KEY=...

# === Database ===
DATABASE_URL=postgres://user:pass@host:5432/edugenius?ssl=require
REDIS_URL=redis://...

# === Auth ===
JWT_SECRET=<64-char-random>
SITE_URL=https://edugenius.in
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://edugenius.in/auth/google/callback

# === Payments ===
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# === Email ===
SENDGRID_API_KEY=SG....

# === Chat Channels ===
TELEGRAM_BOT_TOKEN=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...

# === Vector Store ===
PINECONE_API_KEY=...
PINECONE_ENVIRONMENT=us-east1-gcp
PINECONE_INDEX=edugenius
```

---

## CEO Dashboard Entry Points

In the CEO dashboard, these will be grouped as:

### 🧠 AI Configuration
- Gemini API Key (required) ⭐
- Anthropic API Key (recommended)
- OpenAI API Key (optional)
- Ollama URL (optional)

### 💳 Payment Gateways
- Stripe Keys (international)
- Razorpay Keys (India)

### 📧 Email Service
- SendGrid API Key
- Resend API Key
- SMTP Settings

### 🔐 Authentication
- JWT Secret (auto-generated)
- Google OAuth
- Microsoft OAuth
- Apple OAuth

### 💬 Chat Channels
- WhatsApp Business
- Telegram Bot
- Google Meet

### 📊 Analytics
- Google Analytics 4
- Mixpanel

### 🗄️ Database
- PostgreSQL URL
- Redis URL

### 🔍 Vector Store
- Pinecone
- Qdrant

---

## Integration Status Dashboard

The CEO sees a status dashboard showing:

| Integration | Status | Health | Last Checked |
|-------------|--------|--------|--------------|
| Gemini | ✅ Active | 100% | 2 min ago |
| Anthropic | ⚠️ Fallback | Ready | 2 min ago |
| PostgreSQL | ✅ Active | 100% | 1 min ago |
| Stripe | ✅ Active | 100% | 5 min ago |
| SendGrid | ✅ Active | 98% | 3 min ago |
| WhatsApp | ❌ Not Configured | - | - |
| Telegram | ✅ Active | 100% | 1 min ago |

---

## 10. ✅ CONTENT VERIFICATION (Critical)

**Purpose:** Ensure all generated educational content is mathematically/scientifically correct

### Wolfram Alpha ⭐ REQUIRED

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| App ID | `WOLFRAM_APP_ID` | Verify math expressions and solutions |

**Entry:** From [Wolfram Developer Portal](https://developer.wolframalpha.com/)

**Why Required:** Every math solution must be verified before delivery to students. This is non-negotiable for educational content.

### SymPy Cloud

| Key | Environment Variable | Purpose |
|-----|---------------------|---------|
| Endpoint | `SYMPY_ENDPOINT` | Cloud function for symbolic math |
| API Key | `SYMPY_API_KEY` | Authentication (optional) |

**Entry:** Deploy your own or use third-party

### 🔄 Verification Fallback Strategy

| Scenario | Strategy |
|----------|----------|
| No Wolfram | LLM Consensus (3+ LLMs agree) + SymPy |
| No SymPy | Wolfram + LLM Consensus |
| **Both missing** | ⚠️ **LLM Consensus only** — higher error risk |

**Verification Flow:**
1. Content generated by any LLM
2. Wolfram Alpha validates math/physics
3. SymPy confirms symbolic manipulation
4. If any fails → LLM Consensus checks
5. Failed content → flagged for human review

---

## 🔁 LLM PROVIDER STRATEGY

The system is **fully provider-agnostic**. Add any LLM provider:

### Built-in Providers

| Provider | Speed | Cost | Best For |
|----------|-------|------|----------|
| Gemini | Fast | Low | General + Flash tasks |
| Anthropic | Medium | Medium | Quality + Reasoning |
| OpenAI | Medium | High | Complex + Vision |
| Groq | Ultra-fast | Low | Real-time responses |
| DeepSeek | Medium | Very Low | Reasoning (R1) |
| Mistral | Fast | Low | Code + European |
| Together | Fast | Low | Open-source models |
| OpenRouter | Varies | Varies | Access all providers |
| Ollama | Fast | FREE | Self-hosted |
| LearnLM | Medium | Medium | Pedagogical tasks |

### Provider Priority (Admin configurable)

```
Priority 1: Primary provider (e.g., Gemini)
Priority 2: Quality fallback (e.g., Anthropic)
Priority 3: Speed fallback (e.g., Groq)
Priority 4: Cost fallback (e.g., DeepSeek)
Priority 5: Local (e.g., Ollama)
Priority 6: Universal (e.g., OpenRouter)
```

### Task-Based Routing

| Task Type | Routes To |
|-----------|-----------|
| Quick Q&A | Fastest (Groq → Gemini Flash) |
| Explanations | Educational (LearnLM → Gemini Pro) |
| Complex Reasoning | Quality (Anthropic → DeepSeek R1) |
| Code Generation | Specialized (Mistral → OpenAI) |
| Content Generation | Primary (Gemini → Anthropic) |

---

*Last updated: 2026-02-18*
