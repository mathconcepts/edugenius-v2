// @ts-nocheck
/**
 * Build Explainer Library
 *
 * For each of the 82 concepts, generates (via Gemini Flash-Lite) a canonical
 * explanation + 3 worked examples + 5 common misconceptions. Ships as static
 * JSON so students never hit the LLM for basic concept lookups.
 *
 * Cost: 82 concepts × ~$0.001 each = $0.08 once. Amortized over millions of
 * student requests.
 *
 * Usage:
 *   GEMINI_API_KEY=... npx tsx scripts/build-explainers.ts
 *   GEMINI_API_KEY=... npx tsx scripts/build-explainers.ts --concept eigenvalues
 *
 * Output: frontend/public/data/explainers.json
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ALL_CONCEPTS } from '../src/constants/concept-graph';

const OUT_PATH = path.resolve(process.cwd(), 'frontend/public/data/explainers.json');
const MODEL = 'gemini-2.5-flash-lite';
const BATCH_SIZE = 5;

async function buildExplainer(model: any, concept: any): Promise<any> {
  const prompt = `You are writing educational content for GATE Engineering Mathematics students.
Topic: ${concept.label}
Description: ${concept.description}

Generate a clean, focused concept explainer. Respond ONLY with JSON (no markdown):
{
  "canonical_definition": "A single-sentence precise definition (≤30 words).",
  "deep_explanation": "A 200-250 word explanation that builds intuition. Use LaTeX with $ delimiters for math. Assume engineering undergrad level.",
  "worked_examples": [
    { "difficulty": "easy", "problem": "...", "solution": "Step-by-step in LaTeX", "answer": "..." },
    { "difficulty": "medium", "problem": "...", "solution": "...", "answer": "..." },
    { "difficulty": "hard", "problem": "...", "solution": "...", "answer": "..." }
  ],
  "common_misconceptions": [
    { "id": "kebab-case-misconception-id", "description": "What students often confuse", "corrective": "The right mental model" }
  ],
  "prerequisite_reminders": ["One-line reminder about a key prerequisite", "Another"],
  "exam_tip": "One actionable GATE-specific tip."
}

Keep misconceptions array to 3-5 entries. Keep everything precise and exam-relevant.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json\s*|\s*```/g, '').trim();
    const parsed = JSON.parse(text);
    return {
      concept_id: concept.id,
      topic: concept.topic,
      label: concept.label,
      gate_frequency: concept.gate_frequency,
      ...parsed,
      generated_at: new Date().toISOString(),
      model: MODEL,
    };
  } catch (err) {
    console.warn(`  ✗ failed ${concept.id}: ${(err as Error).message}`);
    return null;
  }
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY required. Generating placeholder library from concept metadata only.');
    generatePlaceholderLibrary();
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL });

  // Load existing library if present (resume support)
  let existing: any = {};
  if (fs.existsSync(OUT_PATH)) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUT_PATH, 'utf-8'));
      existing = prev.by_concept || {};
      console.log(`Resuming — ${Object.keys(existing).length} concepts already done.`);
    } catch {}
  }

  const args = process.argv.slice(2);
  const conceptFilter = args.indexOf('--concept') >= 0 ? args[args.indexOf('--concept') + 1] : null;
  const limit = args.indexOf('--limit') >= 0 ? parseInt(args[args.indexOf('--limit') + 1]) : null;
  const force = args.includes('--force');

  let targets = conceptFilter
    ? ALL_CONCEPTS.filter(c => c.id === conceptFilter)
    : ALL_CONCEPTS;

  if (!force) targets = targets.filter(c => !existing[c.id]);
  if (limit) targets = targets.slice(0, limit);

  console.log(`Building explainers for ${targets.length} concepts (model: ${MODEL})`);
  console.log(`Estimated cost: ~$${(targets.length * 0.001).toFixed(3)}`);

  const byConcept: Record<string, any> = { ...existing };
  let succeeded = 0, failed = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(targets.length / BATCH_SIZE)}`);

    const results = await Promise.all(batch.map(async concept => {
      process.stdout.write(`  → ${concept.id} ... `);
      const explainer = await buildExplainer(model, concept);
      if (explainer) {
        console.log('✓');
        return { id: concept.id, explainer };
      }
      console.log('✗');
      return null;
    }));

    for (const r of results) {
      if (r) { byConcept[r.id] = r.explainer; succeeded++; }
      else failed++;
    }

    // Persist after every batch (crash-safe)
    const output = {
      version: 1,
      generated_at: new Date().toISOString(),
      total: Object.keys(byConcept).length,
      by_concept: byConcept,
    };
    fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  }

  console.log(`\nDone. Succeeded: ${succeeded}, Failed: ${failed}`);
  console.log(`Written: ${OUT_PATH}`);
  console.log(`Total in library: ${Object.keys(byConcept).length}`);
}

function generatePlaceholderLibrary() {
  const byConcept: Record<string, any> = {};
  for (const concept of ALL_CONCEPTS) {
    byConcept[concept.id] = {
      concept_id: concept.id,
      topic: concept.topic,
      label: concept.label,
      gate_frequency: concept.gate_frequency,
      canonical_definition: concept.description,
      deep_explanation: `${concept.label} is a foundational topic in ${concept.topic.replace(/-/g, ' ')}. ${concept.description}`,
      worked_examples: [],
      common_misconceptions: [],
      prerequisite_reminders: concept.prerequisites.map(p => `Review ${p.replace(/-/g, ' ')} first.`),
      exam_tip: `Practice ${concept.label} problems at ${concept.gate_frequency} frequency matching GATE exam distribution.`,
      generated_at: new Date().toISOString(),
      model: 'placeholder',
    };
  }
  const output = {
    version: 1,
    generated_at: new Date().toISOString(),
    total: ALL_CONCEPTS.length,
    by_concept: byConcept,
    note: 'Placeholder library — rebuild with GEMINI_API_KEY for full content.',
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Wrote placeholder library: ${OUT_PATH} (${ALL_CONCEPTS.length} concepts)`);
}

main().catch(err => { console.error(err); process.exit(1); });
