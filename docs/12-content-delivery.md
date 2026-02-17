# Content Delivery System

## Overview

The EduGenius Content Delivery System provides a comprehensive pipeline for creating, managing, and publishing educational content across multiple platforms. It includes:

- **Prompt Repository** — Wolfram-style prompt management with modifiers and A/B testing
- **Blog Pipeline** — Multi-platform blog publishing
- **Vlog Pipeline** — Multi-channel video content
- **Landing Pages** — Template-based landing page generation
- **Content Calendar** — Automated scheduling and cadence management

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Content Delivery System                      │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  Prompt Repo    │  Content Engine │  Distribution               │
│  ─────────────  │  ─────────────  │  ─────────────              │
│  • Templates    │  • Blog Posts   │  • Self-hosted              │
│  • Modifiers    │  • Vlogs        │  • Medium                   │
│  • A/B Testing  │  • Landing Pgs  │  • YouTube                  │
│  • Tracking     │  • Calendar     │  • Instagram                │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

## Prompt Repository

### Creating Prompts

```typescript
import { promptRepository } from 'edugenius';

const prompt = await promptRepository.createPrompt({
  id: 'blog-post',
  name: 'Blog Post Generator',
  template: `Write a blog post about {{topic}} for {{exam}} students.
    
Audience: {{audience}}
Tone: {{tone}}
Length: {{length}} words`,
  category: 'content',
  variables: [
    { name: 'topic', required: true },
    { name: 'exam', required: true },
    { name: 'audience', required: false, defaultValue: 'students' },
    { name: 'tone', required: false, defaultValue: 'educational' },
    { name: 'length', required: false, defaultValue: '800' },
  ],
});
```

### Using Modifiers

Modifiers transform prompt output. Available categories:

| Category | Modifiers |
|----------|-----------|
| Tone | `formal`, `casual`, `technical`, `conversational` |
| Language | `en`, `hi`, `hinglish`, `te`, `ta`, `mr`, `bn`, `gu`, `kn`, `ml` |
| Format | `markdown`, `html`, `plain`, `bullet-points`, `numbered` |
| Audience | `beginner`, `intermediate`, `advanced`, `professional` |
| Exam Style | `jee`, `neet`, `board`, `competitive`, `olympiad` |
| Output | `short`, `detailed`, `step-by-step`, `summary` |

```typescript
const result = await promptRepository.execute('blog-post', 
  { topic: 'Quadratic Equations', exam: 'JEE' },
  ['tone:casual', 'lang:hinglish', 'audience:beginner']
);
```

### A/B Testing

```typescript
// Create variants
await promptRepository.createVariant('blog-post', {
  id: 'variant-a',
  name: 'Storytelling Approach',
  template: 'Start with a story about {{topic}}...',
  weight: 50,
});

await promptRepository.createVariant('blog-post', {
  id: 'variant-b',
  name: 'Problem-First Approach',
  template: 'Consider this problem about {{topic}}...',
  weight: 50,
});

// Execution automatically selects and tracks variants
const result = await promptRepository.execute('blog-post', variables);
console.log(result.variantId); // 'variant-a' or 'variant-b'
```

## Blog Pipeline

### Creating Posts

```typescript
import { blogPipeline } from 'edugenius';

const post = await blogPipeline.createPost({
  title: 'Mastering Integration by Parts',
  content: '# Introduction\n\nIntegration by parts is...',
  excerpt: 'Learn the powerful technique of integration by parts',
  category: 'mathematics',
  tags: ['calculus', 'integration', 'jee'],
  exam: 'JEE',
  subject: 'mathematics',
  seo: {
    metaTitle: 'Integration by Parts | JEE Mathematics',
    metaDescription: 'Master integration by parts for JEE with step-by-step examples',
    focusKeyword: 'integration by parts',
    keywords: ['integration', 'calculus', 'jee math'],
  },
});
```

### Multi-Platform Publishing

```typescript
// Schedule for self-hosted
await blogPipeline.schedulePublish(post.id, 'self-hosted', {
  publishAt: Date.now() + 3600000, // 1 hour from now
});

// Schedule for Medium
await blogPipeline.schedulePublish(post.id, 'medium', {
  publishAt: Date.now() + 7200000, // 2 hours from now
});

// Supported platforms: 'self-hosted', 'medium', 'wordpress', 'substack'
```

## Vlog Pipeline

### Creating Videos

```typescript
import { vlogPipeline } from 'edugenius';

const vlog = await vlogPipeline.createVlog({
  title: 'Newton\'s Laws Explained',
  description: 'Understanding all three laws of motion',
  script: {
    sections: [
      { title: 'Hook', content: 'What keeps planets in orbit?', duration: 15 },
      { title: 'First Law', content: 'Objects at rest stay at rest...', duration: 90 },
      { title: 'Second Law', content: 'F = ma explained...', duration: 120 },
      { title: 'Third Law', content: 'Action and reaction...', duration: 90 },
      { title: 'Outro', content: 'Subscribe for more!', duration: 15 },
    ],
    totalDuration: 330,
  },
  tags: ['physics', 'newton', 'mechanics'],
  exam: 'JEE',
});
```

### Multi-Channel Publishing

```typescript
// YouTube (long-form)
await vlogPipeline.schedulePublish(vlog.id, 'youtube', {
  publishAt: Date.now() + 86400000,
});

// Instagram Reels (short clips)
await vlogPipeline.schedulePublish(vlog.id, 'instagram-reels', {
  publishAt: Date.now() + 86400000,
});

// Supported: 'youtube', 'instagram-reels', 'tiktok', 'linkedin'
```

## Landing Pages

### Templates

| Template | Use Case |
|----------|----------|
| `hero-features-cta` | Standard marketing page |
| `comparison` | Product comparisons |
| `free-tool` | Lead gen tools |
| `waitlist` | Pre-launch signups |
| `exam-specific` | Exam landing pages |
| `course-promo` | Course promotions |
| `testimonials` | Social proof pages |
| `pricing` | Pricing pages |

### Creating Pages

```typescript
import { landingPageManager } from 'edugenius';

const page = await landingPageManager.createPage({
  title: 'JEE Main 2026 Preparation',
  slug: 'jee-main-2026',
  template: 'exam-specific',
  exam: 'JEE',
  variables: {
    examName: 'JEE Main 2026',
    headline: 'Crack JEE Main with AI-Powered Learning',
    subheadline: 'Join 50,000+ students already preparing smarter',
    ctaText: 'Start Free Trial',
    ctaUrl: '/signup?exam=jee',
  },
});

// Add custom sections
await landingPageManager.addSection(page.id, {
  type: 'features',
  title: 'Why Choose Us?',
  content: {
    features: [
      { icon: '🤖', title: 'AI Tutor', description: '24/7 doubt solving' },
      { icon: '📊', title: 'Analytics', description: 'Track your progress' },
    ],
  },
  order: 2,
});
```

### A/B Testing Landing Pages

```typescript
// Create variant
const variantId = await landingPageManager.createVariant(page.id, 'urgency-cta', {
  variables: {
    ...page.variables,
    headline: 'Only 180 Days Left for JEE Main 2026!',
    ctaText: 'Start Now - Free',
  },
});

// Track performance
const results = await landingPageManager.getVariantPerformance(page.id);
console.log(results.winner); // 'urgency-cta' if it wins
```

## Content Calendar

### Scheduling

```typescript
import { contentCalendarManager } from 'edugenius';

await contentCalendarManager.scheduleContent({
  title: 'Organic Chemistry Basics',
  type: 'blog',
  exam: 'NEET',
  subject: 'chemistry',
  scheduledDate: Date.now() + 86400000,
  priority: 'high',
  status: 'scheduled',
});
```

### Auto-Fill Calendar

```typescript
await contentCalendarManager.autoFillCalendar({
  exam: 'JEE',
  startDate: new Date('2026-03-01'),
  endDate: new Date('2026-03-31'),
  cadence: {
    blogsPerWeek: 5,
    videosPerWeek: 3,
  },
});
```

## Integration with Agents

### Atlas (Content Engine)

```typescript
import { atlasContentIntegration } from 'edugenius';

// Create content with exam-aware prompts
const result = await atlasContentIntegration.createContent({
  examCode: 'JEE',
  topic: 'Electromagnetic Induction',
  contentType: 'both', // blog + vlog
  subject: 'physics',
  urgency: 'normal',
});

// Daily content creation based on cadence
const dailyContent = await atlasContentIntegration.createDailyContent('JEE');
```

### Herald (Marketing)

```typescript
import { heraldMarketingIntegration } from 'edugenius';

// Create campaign with assets
const campaignId = await heraldMarketingIntegration.createCampaign({
  examCode: 'NEET',
  name: 'NEET 2026 Launch',
  type: 'launch',
  channels: ['social', 'email'],
  budget: 15000,
  startDate: Date.now(),
});

// Auto-creates: landing page, social posts, email templates
```

## API Endpoints

### Prompts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/prompts` | List all prompts |
| GET | `/prompts/:id` | Get prompt details |
| POST | `/prompts/:id/execute` | Execute with variables |
| GET | `/prompts/modifiers` | List available modifiers |

### Content

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/blogs` | List blog posts |
| POST | `/blogs` | Create blog post |
| POST | `/blogs/:id/publish` | Schedule publishing |
| GET | `/vlogs` | List vlogs |
| POST | `/vlogs` | Create vlog |
| GET | `/landing-pages` | List landing pages |
| POST | `/landing-pages` | Create landing page |
| GET | `/calendar` | Get content calendar |

### Deployments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/deployments` | List deployments |
| POST | `/deployments` | Create deployment |
| POST | `/deployments/:id/pilot/start` | Start pilot |
| POST | `/deployments/:id/promote` | Promote to full |
| POST | `/deployments/:id/rollback` | Rollback deployment |

## Best Practices

1. **Use modifiers consistently** — Define exam-specific modifier presets
2. **A/B test everything** — Headlines, CTAs, content formats
3. **Respect content cadence** — Don't overwhelm users
4. **Track performance** — Use Oracle integration for analytics
5. **Pilot before full launch** — Always test with restricted audience first
