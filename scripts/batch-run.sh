#!/usr/bin/env bash
# ============================================================
# EduGenius — Batch Pipeline Runner
# ============================================================
# Triggers agent batch jobs via the BatchRunner TypeScript module.
# Each agent (Atlas, Scout, Oracle, Herald, Forge, Mentor) has
# registered batch jobs that can be run on demand or on schedule.
#
# INSTALLS automatically if missing:
#   - Node.js 20 LTS
#
# Usage:
#   ./scripts/batch-run.sh                         # Run all DUE jobs (by schedule)
#   ./scripts/batch-run.sh all                     # Run ALL jobs immediately
#   ./scripts/batch-run.sh atlas:content-gen       # Run one specific job
#   ./scripts/batch-run.sh status                  # Show all job statuses
#   ./scripts/batch-run.sh list                    # List all registered jobs
#   ./scripts/batch-run.sh --dry-run               # Dry run (no side effects)
#   ./scripts/batch-run.sh atlas:content-gen --dry-run
#
# Scheduled via system cron (run: crontab -e):
#   */5 * * * * /path/to/edugenius/scripts/batch-run.sh forge:health
#   0 2 * * *   /path/to/edugenius/scripts/batch-run.sh atlas:content-gen
#   0 */6 * * * /path/to/edugenius/scripts/batch-run.sh oracle:analytics
#   0 8 * * *   /path/to/edugenius/scripts/batch-run.sh herald:campaign
#   0 9 * * *   /path/to/edugenius/scripts/batch-run.sh mentor:engagement
#   0 6 * * 1   /path/to/edugenius/scripts/batch-run.sh scout:market-scan
#
# Environment:
#   ENV_FILE=/path/to/.env ./scripts/batch-run.sh   # Explicit env file
#   (auto-detects: .env.local, .env.hybrid, .env.production, .env)
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

JOB_ARG="due"
DRY_RUN=false

# Parse positional args and flags
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --*)       ;;  # skip other flags
    *)         JOB_ARG="$arg" ;;
  esac
done

# Default with no args: run due jobs
[[ "$JOB_ARG" == "due" && $# -eq 0 ]] && JOB_ARG="due"

source "$SCRIPT_DIR/_install_common.sh"

info()    { echo -e "${BLUE}[batch]${NC} $*"; }
success() { echo -e "${GREEN}[batch] ✅${NC} $*"; }
warn()    { echo -e "${YELLOW}[batch] ⚠️${NC}  $*"; }
error()   { echo -e "${RED}[batch] ❌${NC} $*"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   EduGenius — Batch Runner           ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════╝${NC}"
echo ""

# ── Install dependencies ──────────────────────────────────────
ensure_node

# ── Load environment ──────────────────────────────────────────
load_env() {
  local env_file="${ENV_FILE:-}"
  if [[ -n "$env_file" && -f "$env_file" ]]; then
    info "Loading env: $env_file"
    set -a; source "$env_file"; set +a
    return
  fi
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
  warn "No .env file found — using system environment only."
}
load_env

info "Job target:  $JOB_ARG"
info "Dry run:     $DRY_RUN"
info "Node:        $(node --version)"
echo ""

# ── Build if dist is missing/stale ───────────────────────────
BATCH_RUNNER_DIST="$PROJECT_ROOT/dist/autonomy/batchRunner.js"

if [[ ! -f "$BATCH_RUNNER_DIST" ]]; then
  info "Compiled output not found. Building..."
  cd "$PROJECT_ROOT"
  npm run build 2>&1 | tail -10
  success "Build complete."
elif [[ "$PROJECT_ROOT/src/autonomy/batchRunner.ts" -nt "$BATCH_RUNNER_DIST" ]]; then
  info "Source changed since last build. Rebuilding..."
  cd "$PROJECT_ROOT"
  npm run build 2>&1 | tail -5
  success "Rebuild complete."
fi

# ── Run via Node ESM ──────────────────────────────────────────
cd "$PROJECT_ROOT"

node --input-type=module <<NODESCRIPT
import { batchRunner } from './dist/autonomy/batchRunner.js';

const jobArg = '${JOB_ARG}';
const dryRun = ${DRY_RUN};

function fmtDuration(ms) {
  if (!ms) return '-';
  if (ms < 1000) return ms + 'ms';
  return (ms / 1000).toFixed(1) + 's';
}

function statusIcon(status) {
  const icons = { succeeded: '✅', failed: '❌', skipped: '⏭️', running: '🔄', idle: '💤' };
  return icons[status] ?? '❓';
}

(async () => {
  console.log('Mode:', dryRun ? '🔍 DRY RUN (no side effects)' : '🚀 LIVE');
  console.log('');

  switch (jobArg) {
    // ── Status ──────────────────────────────────────────────
    case 'status': {
      const jobs = batchRunner.status();
      if (jobs.length === 0) {
        console.log('No batch jobs registered.');
        break;
      }
      console.log('Registered batch jobs:\n');
      console.log(
        '  ' + 'JOB ID'.padEnd(38) + 'SCHEDULE'.padEnd(18) + 'RUNS'.padEnd(6) + 'FAILS'.padEnd(6) + 'LAST STATUS'
      );
      console.log('  ' + '─'.repeat(80));
      for (const j of jobs) {
        const enabled = j.enabled ? '' : ' [paused]';
        console.log(
          '  ' +
          (j.jobId + enabled).padEnd(38) +
          j.schedule.padEnd(18) +
          String(j.runCount).padEnd(6) +
          String(j.failCount).padEnd(6) +
          (j.lastStatus ?? 'never')
        );
      }
      console.log('');
      break;
    }

    // ── List ─────────────────────────────────────────────────
    case 'list': {
      const jobs = batchRunner.status();
      console.log('Available batch jobs:\n');
      for (const j of jobs) {
        const enabled = j.enabled ? '✅' : '⏸️ ';
        console.log(\`  \${enabled} \${j.jobId}\`);
        console.log(\`      Agent:    \${j.agentId}\`);
        console.log(\`      Schedule: \${j.schedule}\`);
        console.log('');
      }
      break;
    }

    // ── Due (default) ─────────────────────────────────────────
    case 'due': {
      console.log('Running jobs that are due by schedule...\n');
      const results = await batchRunner.runDue(dryRun);
      if (results.length === 0) {
        console.log('  No jobs are due at this time.');
        console.log('  Use a specific job ID to force-run, or \\'all\\' to run everything.');
      } else {
        console.log(\`  Completed \${results.length} job(s):\n\`);
        for (const r of results) {
          console.log(\`  \${statusIcon(r.status)} \${r.jobId}\`);
          if (r.result?.summary) console.log(\`      Summary: \${r.result.summary}\`);
          if (r.durationMs)      console.log(\`      Time:    \${fmtDuration(r.durationMs)}\`);
        }
      }
      break;
    }

    // ── All ───────────────────────────────────────────────────
    case 'all': {
      console.log('Running ALL batch jobs immediately...\n');
      const jobs = batchRunner.status();
      let passed = 0, failed = 0;
      for (const j of jobs) {
        if (!j.enabled) { console.log(\`  ⏸️  \${j.jobId} — skipped (paused)\`); continue; }
        try {
          const r = await batchRunner.run(j.jobId, dryRun);
          const icon = r.status === 'succeeded' ? '✅' : '❌';
          console.log(\`  \${icon} \${j.jobId} — \${r.result?.summary ?? r.status} (\${fmtDuration(r.durationMs)})\`);
          r.status === 'succeeded' ? passed++ : failed++;
        } catch (e) {
          console.log(\`  ❌ \${j.jobId} — ERROR: \${e.message}\`);
          failed++;
        }
      }
      console.log(\`\n  Summary: \${passed} passed, \${failed} failed\`);
      if (failed > 0) process.exit(1);
      break;
    }

    // ── Specific job ──────────────────────────────────────────
    default: {
      try {
        console.log(\`Running job: \${jobArg}\n\`);
        const r = await batchRunner.run(jobArg, dryRun);
        console.log(\`Status:  \${statusIcon(r.status)} \${r.status}\`);
        if (r.result?.summary) console.log(\`Summary: \${r.result.summary}\`);
        if (r.durationMs)      console.log(\`Time:    \${fmtDuration(r.durationMs)}\`);
        if (r.result?.tokensUsed) console.log(\`Tokens:  \${r.result.tokensUsed.toLocaleString()}\`);
        if (r.logs?.length) {
          console.log(\`\nLogs:\`);
          r.logs.forEach(l => console.log(\`  \${l}\`));
        }
        if (r.status !== 'succeeded') process.exit(1);
      } catch (e) {
        if (e.message?.includes('not found')) {
          console.error(\`❌ Job '\${jobArg}' not found.\`);
          console.error('');
          console.error('Available jobs:');
          batchRunner.status().forEach(j => console.error(\`  • \${j.jobId}\`));
        } else {
          console.error('❌ Error:', e.message);
        }
        process.exit(1);
      }
    }
  }
})();
NODESCRIPT

echo ""
success "Batch run complete."
