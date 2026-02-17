# Exam Configuration

## Overview

Each exam in EduGenius has a comprehensive configuration that defines its nature, format, content cadence, language support, and marketing budget. The system comes with pre-configured defaults for major Indian competitive exams.

## Default Exam Configs

| Exam | Type | Level | Subjects |
|------|------|-------|----------|
| JEE | Entrance | Undergraduate | Physics, Chemistry, Math |
| NEET | Entrance | Undergraduate | Physics, Chemistry, Biology |
| CBSE 10 | Board | School | All subjects |
| CBSE 12 | Board | School | All subjects |
| CAT | Entrance | Graduate | VARC, DILR, QA |
| UPSC | Competitive | Graduate | General Studies |

## Configuration Structure

### Exam Nature

```typescript
interface ExamNature {
  type: 'entrance' | 'board' | 'competitive' | 'olympiad';
  level: 'school' | 'undergraduate' | 'graduate' | 'professional';
  frequency: 'annual' | 'biannual' | 'quarterly' | 'monthly';
  importance: 'critical' | 'high' | 'medium' | 'low';
}
```

### Exam Format

```typescript
interface ExamFormat {
  questionTypes: QuestionType[];
  totalMarks: number;
  duration: number; // minutes
  sections: SectionFormat[];
  negativemarking: boolean;
  negativeMarkingRatio: number;
  calculator: 'none' | 'basic' | 'scientific';
}

interface QuestionType {
  type: 'mcq' | 'numerical' | 'short' | 'long' | 'match' | 'assertion';
  weight: number; // percentage
  marks: number;
}

interface SectionFormat {
  name: string;
  subjects: string[];
  mandatory: boolean;
  questionCount: number;
  marks: number;
}
```

## Creating Exam Configs

```typescript
import { examConfigManager } from 'edugenius';

const config = await examConfigManager.createConfig({
  name: 'JEE Advanced 2026',
  code: 'JEE-ADV',
  nature: {
    type: 'entrance',
    level: 'undergraduate',
    frequency: 'annual',
    importance: 'critical',
  },
  format: {
    questionTypes: [
      { type: 'mcq', weight: 60, marks: 3 },
      { type: 'numerical', weight: 40, marks: 4 },
    ],
    totalMarks: 360,
    duration: 180,
    sections: [
      { name: 'Paper 1', subjects: ['physics', 'chemistry', 'mathematics'], mandatory: true, questionCount: 54, marks: 180 },
      { name: 'Paper 2', subjects: ['physics', 'chemistry', 'mathematics'], mandatory: true, questionCount: 54, marks: 180 },
    ],
    negativemarking: true,
    negativeMarkingRatio: 1,
    calculator: 'none',
  },
  subjects: [
    { code: 'PHY', name: 'Physics', weight: 33.33, chapters: 20 },
    { code: 'CHE', name: 'Chemistry', weight: 33.33, chapters: 25 },
    { code: 'MAT', name: 'Mathematics', weight: 33.33, chapters: 18 },
  ],
  difficultyDistribution: { easy: 20, medium: 50, hard: 30 },
  contentCadence: {
    questionsPerDay: 75,
    blogsPerWeek: 5,
    videosPerWeek: 4,
    practiceTestsPerMonth: 6,
    revisionsPerChapter: 4,
  },
  languages: [
    { code: 'en', name: 'English', priority: 1, coverage: 100 },
    { code: 'hi', name: 'Hindi', priority: 2, coverage: 80 },
  ],
  marketingBudget: {
    total: 50000,
    channels: {
      social: 30,
      email: 15,
      ads: 35,
      influencer: 15,
      content: 5,
    },
  },
  deploymentMode: 'pilot',
});
```

## Content Cadence

Content cadence defines how much content to produce daily/weekly/monthly:

```typescript
interface ContentCadence {
  questionsPerDay: number;      // Practice questions
  blogsPerWeek: number;         // Blog posts
  videosPerWeek: number;        // Video content
  practiceTestsPerMonth: number; // Full-length tests
  revisionsPerChapter: number;   // Revision sessions per chapter
}
```

### Recommended Cadence by Exam Type

| Exam Type | Questions/Day | Blogs/Week | Videos/Week | Tests/Month |
|-----------|---------------|------------|-------------|-------------|
| JEE/NEET | 50-75 | 4-5 | 3-4 | 4-6 |
| Board | 30-40 | 2-3 | 2 | 2-3 |
| CAT | 25-35 | 2 | 1-2 | 4 |
| UPSC | 20-30 | 5-6 | 2 | 3-4 |

### Adjusting Cadence

```typescript
// Scale cadence based on exam timeline
await examConfigManager.adjustContentCadence('JEE-ADV', 1.5); // 50% more content

// Get current cadence
const config = await examConfigManager.getConfigByCode('JEE-ADV');
console.log(config?.contentCadence);
```

## Difficulty Distribution

```typescript
interface DifficultyDistribution {
  easy: number;   // percentage
  medium: number; // percentage
  hard: number;   // percentage
}
```

### Recommended Distribution

| Exam | Easy | Medium | Hard |
|------|------|--------|------|
| JEE Main | 30% | 50% | 20% |
| JEE Advanced | 20% | 50% | 30% |
| NEET | 35% | 45% | 20% |
| Board | 40% | 40% | 20% |
| CAT | 25% | 50% | 25% |

## Language Support

```typescript
interface LanguageConfig {
  code: string;      // ISO code or custom
  name: string;
  priority: number;  // 1 = primary
  coverage: number;  // % of content in this language
}
```

### Supported Languages

| Code | Language | Notes |
|------|----------|-------|
| `en` | English | Default for all |
| `hi` | Hindi | Second language for most |
| `hinglish` | Hinglish | Code-mixed for engagement |
| `te` | Telugu | South India |
| `ta` | Tamil | South India |
| `mr` | Marathi | Maharashtra |
| `bn` | Bengali | East India |
| `gu` | Gujarati | Gujarat |
| `kn` | Kannada | Karnataka |
| `ml` | Malayalam | Kerala |

### Adding Languages

```typescript
await examConfigManager.addLanguage('JEE-ADV', {
  code: 'hinglish',
  name: 'Hinglish',
  priority: 3,
  coverage: 40,
});
```

## Marketing Budget

```typescript
interface MarketingBudget {
  total: number;
  channels: {
    social: number;     // % allocation
    email: number;
    ads: number;
    influencer: number;
    content: number;
  };
}
```

### Budget Allocation

```typescript
await examConfigManager.allocateBudget('JEE-ADV', {
  social: 25,
  email: 20,
  ads: 30,
  influencer: 15,
  content: 10,
}); // Must sum to 100
```

## Prompt Modifiers

Each exam config generates appropriate prompt modifiers:

```typescript
const modifiers = await examConfigManager.getPromptModifiers('JEE-ADV');
// ['style:jee', 'audience:advanced']
```

### Modifier Mapping

| Config Attribute | Modifier |
|------------------|----------|
| Exam code JEE | `style:jee` |
| Exam code NEET | `style:neet` |
| Board exam | `style:board` |
| Hard > 25% | `audience:advanced` |
| Easy > 40% | `audience:beginner` |
| Hinglish language | `lang:hinglish` |

## Validation

```typescript
const validation = await examConfigManager.validateConfig('JEE-ADV');
// {
//   valid: true,
//   errors: []
// }

// Or with errors:
// {
//   valid: false,
//   errors: [
//     'Question type weights must sum to 100%',
//     'At least one language is required'
//   ]
// }
```

## Cloning Configs

```typescript
// Clone JEE Main to create JEE Advanced config
const newConfig = await examConfigManager.cloneConfig(
  'jee-main-id',
  'JEE-ADV',
  'JEE Advanced 2026'
);

// Then customize
await examConfigManager.updateConfig(newConfig.id, {
  difficultyDistribution: { easy: 20, medium: 50, hard: 30 },
});
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/exam-configs` | List all configs |
| GET | `/exam-configs/:code` | Get config by exam code |
| POST | `/exam-configs` | Create new config |
| PUT | `/exam-configs/:code` | Update config |
| POST | `/exam-configs/:code/validate` | Validate config |

## Best Practices

1. **Start with defaults** — Clone existing configs rather than creating from scratch
2. **Validate before deploying** — Always run validation
3. **Adjust cadence seasonally** — Increase near exam dates
4. **Test language coverage** — Ensure quality in all languages
5. **Review budget monthly** — Adjust based on ROI
6. **Document changes** — Track why configs were modified
