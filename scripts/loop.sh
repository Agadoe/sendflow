#!/bin/bash
# SendFlow build loop — driver.
# This is NOT the spawner (the OpenClaw sessions_spawn tool is).
# This is the cron-driven status check + tripwire.
# Clio (the main agent) reads this output on the 30-min heartbeat poll.

set -uo pipefail

REPO="/Users/admin/whatsapp-saas"
LOG="$REPO/loop.log"
STATUS="$REPO/SENDFLOW_STATUS.md"
HEARTBEAT="$HOME/.openclaw/workspace/memory/heartbeat-sendflow.json"

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# --- Pre-state ---
pre_commit=$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo "none")
pre_ts=$(stat -f %m "$LOG" 2>/dev/null || echo 0)
now=$(date +%s)

# --- Heartbeat file (atomic write) ---
mkdir -p "$(dirname "$HEARTBEAT")"
cat > "$HEARTBEAT" <<EOF
{
  "checked_at": "$(ts)",
  "repo": "$REPO",
  "last_commit": "$pre_commit",
  "loop_log_mtime": "$pre_ts",
  "loop_log_age_sec": $((now - pre_ts)),
  "open_work_items": $(grep -c "^- " "$STATUS" 2>/dev/null || echo 0),
  "status": "unknown"
}
EOF

# --- Tripwire 1: loop stalled (no log activity in 45 min) ---
stale=0
if [[ "$pre_ts" -gt 0 ]]; then
  age=$((now - pre_ts))
  if [[ $age -gt 2700 ]]; then
    stale=1
  fi
fi

# --- Tripwire 2: same blocker in 2 consecutive log entries ---
# (claude-code writes "Blocked:" lines to the status file; we check if the
# same blocked item appears in the last 2 log entries)
last_two=$(tail -10 "$LOG" 2>/dev/null | grep -i "blocked:" | tail -2)
same_blocker=0
if [[ $(echo "$last_two" | wc -l) -ge 2 ]]; then
  # If both lines reference the same blocker, trip
  first=$(echo "$last_two" | head -1)
  if echo "$last_two" | tail -1 | grep -qF "$(echo "$first" | sed 's/.*[Bb]locked: //')"; then
    same_blocker=1
  fi
fi

# --- Build status payload ---
status="ok"
reason=""
if [[ $stale -eq 1 ]]; then
  status="stale"
  reason="loop.log has not been updated in >45 min"
fi
if [[ $same_blocker -eq 1 ]]; then
  status="stuck"
  reason="same blocker appears in 2 consecutive iterations"
fi

# --- Done check ---
if ! grep -qE "^## Open work" "$STATUS" 2>/dev/null; then
  status="done"
  reason="Open work section is empty or missing"
fi

# --- Update heartbeat with verdict ---
cat > "$HEARTBEAT" <<EOF
{
  "checked_at": "$(ts)",
  "repo": "$REPO",
  "last_commit": "$pre_commit",
  "loop_log_mtime": "$pre_ts",
  "loop_log_age_sec": $((now - pre_ts)),
  "open_work_items": $(grep -c "^- " "$STATUS" 2>/dev/null || echo 0),
  "status": "$status",
  "reason": "$reason"
}
EOF

# --- Echo for cron mail / clio ingestion ---
echo "[sendflow-loop] $(ts) status=$status reason=\"$reason\" commit=$pre_commit"
[[ -n "$reason" ]] && echo "[sendflow-loop] action needed: $reason"

exit 0
