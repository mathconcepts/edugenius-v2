/**
 * Unit Tests for EduGenius Vector Store
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryVectorStore,
  SemanticSearchService,
  MockEmbeddingProvider,
  StudentKnowledgeGraph,
} from '../vector-store';
import { randomUUID } from 'crypto';

describe('InMemoryVectorStore', () => {
  let store: InMemoryVectorStore;

  beforeEach(() => {
    store = new InMemoryVectorStore();
  });

  describe('CRUD Operations', () => {
    it('should upsert documents', async () => {
      await store.upsert([
        {
          id: 'doc-1',
          embedding: [0.1, 0.2, 0.3],
          metadata: {
            type: 'content',
            entityId: 'content-1',
            createdAt: Date.now(),
          },
        },
      ]);

      const docs = await store.get(['doc-1']);
      expect(docs).toHaveLength(1);
      expect(docs[0].id).toBe('doc-1');
    });

    it('should update existing documents', async () => {
      await store.upsert([
        {
          id: 'doc-1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { type: 'content', entityId: 'c1', createdAt: Date.now() },
        },
      ]);

      await store.upsert([
        {
          id: 'doc-1',
          embedding: [0.4, 0.5, 0.6],
          metadata: { type: 'content', entityId: 'c1', createdAt: Date.now() },
        },
      ]);

      const docs = await store.get(['doc-1']);
      expect(docs[0].embedding).toEqual([0.4, 0.5, 0.6]);
    });

    it('should delete documents', async () => {
      await store.upsert([
        {
          id: 'doc-1',
          embedding: [0.1, 0.2, 0.3],
          metadata: { type: 'content', entityId: 'c1', createdAt: Date.now() },
        },
        {
          id: 'doc-2',
          embedding: [0.4, 0.5, 0.6],
          metadata: { type: 'content', entityId: 'c2', createdAt: Date.now() },
        },
      ]);

      await store.delete(['doc-1']);

      const docs = await store.get(['doc-1', 'doc-2']);
      expect(docs).toHaveLength(1);
      expect(docs[0].id).toBe('doc-2');
    });

    it('should count documents', async () => {
      await store.upsert([
        { id: 'd1', embedding: [0.1], metadata: { type: 'content', entityId: 'e1', createdAt: Date.now() } },
        { id: 'd2', embedding: [0.2], metadata: { type: 'question', entityId: 'e2', createdAt: Date.now() } },
        { id: 'd3', embedding: [0.3], metadata: { type: 'content', entityId: 'e3', createdAt: Date.now() } },
      ]);

      expect(await store.count()).toBe(3);
      expect(await store.count({ type: 'content' })).toBe(2);
    });

    it('should clear all documents', async () => {
      await store.upsert([
        { id: 'd1', embedding: [0.1], metadata: { type: 'content', entityId: 'e1', createdAt: Date.now() } },
        { id: 'd2', embedding: [0.2], metadata: { type: 'content', entityId: 'e2', createdAt: Date.now() } },
      ]);

      await store.clear();
      expect(await store.count()).toBe(0);
    });
  });

  describe('Similarity Search', () => {
    beforeEach(async () => {
      // Add normalized vectors for predictable similarity
      await store.upsert([
        {
          id: 'math-1',
          embedding: normalizeVector([1, 0, 0]),
          metadata: { type: 'content', entityId: 'm1', subject: 'math', createdAt: Date.now() },
          content: 'Algebra basics',
        },
        {
          id: 'math-2',
          embedding: normalizeVector([0.9, 0.1, 0]),
          metadata: { type: 'content', entityId: 'm2', subject: 'math', createdAt: Date.now() },
          content: 'Linear equations',
        },
        {
          id: 'physics-1',
          embedding: normalizeVector([0, 1, 0]),
          metadata: { type: 'content', entityId: 'p1', subject: 'physics', createdAt: Date.now() },
          content: 'Mechanics introduction',
        },
        {
          id: 'chemistry-1',
          embedding: normalizeVector([0, 0, 1]),
          metadata: { type: 'content', entityId: 'c1', subject: 'chemistry', createdAt: Date.now() },
          content: 'Periodic table',
        },
      ]);
    });

    it('should find similar vectors', async () => {
      const results = await store.search({
        vector: normalizeVector([1, 0, 0]),
        limit: 2,
      });

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('math-1');
      expect(results[0].score).toBeCloseTo(1, 1);
      expect(results[1].id).toBe('math-2');
    });

    it('should respect threshold', async () => {
      const results = await store.search({
        vector: normalizeVector([1, 0, 0]),
        threshold: 0.95,
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('math-1');
    });

    it('should respect limit', async () => {
      const results = await store.search({
        vector: normalizeVector([0.5, 0.5, 0.5]),
        limit: 2,
      });

      expect(results).toHaveLength(2);
    });

    it('should filter by metadata', async () => {
      const results = await store.search({
        vector: normalizeVector([0.5, 0.5, 0]),
        filter: { subject: 'math' },
      });

      expect(results.every((r) => r.metadata.subject === 'math')).toBe(true);
    });

    it('should filter by type', async () => {
      await store.upsert([
        {
          id: 'q1',
          embedding: normalizeVector([1, 0, 0]),
          metadata: { type: 'question', entityId: 'q1', subject: 'math', createdAt: Date.now() },
        },
      ]);

      const results = await store.search({
        vector: normalizeVector([1, 0, 0]),
        filter: { type: 'question' },
      });

      expect(results).toHaveLength(1);
      expect(results[0].metadata.type).toBe('question');
    });
  });
});

describe('SemanticSearchService', () => {
  let vectorStore: InMemoryVectorStore;
  let embeddingProvider: MockEmbeddingProvider;
  let searchService: SemanticSearchService;

  beforeEach(() => {
    vectorStore = new InMemoryVectorStore();
    embeddingProvider = new MockEmbeddingProvider(128);
    searchService = new SemanticSearchService(vectorStore, embeddingProvider);
  });

  it('should index content', async () => {
    await searchService.indexContent([
      {
        id: 'content-1',
        content: 'Introduction to algebra',
        metadata: { type: 'content', entityId: 'content-1', subject: 'math' },
      },
      {
        id: 'content-2',
        content: 'Quadratic equations',
        metadata: { type: 'content', entityId: 'content-2', subject: 'math' },
      },
    ]);

    const count = await vectorStore.count();
    expect(count).toBe(2);
  });

  it('should search for content', async () => {
    await searchService.indexContent([
      {
        id: 'c1',
        content: 'Introduction to algebra and linear equations',
        metadata: { type: 'content', entityId: 'c1', subject: 'math' },
      },
      {
        id: 'c2',
        content: 'Newton laws of motion and physics',
        metadata: { type: 'content', entityId: 'c2', subject: 'physics' },
      },
    ]);

    const results = await searchService.search('algebra equations', {
      limit: 5,
      threshold: 0,
    });

    expect(results.length).toBeGreaterThan(0);
  });

  it('should find related content', async () => {
    await searchService.indexContent([
      {
        id: 'c1',
        content: 'Algebra basics',
        metadata: { type: 'content', entityId: 'c1', subject: 'math' },
      },
      {
        id: 'c2',
        content: 'Advanced algebra',
        metadata: { type: 'content', entityId: 'c2', subject: 'math' },
      },
      {
        id: 'c3',
        content: 'Physics fundamentals',
        metadata: { type: 'content', entityId: 'c3', subject: 'physics' },
      },
    ]);

    const related = await searchService.findRelated('c1', { limit: 5 });
    
    // Should not include the original document
    expect(related.find((r) => r.id === 'c1')).toBeUndefined();
  });

  it('should remove from index', async () => {
    await searchService.indexContent([
      {
        id: 'c1',
        content: 'Test content',
        metadata: { type: 'content', entityId: 'c1' },
      },
    ]);

    await searchService.removeFromIndex(['c1']);
    expect(await vectorStore.count()).toBe(0);
  });
});

describe('MockEmbeddingProvider', () => {
  it('should generate embeddings of correct dimension', async () => {
    const provider = new MockEmbeddingProvider(256);
    const embedding = await provider.embedSingle('test text');
    expect(embedding.length).toBe(256);
  });

  it('should generate normalized embeddings', async () => {
    const provider = new MockEmbeddingProvider(128);
    const embedding = await provider.embedSingle('test text');
    
    const norm = Math.sqrt(embedding.reduce((sum, x) => sum + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it('should generate consistent embeddings for same text', async () => {
    const provider = new MockEmbeddingProvider(64);
    const e1 = await provider.embedSingle('hello world');
    const e2 = await provider.embedSingle('hello world');
    expect(e1).toEqual(e2);
  });

  it('should batch embed', async () => {
    const provider = new MockEmbeddingProvider(64);
    const embeddings = await provider.embed(['text 1', 'text 2', 'text 3']);
    expect(embeddings).toHaveLength(3);
    expect(embeddings[0].length).toBe(64);
  });
});

describe('StudentKnowledgeGraph', () => {
  let graph: StudentKnowledgeGraph;
  const studentId = randomUUID();

  beforeEach(() => {
    graph = new StudentKnowledgeGraph(studentId);

    // Setup test graph
    graph.addConcept({
      id: 'algebra',
      concept: 'Algebra',
      subject: 'math',
      mastery: 0.8,
      prerequisites: [],
      relatedConcepts: ['equations'],
    });

    graph.addConcept({
      id: 'equations',
      concept: 'Linear Equations',
      subject: 'math',
      mastery: 0.6,
      prerequisites: ['algebra'],
      relatedConcepts: [],
    });

    graph.addConcept({
      id: 'quadratic',
      concept: 'Quadratic Equations',
      subject: 'math',
      mastery: 0.3,
      prerequisites: ['equations'],
      relatedConcepts: [],
    });

    graph.addConcept({
      id: 'calculus',
      concept: 'Calculus',
      subject: 'math',
      mastery: 0.1,
      prerequisites: ['quadratic'],
      relatedConcepts: [],
    });
  });

  it('should get mastery level', () => {
    expect(graph.getMastery('algebra')).toBe(0.8);
    expect(graph.getMastery('non-existent')).toBe(0);
  });

  it('should update mastery', () => {
    graph.updateMastery('equations', 0.9);
    expect(graph.getMastery('equations')).toBe(0.9);
  });

  it('should clamp mastery between 0 and 1', () => {
    graph.updateMastery('equations', 1.5);
    expect(graph.getMastery('equations')).toBe(1);

    graph.updateMastery('equations', -0.5);
    expect(graph.getMastery('equations')).toBe(0);
  });

  it('should get weak concepts', () => {
    const weak = graph.getWeakConcepts(0.5);
    expect(weak).toHaveLength(2);
    expect(weak[0].id).toBe('calculus'); // Lowest mastery first
    expect(weak[1].id).toBe('quadratic');
  });

  it('should get strong concepts', () => {
    const strong = graph.getStrongConcepts(0.7);
    expect(strong).toHaveLength(1);
    expect(strong[0].id).toBe('algebra');
  });

  it('should get ready concepts', () => {
    // Concepts where prerequisites are mastered but concept is not
    const ready = graph.getReadyConcepts();
    
    // equations has algebra (mastered) as prereq, but equations is not mastered
    expect(ready.some((c) => c.id === 'equations')).toBe(true);
  });

  it('should get recommended learning path', () => {
    const path = graph.getRecommendedPath('calculus');
    
    // Should include all prerequisites that aren't mastered
    expect(path).toContain('equations');
    expect(path).toContain('quadratic');
    expect(path).toContain('calculus');
    
    // Should be in dependency order
    const equationsIdx = path.indexOf('equations');
    const quadraticIdx = path.indexOf('quadratic');
    const calculusIdx = path.indexOf('calculus');
    
    expect(equationsIdx).toBeLessThan(quadraticIdx);
    expect(quadraticIdx).toBeLessThan(calculusIdx);
  });

  it('should serialize to JSON', () => {
    graph.addRelation({
      from: 'algebra',
      to: 'equations',
      type: 'prerequisite',
      weight: 1,
    });

    const json = graph.toJSON();
    expect(json.nodes).toHaveLength(4);
    expect(json.edges).toHaveLength(1);
  });

  it('should deserialize from JSON', () => {
    const json = graph.toJSON();
    const restored = StudentKnowledgeGraph.fromJSON(studentId, json);
    
    expect(restored.getMastery('algebra')).toBe(0.8);
    expect(restored.getWeakConcepts(0.5)).toHaveLength(2);
  });
});

// Helper function
function normalizeVector(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
  return v.map((x) => x / norm);
}
