#!/bin/bash
# ============================================================
# GATE Math Telegram Bot — Setup Script
# Run this AFTER deploying to Render and setting env vars.
# ============================================================

set -euo pipefail

# ── Config ─────────────────────────────────────────────────
# Set these before running, or export them as env vars:
RENDER_URL="${RENDER_URL:-}"           # e.g. https://edugenius-telegram-bot.onrender.com
BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
WEBHOOK_SECRET="${TELEGRAM_WEBHOOK_SECRET:-}"

if [ -z "$RENDER_URL" ] || [ -z "$BOT_TOKEN" ]; then
  echo "ERROR: Set RENDER_URL and TELEGRAM_BOT_TOKEN before running."
  echo "  export RENDER_URL=https://your-app.onrender.com"
  echo "  export TELEGRAM_BOT_TOKEN=123456:ABC..."
  exit 1
fi

echo "=== Step 1: Verify bot identity ==="
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getMe" | python3 -m json.tool

echo ""
echo "=== Step 2: Register webhook ==="
WEBHOOK_URL="${RENDER_URL}/telegram/webhook"
PAYLOAD="url=${WEBHOOK_URL}"
[ -n "$WEBHOOK_SECRET" ] && PAYLOAD="${PAYLOAD}&secret_token=${WEBHOOK_SECRET}"

curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/setWebhook" \
  -d "$PAYLOAD" | python3 -m json.tool

echo ""
echo "=== Step 3: Verify webhook ==="
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo" | python3 -m json.tool

echo ""
echo "=== Step 4: Test daily-problem endpoint ==="
CRON_SECRET="${CRON_SECRET:-}"
if [ -n "$CRON_SECRET" ]; then
  echo "Triggering a test post..."
  curl -s -X POST "${RENDER_URL}/telegram/daily-problem" \
    -H "Authorization: Bearer ${CRON_SECRET}" | python3 -m json.tool
else
  echo "CRON_SECRET not set — skipping test post."
  echo "To test manually:"
  echo "  curl -X POST ${RENDER_URL}/telegram/daily-problem -H 'Authorization: Bearer YOUR_CRON_SECRET'"
fi

echo ""
echo "=== Done! ==="
echo "Next steps:"
echo "  1. Add the bot to your GATE Telegram groups"
echo "  2. Get group chat IDs (forward a msg from group to @userinfobot)"
echo "  3. Set TELEGRAM_GROUP_IDS in Render dashboard"
echo "  4. Set up cron at https://cron-job.org:"
echo "     URL: ${RENDER_URL}/telegram/daily-problem"
echo "     Method: POST"
echo "     Header: Authorization: Bearer <CRON_SECRET>"
echo "     Schedule: 0 3 * * * (9:00 AM IST = 3:30 AM UTC)"
