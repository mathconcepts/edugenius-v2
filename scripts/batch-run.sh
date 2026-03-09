#!/usr/bin/env bash
# ============================================================
# EduGenius — Batch Pipeline Runner
# ============================================================
# Triggers agent batch jobs via the BatchRunner TypeScript module.
#
# Usage:
#   ./scripts/batch-run.sh                     # Run all due jobs
#   ./scripts/batch-run.sh all                 # Run all due jobs
#   ./scripts/batch-run.sh atlas:content-generation
#   ./scripts/batch-run.sh status              # Show job status
#   ./scripts/batch-run.sh --dry-run           # Dry run (no side effects)
#   ./scripts/batch-run.sh atlas:content-generation --dry-run
#
# Environment:
#   Load .env.local / .env.hybrid / etc. before calling, or pass via:
#   ENV_FILE=/path/to/.env ./scripts/batch-run.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

JOB_ARG="${1:-all}"
DRY_RUN=false

# Parse flags
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
  esac
done

# Remove flag from JOB_ARG if it's a flag
[[ "$JOB_ARG" == --* ]] && JOB_ARG="all"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[batch]${NC} $*"; }
success() { echo -e "${GREEN}[batch] ✅${NC} $*"; }
warn()    { echo -e "${YELLOW}[batch] ⚠️${NC} $*"; }
error()   { echo -e "${RED}[batch] ❌${NC} $*"; exit 1; }

# ── Load environment ──────────────────────────────────────────
load_env() {
  local env_file="${ENV_FILE:-}"

  if [[ -n "$env_file" && -f "$env_file" ]]; then
    info "Loading env from: $env_file"
    set -a; source "$env_file"; set +a
    return
  fi

  # Auto-detect by trying common env files
  for f in \
    "$PROJECT_ROOT/.env.local" \
    "$PROJECT_ROOT/.env.hybrid" \
    "$PROJECT_ROOT/.env.production" \
    "$PROJECT_ROOT/.env"; do
    if [[ -f "$f" ]]; then
      info "Auto-loading env: $f"
      set -a; source "$f"; set +a
      return
    fi
  done

  warn "No .env file found. Using system environment only."
}

load_env

# ── Pre-flight ────────────────────────────────────────────────
info "EduGenius Batch Runner"
echo "────────────────────────────────────────"
info "Job:     $JOB_ARG"
info "Dry run: $DRY_RUN"
info "Node:    $(node --version 2>/dev/null || echo 'not found')"
echo ""

command -v node &>/dev/null || error "Node.js not found. Install Node 20+."

# ── Build if needed ───────────────────────────────────────────
if [[ ! -f "$PROJECT_ROOT/dist/autonomy/batchRunner.js" ]]; then
  info "Compiled output not found. Building..."
  cd "$PROJECT_ROOT"
  npm run build 2>&1 | tail -20
  success "Build complete."
fi

# ── Run via Node ──────────────────────────────────────────────
cd "$PROJECT_ROOT"

DRY_FLAG=""
$DRY_RUN && DRY_FLAG="--dry-run"

# The batchRunner.js has a CLI entry point that detects argv
node --input-type=module <<NODESCRIPT
import { batchRunner } from './dist/autonomy/batchRunner.js';

const jobArg = '${JOB_ARG}';
const dryRun = ${DRY_RUN};

(async () => {
  console.log('\\n=== EduGenius Batch Runner ===');
  console.log('Mode:', dryRun ? 'DRY RUN' : 'LIVE');
  console.log('Target:', jobArg);
  console.log('');

  if (jobArg === 'all') {
    const results = await batchRunner.runDue(dryRun);
    if (results.length === 0) {
      console.log('No jobs are due at this time.');
      console.log('Use a specific job ID to run on demand.');
    } else {
      console.log('\\nCompleted', results.length, 'job(s):');
      for (const r of results) {
        const icon = r.status === 'succeeded' ? '✅' : r.status === 'skipped' ? '⏭️' : '❌';
        console.log(' ', icon, r.jobId, '-', r.result?.summary ?? r.status);
      }
    }
  } else if (jobArg === 'status') {
    const status = batchRunner.status();
    console.log('Registered batch jobs:\\n');
    for (const j of status) {
      const last = j.lastStatus ?? 'never';
      const runs = j.runCount;
      const fails = j.failCount;
      const enabled = j.enabled ? '✅' : '⏸️';
      console.log(\`  \${enabled} \${j.jobId.padEnd(35)} schedule=\${j.schedule.padEnd(15)} runs=\${runs} fails=\${fails} last=\${last}\`);
    }
  } else {
    // Run specific job
    try {
      const exec = await batchRunner.run(jobArg, dryRun);
      console.log('\\nResult:', exec.status === 'succeeded' ? '✅' : '❌', exec.status);
      console.log('Summary:', exec.result?.summary);
      if (exec.durationMs) console.log('Duration:', exec.durationMs + 'ms');
      if (exec.result?.tokensUsed) console.log('Tokens used:', exec.result.tokensUsed);
      console.log('\\nLogs:');
      exec.logs.forEach(l => console.log(' ', l));
      process.exit(exec.status === 'succeeded' ? 0 : 1);
    } catch (err) {
      console.error('Error:', err.message);
      process.exit(1);
    }
  }
})();
NODESCRIPT

echo ""
success "Batch run complete."
