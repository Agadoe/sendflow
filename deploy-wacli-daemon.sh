#!/bin/bash
# Deploy wacli-daemon to VPS
# Usage: ./deploy-wacli-daemon.sh

set -e

KEY="/Users/admin/Documents/Obsidien/Projects/narhkom@gmail.com-2026-05-19T21_04_05.580Z.pem"
HOST="ubuntu@84.8.221.131"
DEST_DIR="/home/ubuntu/wacli"
DAEMON_SRC="/Users/admin/whatsapp-saas/wacli-daemon.js"

echo "=== SendFlow wacli-daemon Deploy ==="

# Copy daemon script
echo "[1/4] Copying wacli-daemon.js..."
scp -i "$KEY" "$DAEMON_SRC" "$HOST:$DEST_DIR/wacli-daemon.js"

# Install dependencies (already done but re-run to be safe)
echo "[2/4] Ensuring dependencies..."
ssh -i "$KEY" "$HOST" "cd $DEST_DIR && npm install whatsapp-web.js qrcode-terminal 2>&1 | tail -3"

# Stop existing daemon
echo "[3/4] Stopping old daemon..."
ssh -i "$KEY" "$HOST" "pkill -f wacli-daemon 2>/dev/null || true; sleep 1; echo 'stopped'"

# Start daemon (background)
echo "[4/4] Starting daemon..."
ssh -i "$KEY" "$HOST" "cd $DEST_DIR && WACLI_PORT=4555 nohup node wacli-daemon.js >> wacli-daemon.log 2>&1 &"
sleep 4
echo "--- daemon status ---"
ssh -i "$KEY" "$HOST" "curl -s http://localhost:4555/status 2>/dev/null || echo 'not responding yet'; tail -15 wacli-daemon.log" 2>&1

echo "=== Deploy complete ==="
echo ""
echo "Check status: curl http://84.8.221.131:4555/status"
echo "Check QR:     curl http://84.8.221.131:4555/qr"