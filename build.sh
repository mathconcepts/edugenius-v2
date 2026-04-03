#!/bin/bash
set -e

echo "=== GATE Math Build ==="
echo "Node: $(node --version)"
echo "NPM: $(npm --version)"

echo "=== Installing root dependencies ==="
npm install --include=dev

echo "=== Installing frontend dependencies ==="
cd frontend
npm install --include=dev

echo "=== Building frontend ==="
VITE_SUPABASE_URL="${VITE_SUPABASE_URL:-$SUPABASE_URL}" \
VITE_SUPABASE_ANON_KEY="${VITE_SUPABASE_ANON_KEY:-$SUPABASE_ANON_KEY}" \
npx vite build

echo "=== Build complete ==="
ls -la dist/
