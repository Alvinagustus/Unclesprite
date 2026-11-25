#!/usr/bin/env bash
# deploy.sh — push UncleSprite build into a Fly.io Sprite.
#
# Packages dist/ + package.json, base64-encodes it (the sprite file push path is
# unreliable on Windows/MSYS), and extracts it inside the Sprite at
# /home/sprite/unclesprite.
#
# Env:
#   SPRITE_NAME   target sprite (default: unclesprite)

set -euo pipefail
SPRITE_NAME="${SPRITE_NAME:-unclesprite}"

if ! command -v sprite >/dev/null 2>&1; then
  echo "error: sprite CLI not found (install from sprites.dev/cli/installation)" >&2
  exit 1
fi

echo "> building..."
npm run build >/dev/null

echo "> packaging..."
tar czf /tmp/unclesprite-dist.tgz dist package.json
base64 -w0 /tmp/unclesprite-dist.tgz > /tmp/unclesprite-dist.b64

echo "> pushing to sprite '$SPRITE_NAME'..."
B64="$(cat /tmp/unclesprite-dist.b64)"
sprite exec -s "$SPRITE_NAME" -- bash -c \
  "echo '$B64' | base64 -d > /tmp/unclesprite-dist.tgz && \
   mkdir -p /home/sprite/unclesprite && \
   rm -rf /home/sprite/unclesprite/dist && \
   tar xzf /tmp/unclesprite-dist.tgz -C /home/sprite/unclesprite && \
   ls /home/sprite/unclesprite/dist/src/"

echo "> deployed to /home/sprite/unclesprite"