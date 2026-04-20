// @ts-nocheck
/**
 * Wolfram Batch Verifier
 *
 * Walks every problem in the content bundle, asks Wolfram|Alpha to solve it
 * independently, and marks `wolfram_verified: true` on entries where the
 * answers agree.
 *
 * Used as a CI job (nightly or on-demand). Free Wolfram tier covers 2k req/mo,
 * so verifying a 34-problem bundle once costs 34 API calls — negligible.
 *
 * Skips:
 *   - Already-verified problems (unless --force)
 *   - Problems missing correct_answer (can't verify against unknown truth)
 *   - Problems with narrative-style answers (can't numerically compare)
 *
 * Produces a short report and writes the bundle back with updated flags.
 *
 * Usage:
 *   WOLFRAM_APP_ID=... npx tsx scripts/verify-wolfram-batch.ts
 *   WOLFRAM_APP_ID=... npx tsx scripts/verify-wolfram-batch.ts --force
 *   WOLFRAM_APP_ID=... npx tsx scripts/verify-wolfram-batch.ts --limit 10
 */

import fs from 'fs';
import path from 'path';
import { verifyProblemWithWolfram } from '../src/services/wolfram-service';

const BUNDLE_PATH = path.resolve(process.cwd(), 'frontend/public/data/content-bundle.json');
const REPORT_PATH = path.resolve(process.cwd(), 'data/wolfram-verify-report.json');
const RATE_LIMIT_MS = 1200; // 50 req/min — well under Wolfram's throttle
const MAX_PROBLEMS_PER_RUN = 200;

interface VerifyRecord {
  id: string;
  question_text: string;
  expected_answer: string;
  wolfram_answer: string | null;
  verified: boolean;
  latency_ms: number;
  error?: string;
}

function shouldSkip(p: any): string | null {
  if (!p.correct_answer || typeof p.correct_answer !== 'string') return 'no-correct-answer';
  const ans = p.correct_answer.trim();
  if (ans.length === 0) return 'empty-answer';
  if (ans.length > 100) return 'answer-too-long';

  // MCQ narrative answers: "Yes", "No", "Tree", "Even", "Only conditionally" etc.
  // If answer has no digits AND no standard math operators, it's a narrative answer
  // and Wolfram can't verify it without understanding the question semantically.
  const hasDigits = /\d/.test(ans);
  const hasMathOps = /[+\-*/^=√πΣ∫∂∇]|sin|cos|tan|log|exp|e\^|lim|sqrt|det|rank|Σ/.test(ans);
  if (!hasDigits && !hasMathOps) return 'narrative-answer';

  // Question is MCQ-style with narrative options — skip because Wolfram can't
  // reproduce choices, only raw computation. Heuristic: question text contains
  // "is:" or "requires" or "equals" followed by a short set of labels.
  const qText = (p.question_text || '').toLowerCase();
  if (/requires|must be|are( the)?:|equals\b/.test(qText) && ans.length < 20 && !hasDigits) {
    return 'mcq-narrative';
  }

  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const limitArg = args.indexOf('--limit');
  const limit = limitArg >= 0 ? Math.min(parseInt(args[limitArg + 1]) || 50, MAX_PROBLEMS_PER_RUN) : MAX_PROBLEMS_PER_RUN;

  const appId = process.env.WOLFRAM_APP_ID;
  if (!appId) {
    console.error('WOLFRAM_APP_ID required.');
    process.exit(1);
  }

  if (!fs.existsSync(BUNDLE_PATH)) {
    console.error(`Bundle not found at ${BUNDLE_PATH}. Run build-bundle.ts first.`);
    process.exit(1);
  }

  const bundle = JSON.parse(fs.readFileSync(BUNDLE_PATH, 'utf-8'));
  console.log(`Bundle: ${bundle.problems.length} problems, ${bundle.problems.filter((p: any) => p.wolfram_verified).length} already verified`);

  // Pick candidates: unverified (or all if --force), has verifiable answer
  const candidates = [];
  const skipped: Record<string, number> = {};
  for (const p of bundle.problems) {
    if (!force && p.wolfram_verified) continue;
    const reason = shouldSkip(p);
    if (reason) {
      skipped[reason] = (skipped[reason] || 0) + 1;
      continue;
    }
    candidates.push(p);
  }
  const target = candidates.slice(0, limit);
  console.log(`Verifying ${target.length} problems (skipped: ${JSON.stringify(skipped)})`);

  const records: VerifyRecord[] = [];
  let verified = 0, failed = 0, errors = 0;

  for (let i = 0; i < target.length; i++) {
    const p = target[i];
    process.stdout.write(`  [${i + 1}/${target.length}] ${p.id || '?'} ... `);
    const result = await verifyProblemWithWolfram(p.question_text, p.correct_answer);

    if (result.error) {
      console.log(`error: ${result.error.slice(0, 40)}`);
      errors++;
      records.push({ id: p.id, question_text: p.question_text, expected_answer: p.correct_answer,
        wolfram_answer: null, verified: false, latency_ms: result.latency_ms, error: result.error });
    } else if (result.verified) {
      console.log(`✓ (${result.latency_ms}ms)`);
      p.wolfram_verified = true;
      p.wolfram_verified_at = new Date().toISOString();
      verified++;
      records.push({ id: p.id, question_text: p.question_text, expected_answer: p.correct_answer,
        wolfram_answer: result.wolfram_answer, verified: true, latency_ms: result.latency_ms });
    } else {
      console.log(`✗ Wolfram says: ${(result.wolfram_answer || '?').slice(0, 40)}`);
      failed++;
      records.push({ id: p.id, question_text: p.question_text, expected_answer: p.correct_answer,
        wolfram_answer: result.wolfram_answer, verified: false, latency_ms: result.latency_ms });
    }

    if (i < target.length - 1) await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
  }

  // Update bundle stats
  const totalVerified = bundle.problems.filter((p: any) => p.wolfram_verified).length;
  bundle.stats = bundle.stats || {};
  bundle.stats.wolfram_verified = totalVerified;
  bundle.verified_at = new Date().toISOString();
  fs.writeFileSync(BUNDLE_PATH, JSON.stringify(bundle, null, 2));

  // Write report
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify({
    ran_at: new Date().toISOString(),
    processed: target.length,
    verified,
    disagreed: failed,
    errors,
    skipped,
    records,
  }, null, 2));

  console.log('');
  console.log(`═══════════════════════════════════════════════`);
  console.log(`  Wolfram Verification Report`);
  console.log(`═══════════════════════════════════════════════`);
  console.log(`  Processed:    ${target.length}`);
  console.log(`  ✓ Verified:   ${verified}`);
  console.log(`  ✗ Disagreed:  ${failed}  (review candidates)`);
  console.log(`  ⚠ Errors:     ${errors}`);
  console.log(`  Total bundle verified: ${totalVerified} / ${bundle.problems.length}`);
  console.log(`  Report: ${REPORT_PATH}`);
  console.log(`  Bundle updated: ${BUNDLE_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
