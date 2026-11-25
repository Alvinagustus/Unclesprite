#!/usr/bin/env bash
# demo.sh — one-command golden-path demo for UncleSprite.
#
# Runs the full paranoid pipeline inside a Fly.io Sprite:
#   bunker checkpoint -> zero-trust scan -> GitHub issue -> Jev decision ->
#   template omelan + Pinecone grudge -> GitHub comment.
#
# Requirements:
#   - sprite CLI authenticated (sprite login)
#   - a Sprite that exists (default: unclesprite)
#   - connector ids exported (see below)
#
# Env:
#   SPRITE_NAME         Sprite to run in        (default: unclesprite)
#   GITHUB_CONN_ID      GitHub connector id     (required)
#   OPENROUTER_CONN_ID  OpenRouter connector id (required for Jev)
#   PINECONE_CONN_ID    Pinecone connector id   (optional; grudge memory)
#   ISSUE               issue ref               (default: <owner>/<repo>#1)

set -euo pipefail

SPRITE_NAME="${SPRITE_NAME:-unclesprite}"
ISSUE="${ISSUE:-<owner>/<repo>#1}"

: "${GITHUB_CONN_ID:?set GITHUB_CONN_ID}"
: "${OPENROUTER_CONN_ID:?set OPENROUTER_CONN_ID}"

echo "🦃 UncleSprite demo — target: $ISSUE (sprite: $SPRITE_NAME)"

# 1. Bunker: checkpoint the Sprite before doing anything (host-side).
if command -v sprite >/dev/null 2>&1; then
  sprite checkpoint create -s "$SPRITE_NAME" >/dev/null 2>&1 \
    && echo "> [bunker] checkpoint created" \
    || echo "> [bunker] checkpoint skipped"
fi

# 2. Run the agent inside the Sprite (connectors never expose keys to the VM).
sprite exec -s "$SPRITE_NAME" -- bash -c \
  "cd /home/sprite/unclesprite && \
   GITHUB_CONN_ID='$GITHUB_CONN_ID' \
   OPENROUTER_CONN_ID='$OPENROUTER_CONN_ID' \
   PINECONE_CONN_ID='${PINECONE_CONN_ID:-}' \
   SPRITE_NAME='$SPRITE_NAME' \
   node dist/src/cli.js 'review $ISSUE'"

echo "> demo complete. Check the GitHub issue for UncleSprite's verdict comment."