// @ts-nocheck
/**
 * Build Content Bundle
 *
 * Merges every content source into frontend/public/data/content-bundle.json.
 * This is what the Tier-0 resolver reads. Run after scrape + generate + explainers.
 *
 * Inputs (any/all):
 *   data/raw/corpus-*.jsonl              — scraped records
 *   frontend/public/data/pyq-bank.json    — legacy PYQ bundle
 *   frontend/public/data/explainers.json  — concept explainer library
 *   data/generated/problems-*.json        — CI-generated verified problems
 *
 * Output:
 *   frontend/public/data/content-bundle.json
 *     { version, problems: [...], explainers: {...}, stats }
 *
 * Dedup: problems hashed by normalized(question_text + answer). First wins.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const FE_DATA = path.resolve(process.cwd(), 'frontend/public/data');
const RAW_DIR = path.resolve(process.cwd(), 'data/raw');
const GEN_DIR = path.resolve(process.cwd(), 'data/generated');
const OUT_PATH = path.join(FE_DATA, 'content-bundle.json');

function fingerprint(problem: any): string {
  const normalized = `${problem.question_text}|${problem.correct_answer}`
    .toLowerCase()
    .replace(/\s+/g, '');
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

function normalizeDifficulty(d: any): number {
  if (typeof d === 'number') return d;
  if (d === 'easy') return 0.25;
  if (d === 'medium') return 0.5;
  if (d === 'hard') return 0.75;
  return 0.5;
}

function collectProblems(): any[] {
  const problems: any[] = [];
  const seen = new Set<string>();

  // 1. Legacy pyq-bank.json
  const pyqPath = path.join(FE_DATA, 'pyq-bank.json');
  if (fs.existsSync(pyqPath)) {
    try {
      const pyq = JSON.parse(fs.readFileSync(pyqPath, 'utf-8'));
      for (const p of pyq.problems || []) {
        const fp = fingerprint(p);
        if (seen.has(fp)) continue;
        seen.add(fp);
        problems.push({
          ...p,
          // Legacy problems often lack concept_id — use topic as fallback so they're discoverable
          concept_id: p.concept_id || p.topic,
          difficulty: normalizeDifficulty(p.difficulty),
          source: p.source || 'pyq-bank',
          verified: true,
          wolfram_verified: p.wolfram_verified || false,
          fingerprint: fp,
        });
      }
      console.log(`  ✓ pyq-bank.json: ${pyq.problems?.length || 0} problems`);
    } catch (err) {
      console.warn(`  ⚠ pyq-bank.json: ${(err as Error).message}`);
    }
  }

  // 2. Scraped corpus JSONL
  if (fs.existsSync(RAW_DIR)) {
    const files = fs.readdirSync(RAW_DIR).filter(f => f.endsWith('.jsonl'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(RAW_DIR, file), 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      let added = 0;
      for (const line of lines) {
        try {
          const rec = JSON.parse(line);
          if (rec.kind !== 'problem') continue;
          const meta = rec.metadata || {};
          if (!meta.question_text && !rec.raw_text) continue;
          const p = {
            id: meta.id || fingerprint(meta),
            question_text: meta.question_text || rec.raw_text,
            correct_answer: meta.correct_answer || '',
            options: meta.options,
            explanation: meta.explanation,
            topic: meta.topic,
            concept_id: meta.concept_id,
            difficulty: normalizeDifficulty(meta.difficulty),
            marks: meta.marks || 2,
            year: meta.year,
            source: rec.source,
            source_url: rec.source_url,
            license: rec.license,
            verified: true,
            wolfram_verified: false,
          };
          const fp = fingerprint(p);
          if (seen.has(fp) || !p.correct_answer) continue;
          seen.add(fp);
          problems.push({ ...p, fingerprint: fp });
          added++;
        } catch {}
      }
      console.log(`  ✓ ${file}: +${added} problems`);
    }
  }

  // 3. Generated (CI-produced, verified)
  if (fs.existsSync(GEN_DIR)) {
    const files = fs.readdirSync(GEN_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const gen = JSON.parse(fs.readFileSync(path.join(GEN_DIR, file), 'utf-8'));
        let added = 0;
        for (const p of gen.problems || []) {
          if (!p.verified) continue; // skip unverified
          const fp = fingerprint(p);
          if (seen.has(fp)) continue;
          seen.add(fp);
          problems.push({
            ...p,
            difficulty: normalizeDifficulty(p.difficulty),
            source: 'generated',
            fingerprint: fp,
          });
          added++;
        }
        console.log(`  ✓ ${file}: +${added} verified generated problems`);
      } catch (err) {
        console.warn(`  ⚠ ${file}: ${(err as Error).message}`);
      }
    }
  }

  return problems;
}

function collectExplainers(): Record<string, any> {
  const expPath = path.join(FE_DATA, 'explainers.json');
  if (!fs.existsSync(expPath)) {
    console.warn('  ⚠ explainers.json missing — run build-explainers.ts first');
    return {};
  }
  try {
    const data = JSON.parse(fs.readFileSync(expPath, 'utf-8'));
    console.log(`  ✓ explainers.json: ${Object.keys(data.by_concept || {}).length} concepts`);
    return data.by_concept || {};
  } catch (err) {
    console.warn(`  ⚠ explainers.json: ${(err as Error).message}`);
    return {};
  }
}

function main() {
  fs.mkdirSync(FE_DATA, { recursive: true });
  console.log('Building content bundle...\n');

  console.log('Collecting problems:');
  const problems = collectProblems();

  console.log('\nCollecting explainers:');
  const explainers = collectExplainers();

  // Stats
  const byTopic: Record<string, number> = {};
  const byDifficulty: Record<string, number> = {};
  let wolframVerified = 0;
  for (const p of problems) {
    byTopic[p.topic || 'unknown'] = (byTopic[p.topic || 'unknown'] || 0) + 1;
    const db = p.difficulty < 0.33 ? 'easy' : p.difficulty < 0.66 ? 'medium' : 'hard';
    byDifficulty[db] = (byDifficulty[db] || 0) + 1;
    if (p.wolfram_verified) wolframVerified++;
  }

  const bundle = {
    version: 2,
    generated_at: new Date().toISOString(),
    problems,
    explainers,
    stats: {
      total_problems: problems.length,
      total_explainers: Object.keys(explainers).length,
      wolfram_verified: wolframVerified,
      by_topic: byTopic,
      by_difficulty: byDifficulty,
    },
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(bundle, null, 2));

  console.log(`\n✓ Bundle written: ${OUT_PATH}`);
  console.log(`  ${problems.length} problems, ${Object.keys(explainers).length} explainers`);
  console.log(`  ${wolframVerified} Wolfram-verified`);
  console.log(`  Size: ${(fs.statSync(OUT_PATH).size / 1024).toFixed(1)} KB`);
  console.log(`  Topics: ${Object.entries(byTopic).map(([t, c]) => `${t}(${c})`).join(', ')}`);
}

main();
