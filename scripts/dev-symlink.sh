#!/usr/bin/env bash
# dev-symlink.sh - point the scraper's node_modules at an existing
# dev tree. Useful when offline and you already have an
# installable dep set.
#
# Usage:
#   scripts/dev-symlink.sh /path/to/existing/node_modules
#
# Default target: the HLYM website's node_modules tree.

set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-/Volumes/SSD 480G B/MacBook Air/Documents/HLYM Website/node_modules}"
if [ ! -d "$TARGET" ]; then
  echo "no node_modules at $TARGET" >&2
  exit 1
fi
ln -sfn "$TARGET" "$HERE/scraper/node_modules"
echo "linked $HERE/scraper/node_modules -> $TARGET"
