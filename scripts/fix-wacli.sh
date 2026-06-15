#!/bin/bash
# cleanup and restart wacli-daemon-v2

# Kill any stale chromium/browser processes
pkill -9 -f chromium 2>/dev/null || true
pkill -9 -f chrome 2>/dev/null || true
sleep 2

# Remove stale session dir
rm -rf /home/ubuntu/.wacli_auth/session-sendflow-main
echo "Session cleared"

# Restart daemon
sudo systemctl restart wacli-daemon-v2
sleep 15

# Check status
echo "=== LOGS ==="
tail -20 /home/ubuntu/wacli-daemon-v2.log

echo "=== STATUS ==="
curl -s http://127.0.0.1:4555/status

echo "=== PROCESS ==="
ps aux | grep wacli | grep -v grep