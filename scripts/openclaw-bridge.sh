#!/bin/bash
# OpenClaw Bridge — Send messages to VPS OpenClaw agent via SSH
# Usage: ./openclaw-bridge.sh "Your message here"
# Or:    ./openclaw-bridge.sh --agent main "Your message"

VPS_HOST="ubuntu@84.8.221.131"
AGENT="main"

if [ "$1" = "--agent" ]; then
  AGENT="$2"
  shift 2
fi

MESSAGE="$*"

if [ -z "$MESSAGE" ]; then
  echo "Usage: $0 [--agent <agent-id>] \"Your message here\""
  echo ""
  echo "Examples:"
  echo "  $0 \"Check disk space\""
  echo "  $0 --agent main \"Run lead discovery\""
  exit 1
fi

echo "→ Sending to OpenClaw agent '$AGENT' on VPS..."
ssh -o StrictHostKeyChecking=no "$VPS_HOST" "openclaw agent --agent $AGENT --message '$MESSAGE'"
