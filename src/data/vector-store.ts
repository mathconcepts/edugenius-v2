// @ts-nocheck
/**
 * EduGenius Data Layer - Vector Store
 * For semantic search and embeddings storage
 */

import { UUID } from './types';

// ============================================================================
// Vector Store Types
// ============================================================================

export interface VectorDocument {
  id: UUID;
  embedding: number[];
  metadata: VectorMetadata;
  content?: string;
}

export interface VectorMetadata {
  type: 'content' | 'question' | 'concept' | 'student_knowledge';
  entityId: UUID;
  subject?: string;
  topic?: string;
  exam?: string;
  language?: string;
  createdAt: number;
  [key: string]: unknown;
}

export interface VectorSearchParams {
  vector: number[];
  limit?: number;
  threshold?: number;  // Minimum similarity score (0-1)
  filter?: VectorFilter;
}

export interface VectorFilter {
  type?: string | string[];
  subject?: string | string[];
  topic?: string | string[];
  exam?: string | string[];
  metadata?: Record<string, unknown>;
}

export interface VectorSearchResult {
  id: UUID;
  score: number;
  metadata: VectorMetadata;
  content?: string;
}

// ============================================================================
// Vector Store Interface
// ============================================================================

export interface VectorStore {
  // CRUD
  upsert(docs: VectorDocument[]): Promise<void>;
  delete(ids: UUID[]): Promise<void>;
  get(ids: UUID[]): Promise<VectorDocument[]>;
  
  // Search
  search(params: VectorSearchParams): Promise<VectorSearchResult[]>;
  
  // Management
  count(filter?: VectorFilter): Promise<number>;
  clear(): Promise<void>;
}

// ============================================================================
// In-Memory Vector Store (for development/testing)
// ============================================================================

export class InMemoryVectorStore implements VectorStore {
  private documents: Map<UUID, VectorDocument> = new Map();

  async upsert(docs: VectorDocument[]): Promise<void> {
    for (const doc of docs) {
      this.documents.set(doc.id, doc);
    }
  }

  async delete(ids: UUID[]): Promise<void> {
    for (const id of ids) {
      this.documents.delete(id);
    }
  }

  async get(ids: UUID[]): Promise<VectorDocument[]> {
    const results: VectorDocument[] = [];
    for (const id of ids) {
      const doc = this.documents.get(id);
      if (doc) results.push(doc);
    }
    return results;
  }

  async search(params: VectorSearchParams): Promise<VectorSearchResult[]> {
    const { vector, limit = 10, threshold = 0, filter } = params;
    const results: VectorSearchResult[] = [];

    for (const doc of this.documents.values()) {
      // Apply filters
      if (filter && !this.matchesFilter(doc, filter)) {
        continue;
      }

      // Calculate cosine similarity
      const score = this.cosineSimilarity(vector, doc.embedding);

      if (score >= threshold) {
        results.push({
          id: doc.id,
          score,
          metadata: doc.metadata,
          content: doc.content,
        });
      }
    }

    // Sort by score descending and limit
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  async count(filter?: VectorFilter): Promise<number> {
    if (!filter) return this.documents.size;

    let count = 0;
    for (const doc of this.documents.values()) {
      if (this.matchesFilter(doc, filter)) count++;
    }
    return count;
  }

  async clear(): Promise<void> {
    this.documents.clear();
  }

  // -------------------------------------------------------------------------
  // Private Methods
  // -------------------------------------------------------------------------

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }

  private matchesFilter(doc: VectorDocument, filter: VectorFilter): boolean {
    const { type, subject, topic, exam, metadata } = filter;

    if (type) {
      const types = Array.isArray(type) ? type : [type];
      if (!types.includes(doc.metadata.type)) return false;
    }

    if (subject) {
      const subjects = Array.isArray(subject) ? subject : [subject];
      if (!doc.metadata.subject || !subjects.includes(doc.metadata.subject)) return false;
    }

    if (topic) {
      const topics = Array.isArray(topic) ? topic : [topic];
      if (!doc.metadata.topic || !topics.includes(doc.metadata.topic)) return false;
    }

    if (exam) {
      const exams = Array.isArray(exam) ? exam : [exam];
      if (!doc.metadata.exam || !exams.includes(doc.metadata.exam)) return false;
    }

    if (metadata) {
      for (const [key, value] of Object.entries(metadata)) {
        if (doc.metadata[key] !== value) return false;
      }
    }

    return true;
  }
}

// ============================================================================
// Semantic Search Service
// ============================================================================

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  embedSingle(text: string): Promise<number[]>;
  getDimension(): number;
}

export class SemanticSearchService {
  constructor(
    private vectorStore: VectorStore,
    private embeddingProvider: EmbeddingProvider
  ) {}

  /**
   * Index content for semantic search
   */
  async indexContent(
    items: Array<{
      id: UUID;
      content: string;
      metadata: Omit<VectorMetadata, 'createdAt'>;
    }>
  ): Promise<void> {
    const texts = items.map((item) => item.content);
    const embeddings = await this.embeddingProvider.embed(texts);

    const documents: VectorDocument[] = items.map((item, i) => ({
      id: item.id,
      embedding: embeddings[i],
      metadata: {
        ...item.metadata,
        createdAt: Date.now(),
      },
      content: item.content,
    }));

    await this.vectorStore.upsert(documents);
  }

  /**
   * Search for similar content
   */
  async search(
    query: string,
    options: {
      limit?: number;
      threshold?: number;
      filter?: VectorFilter;
    } = {}
  ): Promise<VectorSearchResult[]> {
    const queryVector = await this.embeddingProvider.embedSingle(query);

    return this.vectorStore.search({
      vector: queryVector,
      limit: options.limit || 10,
      threshold: options.threshold || 0.5,
      filter: options.filter,
    });
  }

  /**
   * Find related content by ID
   */
  async findRelated(
    id: UUID,
    options: {
      limit?: number;
      threshold?: number;
      filter?: VectorFilter;
    } = {}
  ): Promise<VectorSearchResult[]> {
    const [doc] = await this.vectorStore.get([id]);
    if (!doc) return [];

    const results = await this.vectorStore.search({
      vector: doc.embedding,
      limit: (options.limit || 10) + 1, // +1 because it will include itself
      threshold: options.threshold || 0.5,
      filter: options.filter,
    });

    // Remove the original document from results
    return results.filter((r) => r.id !== id);
  }

  /**
   * Remove content from index
   */
  async removeFromIndex(ids: UUID[]): Promise<void> {
    await this.vectorStore.delete(ids);
  }

  /**
   * Batch similarity comparison
   */
  async batchSimilarity(
    sourceId: UUID,
    targetIds: UUID[]
  ): Promise<Array<{ id: UUID; score: number }>> {
    const docs = await this.vectorStore.get([sourceId, ...targetIds]);
    const source = docs.find((d) => d.id === sourceId);
    if (!source) return [];

    const results: Array<{ id: UUID; score: number }> = [];
    for (const doc of docs) {
      if (doc.id === sourceId) continue;
      const score = this.cosineSimilarity(source.embedding, doc.embedding);
      results.push({ id: doc.id, score });
    }

    return results.sort((a, b) => b.score - a.score);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) return 0;

    return dotProduct / denominator;
  }
}

// ============================================================================
// Mock Embedding Provider (for testing)
// ============================================================================

export class MockEmbeddingProvider implements EmbeddingProvider {
  private dimension: number;

  constructor(dimension: number = 384) {
    this.dimension = dimension;
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((text) => this.generateEmbedding(text));
  }

  async embedSingle(text: string): Promise<number[]> {
    return this.generateEmbedding(text);
  }

  getDimension(): number {
    return this.dimension;
  }

  private generateEmbedding(text: string): number[] {
    // Generate a deterministic embedding based on text content
    // This is NOT a real embedding - just for testing
    const hash = this.hashString(text);
    const embedding: number[] = [];

    for (let i = 0; i < this.dimension; i++) {
      // Use hash and index to generate pseudo-random numbers
      const seed = (hash + i * 12345) % 2147483647;
      embedding.push(Math.sin(seed) * 0.5 + 0.5);
    }

    // Normalize
    const norm = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0));
    return embedding.map((x) => x / norm);
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// ============================================================================
// Knowledge Graph (Student Knowledge Representation)
// ============================================================================

export interface KnowledgeNode {
  id: UUID;
  concept: string;
  subject: string;
  mastery: number;  // 0-1
  lastPracticed?: number;
  prerequisites: UUID[];
  relatedConcepts: UUID[];
}

export interface KnowledgeEdge {
  from: UUID;
  to: UUID;
  type: 'prerequisite' | 'related' | 'includes';
  weight: number;
}

export class StudentKnowledgeGraph {
  private nodes: Map<UUID, KnowledgeNode> = new Map();
  private edges: Map<string, KnowledgeEdge> = new Map();
  private studentId: UUID;

  constructor(studentId: UUID) {
    this.studentId = studentId;
  }

  addConcept(node: KnowledgeNode): void {
    this.nodes.set(node.id, node);
  }

  addRelation(edge: KnowledgeEdge): void {
    const key = `${edge.from}:${edge.to}:${edge.type}`;
    this.edges.set(key, edge);
  }

  updateMastery(conceptId: UUID, mastery: number): void {
    const node = this.nodes.get(conceptId);
    if (node) {
      node.mastery = Math.max(0, Math.min(1, mastery));
      node.lastPracticed = Date.now();
    }
  }

  getMastery(conceptId: UUID): number {
    return this.nodes.get(conceptId)?.mastery ?? 0;
  }

  getWeakConcepts(threshold: number = 0.5): KnowledgeNode[] {
    return Array.from(this.nodes.values())
      .filter((n) => n.mastery < threshold)
      .sort((a, b) => a.mastery - b.mastery);
  }

  getStrongConcepts(threshold: number = 0.7): KnowledgeNode[] {
    return Array.from(this.nodes.values())
      .filter((n) => n.mastery >= threshold)
      .sort((a, b) => b.mastery - a.mastery);
  }

  getReadyConcepts(): KnowledgeNode[] {
    // Concepts where all prerequisites are mastered
    return Array.from(this.nodes.values()).filter((node) => {
      if (node.mastery >= 0.7) return false; // Already mastered
      
      for (const prereqId of node.prerequisites) {
        const prereq = this.nodes.get(prereqId);
        if (!prereq || prereq.mastery < 0.7) return false;
      }
      return true;
    });
  }

  getRecommendedPath(targetConcept: UUID): UUID[] {
    // BFS to find learning path
    const target = this.nodes.get(targetConcept);
    if (!target) return [];

    const path: UUID[] = [];
    const visited = new Set<UUID>();
    const queue: UUID[] = [targetConcept];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const node = this.nodes.get(current);
      if (!node) continue;

      // Add unmastered prerequisites first
      for (const prereqId of node.prerequisites) {
        const prereq = this.nodes.get(prereqId);
        if (prereq && prereq.mastery < 0.7 && !visited.has(prereqId)) {
          queue.push(prereqId);
        }
      }

      if (node.mastery < 0.7) {
        path.unshift(current);
      }
    }

    return path;
  }

  toJSON(): { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] } {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edges.values()),
    };
  }

  static fromJSON(
    studentId: UUID,
    data: { nodes: KnowledgeNode[]; edges: KnowledgeEdge[] }
  ): StudentKnowledgeGraph {
    const graph = new StudentKnowledgeGraph(studentId);
    for (const node of data.nodes) {
      graph.addConcept(node);
    }
    for (const edge of data.edges) {
      graph.addRelation(edge);
    }
    return graph;
  }
}

// ============================================================================
// PgVector Store (persists to Supabase rag_cache table, in-memory read cache)
// ============================================================================

export class PgVectorStore implements VectorStore {
  private memoryCache: InMemoryVectorStore = new InMemoryVectorStore();
  private pool: any;
  private initialized = false;

  constructor(pool: any) {
    this.pool = pool;
  }

  /** Load existing vectors from DB into memory cache on boot */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const result = await this.pool.query(
        `SELECT id, embedding::text, content, verification_status, verification_confidence,
                verifier, answer, topic, metadata
         FROM rag_cache
         WHERE embedding IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 10000`,
      );

      const docs: VectorDocument[] = result.rows.map((row: any) => ({
        id: row.id,
        embedding: this.parseEmbedding(row.embedding),
        metadata: {
          type: 'question' as const,
          entityId: row.id,
          subject: 'mathematics',
          topic: row.topic || undefined,
          exam: 'GATE',
          createdAt: Date.now(),
          verificationStatus: row.verification_status,
          verificationConfidence: row.verification_confidence,
          verifier: row.verifier,
          answer: row.answer,
          ...(row.metadata || {}),
        },
        content: row.content,
      }));

      if (docs.length > 0) {
        await this.memoryCache.upsert(docs);
      }
      this.initialized = true;
      console.log(`[PgVectorStore] Loaded ${docs.length} vectors from DB into memory cache`);
    } catch (err) {
      console.error('[PgVectorStore] Failed to load from DB, starting empty:', (err as Error).message);
      this.initialized = true;
    }
  }

  async upsert(docs: VectorDocument[]): Promise<void> {
    // Write to memory cache for fast reads
    await this.memoryCache.upsert(docs);

    // Persist to Postgres in parallel
    for (const doc of docs) {
      try {
        const meta = doc.metadata || {};
        await this.pool.query(
          `INSERT INTO rag_cache (id, embedding, content, verification_status, verification_confidence, verifier, answer, topic, metadata)
           VALUES ($1, $2::vector, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET
             embedding = EXCLUDED.embedding,
             content = EXCLUDED.content,
             verification_status = EXCLUDED.verification_status,
             verification_confidence = EXCLUDED.verification_confidence`,
          [
            doc.id,
            `[${doc.embedding.join(',')}]`,
            doc.content || '',
            meta['verificationStatus'] || 'unknown',
            meta['verificationConfidence'] || 0,
            meta['verifier'] || 'unknown',
            meta['answer'] || null,
            meta['topic'] || null,
            JSON.stringify(meta),
          ],
        );
      } catch (err) {
        console.error(`[PgVectorStore] Failed to persist doc ${doc.id}:`, (err as Error).message);
        // Non-fatal — memory cache still has it
      }
    }
  }

  async delete(ids: UUID[]): Promise<void> {
    await this.memoryCache.delete(ids);
    try {
      await this.pool.query('DELETE FROM rag_cache WHERE id = ANY($1)', [ids]);
    } catch (err) {
      console.error('[PgVectorStore] Failed to delete from DB:', (err as Error).message);
    }
  }

  async get(ids: UUID[]): Promise<VectorDocument[]> {
    return this.memoryCache.get(ids);
  }

  async search(params: VectorSearchParams): Promise<VectorSearchResult[]> {
    // Use in-memory search for speed (all data loaded on boot)
    return this.memoryCache.search(params);
  }

  async count(filter?: VectorFilter): Promise<number> {
    return this.memoryCache.count(filter);
  }

  async clear(): Promise<void> {
    await this.memoryCache.clear();
    try {
      await this.pool.query('DELETE FROM rag_cache');
    } catch (err) {
      console.error('[PgVectorStore] Failed to clear DB:', (err as Error).message);
    }
  }

  private parseEmbedding(embeddingStr: string): number[] {
    // pgvector returns "[0.1,0.2,...]" format
    try {
      return JSON.parse(embeddingStr);
    } catch {
      // Try stripping brackets
      return embeddingStr
        .replace(/[\[\]]/g, '')
        .split(',')
        .map(Number);
    }
  }
}

// ============================================================================
// Singleton
// ============================================================================

let vectorStoreInstance: VectorStore | null = null;

export function getVectorStore(): VectorStore {
  if (!vectorStoreInstance) {
    vectorStoreInstance = new InMemoryVectorStore();
  }
  return vectorStoreInstance;
}

export function resetVectorStore(): void {
  vectorStoreInstance = null;
}
