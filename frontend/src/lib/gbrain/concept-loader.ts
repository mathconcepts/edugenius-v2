/**
 * Client-side concept graph loader + pure GBrain functions.
 *
 * Loads concept-graph.json at runtime (from public/data/) so the client has
 * full knowledge of the 82 concepts without server round-trips.
 */

export interface ConceptNode {
  id: string;
  topic: string;
  label: string;
  description: string;
  difficulty_base: number;
  gate_frequency: 'high' | 'medium' | 'low' | 'rare';
  prerequisites: string[];
}

let _concepts: ConceptNode[] | null = null;
let _conceptMap: Map<string, ConceptNode> | null = null;
let _loadPromise: Promise<void> | null = null;

async function ensureLoaded(): Promise<void> {
  if (_concepts) return;
  if (_loadPromise) return _loadPromise;
  _loadPromise = (async () => {
    const res = await fetch('/data/concept-graph.json');
    if (!res.ok) throw new Error('Failed to load concept graph');
    const data = await res.json();
    _concepts = data.concepts;
    _conceptMap = new Map(_concepts!.map(c => [c.id, c]));
  })();
  return _loadPromise;
}

export async function getAllConcepts(): Promise<ConceptNode[]> {
  await ensureLoaded();
  return _concepts!;
}

export async function getConcept(id: string): Promise<ConceptNode | undefined> {
  await ensureLoaded();
  return _conceptMap!.get(id);
}

export async function getConceptsForTopicClient(topic: string): Promise<ConceptNode[]> {
  await ensureLoaded();
  return _concepts!.filter(c => c.topic === topic);
}

export async function traceWeakestPrerequisiteClient(
  conceptId: string,
  masteryVector: Record<string, { score: number }>,
  threshold = 0.3,
): Promise<ConceptNode[]> {
  await ensureLoaded();
  const weak: ConceptNode[] = [];
  const visited = new Set<string>();
  const queue = [conceptId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    const node = _conceptMap!.get(current);
    if (!node) continue;
    for (const prereqId of node.prerequisites) {
      const mastery = masteryVector[prereqId]?.score ?? 0;
      if (mastery < threshold) {
        const prereqNode = _conceptMap!.get(prereqId);
        if (prereqNode) weak.push(prereqNode);
      }
      queue.push(prereqId);
    }
  }
  return weak.sort((a, b) => (masteryVector[a.id]?.score ?? 0) - (masteryVector[b.id]?.score ?? 0));
}
