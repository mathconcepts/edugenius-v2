# Website + Portal Architecture

## Overview

EduGenius has two user-facing applications:

1. **Website** (`/website/*`) — Public marketing site for visitors
2. **Portal** (`/`) — Logged-in user experience (student, teacher, admin, CEO)

Both share the same React codebase but serve different purposes.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      EduGenius Frontend                          │
├─────────────────────────────┬───────────────────────────────────┤
│       PUBLIC WEBSITE        │           PORTAL (APP)            │
│       /website/*            │           /*                       │
├─────────────────────────────┼───────────────────────────────────┤
│  • Home (landing)           │  • Dashboard (role-based)         │
│  • Pricing                  │  • Learn (topics, subjects)       │
│  • Blog (Atlas content)     │  • Notebook (Sage AI)             │
│  • Exam pages (JEE/NEET)    │  • Progress (Oracle insights)     │
│  • Features                 │  • Chat (Sage tutor)              │
│  • About / Contact          │  • Agents (admin view)            │
│  • Signup / Login           │  • Analytics (CEO view)           │
│                             │  • Content (admin manage)         │
│                             │  • Students (teacher view)        │
├─────────────────────────────┴───────────────────────────────────┤
│                        SHARED SERVICES                           │
├─────────────────────────────────────────────────────────────────┤
│  • Content API (Atlas)      • Prompts API                       │
│  • User API                 • Exam Config API                   │
│  • Analytics API (Oracle)   • Deployment API                    │
└─────────────────────────────────────────────────────────────────┘
```

## Routes

### Website Routes (`/website/*`)

| Route | Page | Content Source |
|-------|------|----------------|
| `/website` | Home | Static + dynamic stats |
| `/website/pricing` | Pricing | Static + exam configs |
| `/website/blog` | Blog list | Atlas content API |
| `/website/blog/:slug` | Blog post | Atlas content API |
| `/website/exams/:code` | Exam landing | Exam config API |
| `/website/features` | Features | Static |
| `/website/about` | About | Static |
| `/website/contact` | Contact | Static |
| `/website/signup` | Signup | User API |
| `/website/demo` | Demo | Static video |

### Portal Routes (`/*`)

| Route | Page | Role | AI Agent |
|-------|------|------|----------|
| `/` | Dashboard | All | Multiple |
| `/learn` | Topics | Student | Sage |
| `/notebook` | Notebook | Student | Sage |
| `/progress` | Progress | Student | Oracle |
| `/chat` | AI Chat | Student | Sage |
| `/students` | Students | Teacher | Mentor |
| `/content` | Content | Admin | Atlas |
| `/analytics` | Analytics | CEO/Admin | Oracle |
| `/agents` | Agents | Admin | All |
| `/preview` | Role Preview | Demo | — |

## Content Flow: Website ↔ Portal

### Blog Content Flow

```
Atlas Agent → Blog Pipeline → Content API
                    ↓
    ┌───────────────┴───────────────┐
    ↓                               ↓
Website Blog Page           Portal Content Manager
(/website/blog)             (/content)
```

1. **Atlas** generates blog content (via prompts)
2. **Blog Pipeline** schedules and publishes
3. **Website** displays published posts
4. **Portal** allows admins to manage content

### Exam Content Flow

```
Exam Config API → Deployment Manager → Feature Flags
        ↓                 ↓
    Website           Portal
    (/website/exams)  (student experience)
```

1. **Exam Config** defines subjects, cadence, pricing
2. **Deployment Manager** controls pilot/full mode
3. **Website** shows exam-specific landing pages
4. **Portal** delivers appropriate content per exam

### User Journey

```
Website                    Portal
────────────────────────   ────────────────────────
1. Visit /website          
2. Browse /website/exams/jee
3. Click "Start Free Trial"
4. Signup form              → Create account
5. ─────────────────────────→ Redirect to /learn
                            6. Select subject
                            7. Start learning
                            8. Track progress
```

## Dependencies & Missing Items

### Required for MVP

| Component | Status | Notes |
|-----------|--------|-------|
| Website Home | ✅ Done | Static + dynamic stats |
| Website Pricing | ✅ Done | Needs Stripe integration |
| Website Blog | ✅ Done | Needs Atlas API connection |
| Website Exam Pages | ✅ Done | Needs exam config API |
| Portal Dashboard | ✅ Done | Role-based views |
| Portal Learn | ✅ Done | Needs content API |
| Portal Notebook | ✅ Done | Needs Sage AI integration |
| Portal Progress | ✅ Done | Needs analytics API |
| Portal Chat | ✅ Done | Needs Sage AI integration |

### Missing / To Implement

| Component | Priority | Dependency |
|-----------|----------|------------|
| **Authentication** | High | User API, session management |
| **Signup Flow** | High | Auth, exam selection |
| **Payment Integration** | High | Stripe/Razorpay |
| **Real Content API** | High | Backend connection |
| **Real AI Integration** | High | Gemini/Anthropic keys |
| **SEO Optimization** | Medium | Meta tags, sitemap |
| **Analytics Tracking** | Medium | GA4/Mixpanel |
| **Email Integration** | Medium | Newsletters, notifications |
| **Mobile App** | Low | React Native wrapper |

## Implementation Strategy

### Phase 1: Core Website (Week 1)
1. ✅ Homepage with dynamic content
2. ✅ Pricing page with plans
3. ✅ Blog with Atlas content
4. ✅ Exam-specific landing pages
5. Add signup/login flows
6. Connect to user API

### Phase 2: Portal Integration (Week 2)
1. ✅ Role-based dashboards
2. ✅ Learning interface
3. ✅ Smart notebook
4. ✅ Progress tracking
5. Connect to real APIs
6. Integrate AI agents

### Phase 3: Content Pipeline (Week 3)
1. Connect Atlas to blog pipeline
2. Auto-publish new content
3. SEO optimization
4. Social sharing integration

### Phase 4: Payments & Users (Week 4)
1. Stripe/Razorpay integration
2. Subscription management
3. Free trial flow
4. Parent dashboard

### Phase 5: Production (Week 5)
1. Domain setup
2. SSL certificates
3. CDN configuration
4. Performance optimization
5. Analytics setup

## API Connections Needed

### Website → Backend

```typescript
// Content for blog
GET /api/blogs?status=published

// Exam config for landing pages
GET /api/exam-configs/:code

// Stats for homepage
GET /api/stats/public

// Signup
POST /api/auth/signup

// Newsletter
POST /api/newsletter/subscribe
```

### Portal → Backend

```typescript
// AI Chat (Sage)
POST /api/tutoring/sessions/:id/ask

// Content (Atlas)
GET /api/content?exam=:exam&type=:type

// Progress (Oracle)
GET /api/analytics/student/:id

// Notebook (Sage)
POST /api/notebook/solve
```

## Deployment

### Recommended Setup

```
┌─────────────────────────────────────────────────────────────┐
│                         Vercel                               │
├─────────────────────────────────────────────────────────────┤
│  Frontend (React)                                           │
│  ├── /website/* → Public pages (SSG/ISR)                    │
│  └── /* → Portal (SPA)                                      │
├─────────────────────────────────────────────────────────────┤
│                         API Gateway                          │
├─────────────────────────────────────────────────────────────┤
│  Backend (Node.js)                                          │
│  ├── /api/blogs/*                                           │
│  ├── /api/tutoring/*                                        │
│  ├── /api/analytics/*                                       │
│  └── /api/auth/*                                            │
└─────────────────────────────────────────────────────────────┘
```

### Environment Variables

```env
# Frontend
VITE_API_URL=https://api.edugenius.ai
VITE_WS_URL=wss://api.edugenius.ai
VITE_GA_ID=G-XXXXXXXXXX

# Backend
GEMINI_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
DATABASE_URL=xxx
STRIPE_SECRET_KEY=xxx
```

## Quick Start

```bash
# Run website + portal
cd edugenius/frontend
npm install
npm run dev

# Visit:
# - http://localhost:5173/website  → Public website
# - http://localhost:5173/         → Portal (login)
# - http://localhost:5173/preview  → Role preview mode
```
