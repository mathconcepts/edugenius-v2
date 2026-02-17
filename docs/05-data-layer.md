# Data Layer

The data layer provides repositories, caching, and vector storage for the platform.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                        │
│                  (Agents, Orchestrator, API)                  │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │   Repository   │  │     Cache      │  │  Vector Store  │  │
│  │    Pattern     │  │  (In-Memory)   │  │  (Embeddings)  │  │
│  └────────────────┘  └────────────────┘  └────────────────┘  │
│                                                               │
├──────────────────────────────────────────────────────────────┤
│                      STORAGE ADAPTERS                         │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ In-Memory│  │  Redis   │  │ Database │  │  Pinecone│     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
└──────────────────────────────────────────────────────────────┘
```

---

## Entity Types

### Student

```typescript
interface Student {
  id: string;
  email?: string;
  phone?: string;
  name?: string;
  grade?: number;
  board?: string;
  subjects: string[];
  preferences: StudentPreferences;
  createdAt: number;
  updatedAt: number;
}

interface StudentPreferences {
  language: string;
  difficulty: 'easy' | 'medium' | 'hard';
  notificationChannels: string[];
  studyReminders: boolean;
}
```

### Content

```typescript
interface Content {
  id: string;
  title: string;
  contentType: ContentType;
  subject: string;
  topic: string;
  grade?: number;
  board?: string;
  body: string;
  metadata: ContentMetadata;
  status: ContentStatus;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
}

type ContentType = 'lesson' | 'quiz' | 'summary' | 'practice' | 'video' | 'infographic';
type ContentStatus = 'draft' | 'review' | 'published' | 'archived';

interface ContentMetadata {
  wordCount: number;
  readingTime: number;
  difficulty: number;
  prerequisites: string[];
  relatedTopics: string[];
  seoKeywords: string[];
}
```

### Session

```typescript
interface Session {
  id: string;
  studentId: string;
  topic?: string;
  subject?: string;
  startedAt: number;
  endedAt?: number;
  duration?: number;
  messages: SessionMessage[];
  context: SessionContext;
  metrics: SessionMetrics;
}

interface SessionMessage {
  role: 'student' | 'tutor' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface SessionMetrics {
  questionsAsked: number;
  questionsCorrect: number;
  hintsUsed: number;
  masteryChange: number;
}
```

### Student Engagement

```typescript
interface StudentEngagement {
  studentId: string;
  lastActiveAt: number;
  totalSessions: number;
  totalMinutes: number;
  currentStreak: number;
  longestStreak: number;
  badges: Badge[];
  achievements: Achievement[];
  engagementScore: number;
  churnRisk: number;
}
```

---

## Repository Pattern

### Base Repository

```typescript
interface Repository<T, ID = string> {
  findById(id: ID): Promise<T | undefined>;
  findAll(options?: FindOptions): Promise<T[]>;
  create(entity: Omit<T, 'id'>): Promise<T>;
  update(id: ID, updates: Partial<T>): Promise<T>;
  delete(id: ID): Promise<boolean>;
  count(filter?: Filter<T>): Promise<number>;
}

interface FindOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
  filter?: Record<string, unknown>;
}
```

### Student Repository

```typescript
class StudentRepository implements Repository<Student> {
  async findById(id: string): Promise<Student | undefined>;
  async findByEmail(email: string): Promise<Student | undefined>;
  async findByPhone(phone: string): Promise<Student | undefined>;
  async findActive(days: number): Promise<Student[]>;
  async findInactive(days: number): Promise<Student[]>;
  async findBySubject(subject: string): Promise<Student[]>;
}
```

### Content Repository

```typescript
class ContentRepository implements Repository<Content> {
  async findById(id: string): Promise<Content | undefined>;
  async findByTopic(topic: string): Promise<Content[]>;
  async findBySubject(subject: string): Promise<Content[]>;
  async findPublished(options?: FindOptions): Promise<Content[]>;
  async search(query: string): Promise<Content[]>;
}
```

### Session Repository

```typescript
class SessionRepository implements Repository<Session> {
  async findById(id: string): Promise<Session | undefined>;
  async findByStudent(studentId: string): Promise<Session[]>;
  async findActive(): Promise<Session[]>;
  async findRecent(limit: number): Promise<Session[]>;
}
```

---

## Cache Layer

### Cache Interface

```typescript
interface Cache {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  
  increment(key: string, by?: number): Promise<number>;
  decrement(key: string, by?: number): Promise<number>;
  
  mget<T>(keys: string[]): Promise<(T | undefined)[]>;
  mset(items: Array<{ key: string; value: unknown; ttlMs?: number }>): Promise<void>;
  
  clear(): Promise<void>;
}
```

### Usage Examples

```typescript
const cache = new Cache();
await cache.connect();

// Simple get/set
await cache.set('user:123', { name: 'Alice' });
const user = await cache.get<User>('user:123');

// With TTL (5 minutes)
await cache.set('session:abc', sessionData, 300000);

// Counters
await cache.increment('views:post:123');
const views = await cache.get<number>('views:post:123');

// Bulk operations
await cache.mset([
  { key: 'a', value: 1 },
  { key: 'b', value: 2 },
  { key: 'c', value: 3 },
]);
const values = await cache.mget(['a', 'b', 'c']);
```

### Cache Patterns

#### Cache-Aside

```typescript
async function getStudent(id: string): Promise<Student | undefined> {
  // Check cache first
  const cached = await cache.get<Student>(`student:${id}`);
  if (cached) return cached;
  
  // Cache miss: fetch from DB
  const student = await studentRepo.findById(id);
  
  // Store in cache
  if (student) {
    await cache.set(`student:${id}`, student, 3600000); // 1 hour
  }
  
  return student;
}
```

#### Write-Through

```typescript
async function updateStudent(id: string, updates: Partial<Student>): Promise<Student> {
  // Update DB
  const student = await studentRepo.update(id, updates);
  
  // Update cache
  await cache.set(`student:${id}`, student, 3600000);
  
  return student;
}
```

### TTL Guidelines

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Session data | 30 min | Active sessions |
| Student profile | 1 hour | Moderate change rate |
| Content | 24 hours | Rarely changes |
| Metrics | 5 min | Needs freshness |
| Embeddings | 24 hours | Computationally expensive |

---

## Vector Store

For semantic search and knowledge graphs:

### Student Knowledge Graph

```typescript
class StudentKnowledgeGraph {
  constructor(studentId: string);
  
  // Node operations
  addNode(node: KnowledgeNode): void;
  getNode(nodeId: string): KnowledgeNode | undefined;
  updateMastery(topic: string, mastery: number): void;
  getMastery(topic: string): number;
  
  // Traversal
  getPrerequisites(topic: string): string[];
  getConnections(topic: string): string[];
  getRecommendedPath(targetTopic: string): string[];
  
  // Queries
  getWeakTopics(threshold: number): string[];
  getStrongTopics(threshold: number): string[];
}

interface KnowledgeNode {
  id: string;
  topic: string;
  mastery: number;
  lastPracticed: number;
  prerequisites: string[];
  connections: string[];
}
```

### Semantic Search

```typescript
class VectorStore {
  // Index management
  async createIndex(name: string, dimensions: number): Promise<void>;
  async deleteIndex(name: string): Promise<void>;
  
  // Vector operations
  async upsert(index: string, vectors: VectorEntry[]): Promise<void>;
  async query(index: string, vector: number[], topK: number): Promise<SearchResult[]>;
  async delete(index: string, ids: string[]): Promise<void>;
}

interface VectorEntry {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
}

interface SearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}
```

### Content Embeddings

```typescript
// Index content for semantic search
const embedding = await llmClient.embed(content.body);

await vectorStore.upsert('content', [{
  id: content.id,
  vector: embedding,
  metadata: {
    title: content.title,
    subject: content.subject,
    topic: content.topic,
  },
}]);

// Search similar content
const queryEmbedding = await llmClient.embed(searchQuery);
const results = await vectorStore.query('content', queryEmbedding, 10);
```

---

## Data Validation

Using the validation utilities:

```typescript
import { 
  validateString, 
  validateEmail, 
  validateId,
  ValidationError 
} from 'edugenius/utils';

// Validate student creation
function validateStudent(input: unknown): Student {
  const data = validateObject(input, { required: true });
  
  return {
    id: validateId(data.id) || generateId(),
    email: validateEmail(data.email),
    phone: validateString(data.phone, { pattern: /^\+?[0-9]{10,15}$/ }),
    name: validateString(data.name, { maxLength: 100 }),
    grade: validateNumber(data.grade, { min: 1, max: 12, integer: true }),
    subjects: validateArray(data.subjects, {
      itemValidator: (s) => validateString(s, { required: true }),
    }) || [],
    // ...
  };
}
```

---

## Migrations

### Schema Version Tracking

```typescript
interface Migration {
  version: string;
  name: string;
  up: () => Promise<void>;
  down: () => Promise<void>;
}

const migrations: Migration[] = [
  {
    version: '001',
    name: 'create_students',
    up: async () => { /* create table */ },
    down: async () => { /* drop table */ },
  },
  {
    version: '002',
    name: 'add_student_preferences',
    up: async () => { /* add column */ },
    down: async () => { /* remove column */ },
  },
];
```

### Running Migrations

```typescript
// Via Forge agent
await forge.migrateDB({ action: 'up' });

// Dry run
const pending = await forge.migrateDB({ action: 'status' });
```

---

## Performance Optimization

### Indexing Strategy

| Entity | Index Fields |
|--------|--------------|
| Student | email, phone, grade, subjects |
| Content | subject, topic, status, publishedAt |
| Session | studentId, startedAt, status |
| Engagement | studentId, churnRisk |

### Query Optimization

```typescript
// Bad: Fetch all then filter
const allStudents = await studentRepo.findAll();
const inactive = allStudents.filter(s => s.lastActiveAt < cutoff);

// Good: Filter at query level
const inactive = await studentRepo.findInactive(30);
```

### Batch Operations

```typescript
// Process in batches
const BATCH_SIZE = 100;

for (let offset = 0; ; offset += BATCH_SIZE) {
  const batch = await studentRepo.findAll({ limit: BATCH_SIZE, offset });
  if (batch.length === 0) break;
  
  await processBatch(batch);
}
```
