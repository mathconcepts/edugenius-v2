#!/usr/bin/env bash
# Bootstrap gstack skills for this project.
# Run once after cloning the repo. Teammates must have `bun` installed.

set -e
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GSTACK_DIR="$PROJECT_ROOT/.claude/skills/gstack"

if [ -d "$GSTACK_DIR" ]; then
  echo "gstack already vendored at $GSTACK_DIR"
  echo "Pulling latest..."
  cd "$GSTACK_DIR" && git pull origin master && ./setup
else
  echo "Cloning gstack into $GSTACK_DIR..."
  git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git "$GSTACK_DIR"
  cd "$GSTACK_DIR"
  if ! command -v bun &>/dev/null; then
    echo "Installing bun..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
  fi
  ./setup
fi

echo ""
echo "✅ gstack installed. Skills available at:"
ls "$PROJECT_ROOT/.claude/skills/" | grep -v gstack | head -10
echo "  ... and more (run 'ls .claude/skills/' to see all)"
echo ""
echo "✅ GBrain MOAT skills available:"
for s in student-audit cohort-analysis content-gap gbrain-health daily-intelligence mock-exam weekly-digest misconception-miner seed-rag verify-sweep; do
  echo "  /$s"
done
echo ""
echo "Read $PROJECT_ROOT/CLAUDE.md for full skill documentation."
