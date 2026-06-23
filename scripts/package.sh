#!/usr/bin/env bash
# Build a Chrome Web Store / Edge / Firefox upload zip containing only the
# files the extension needs at runtime (no tests, scripts, or docs).
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./manifest.json').version")"
OUT="dist/ai-blocker-v${VERSION}.zip"

mkdir -p dist
rm -f "$OUT"

# Runtime files only. icons/, src/, rules/ + the manifest.
zip -rq "$OUT" \
  manifest.json \
  icons \
  src \
  rules \
  -x '*/.DS_Store'

echo "Built $OUT"
unzip -l "$OUT"
