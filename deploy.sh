#!/usr/bin/env bash
# Usage: ./deploy.sh user@host /var/www/founder-form
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 user@host /remote/path"
  exit 1
fi

REMOTE="$1"
REMOTE_PATH="$2"
HERE="$(cd "$(dirname "$0")" && pwd)"

if grep -q "^const SHEET_URL = '';" "$HERE/script.js"; then
  echo "ERROR: SHEET_URL in script.js is empty. Set it before deploying." >&2
  exit 1
fi

echo "Syncing $HERE -> $REMOTE:$REMOTE_PATH"
rsync -avz --delete \
  --exclude '.git' \
  --exclude '.claude' \
  --exclude '.DS_Store' \
  --exclude 'node_modules' \
  --exclude 'deploy.sh' \
  --exclude 'README.md' \
  --exclude 'nginx.conf.example' \
  "$HERE/" "$REMOTE:$REMOTE_PATH/"

echo "Done. If nginx is configured, run: ssh $REMOTE 'sudo nginx -t && sudo systemctl reload nginx'"
