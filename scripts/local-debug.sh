#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8787}"

log() {
  printf '\n[local-debug] %s\n' "$1"
}

if ! command -v esa-cli >/dev/null 2>&1; then
  log "Installing ESA CLI globally"
  npm install -g esa-cli
fi

export OSS_BUCKET="${OSS_BUCKET:-learnapp-local-bucket}"
export OSS_REGION="${OSS_REGION:-local}"
export MODEL_API_ENABLED="${MODEL_API_ENABLED:-false}"
export MODEL_API_URL="${MODEL_API_URL:-https://api.openai.com/v1/chat/completions}"
export MODEL_NAME="${MODEL_NAME:-gpt-4o-mini}"
export CORS_ALLOWED_ORIGINS="${CORS_ALLOWED_ORIGINS:-http://127.0.0.1:$PORT,http://localhost:$PORT}"
export LOG_LEVEL="${LOG_LEVEL:-debug}"

log "Starting ESA local debug server on port $PORT"
log "API base URL: http://127.0.0.1:$PORT/api"
log "Run tests with: API_BASE_URL=http://127.0.0.1:$PORT/api node tests/deploy_test.js"

esa-cli dev --port "$PORT"
