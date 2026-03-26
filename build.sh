#!/bin/bash
set -e

echo "=== Build started ==="
echo "NODE_ENV: $NODE_ENV"
echo "Node: $(node --version)"
echo "NPM: $(npm --version)"

echo "=== Installing root dependencies ==="
npm install --include=dev

echo "=== Installing frontend dependencies ==="
cd frontend
npm install --include=dev

echo "=== Building frontend ==="
npx tsc --version
npm run build

echo "=== Build complete ==="
ls -la dist/
