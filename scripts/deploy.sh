#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${ESA_PROJECT_NAME:-learnapp-question-bank}"
ESA_DOMAIN="${ESA_DOMAIN:-}"
ESA_ROUTE="${ESA_ROUTE:-}"

log() {
  printf '\n[deploy] %s\n' "$1"
}

need_command() {
  command -v "$1" >/dev/null 2>&1
}

log "Checking Node.js and npm"
need_command node || { echo "Node.js is required."; exit 1; }
need_command npm || { echo "npm is required."; exit 1; }

if ! need_command esa-cli; then
  log "Installing ESA CLI globally"
  npm install -g esa-cli
fi

log "ESA CLI version"
esa-cli -v || true

if [[ -n "${ALICLOUD_ACCESS_KEY_ID:-}" && -n "${ALICLOUD_ACCESS_KEY_SECRET:-}" ]]; then
  log "Using ALICLOUD_ACCESS_KEY_ID / ALICLOUD_ACCESS_KEY_SECRET from environment"
  export ALIBABA_CLOUD_ACCESS_KEY_ID="$ALICLOUD_ACCESS_KEY_ID"
  export ALIBABA_CLOUD_ACCESS_KEY_SECRET="$ALICLOUD_ACCESS_KEY_SECRET"
else
  log "No AccessKey environment found. Running interactive ESA login"
  esa-cli login
fi

log "Validating required deployment environment"
: "${OSS_BUCKET:?Missing OSS_BUCKET}"
: "${OSS_REGION:?Missing OSS_REGION}"
: "${CORS_ALLOWED_ORIGINS:?Missing CORS_ALLOWED_ORIGINS. Use your Pages domain, for example https://learn.example.com}"

export ESA_PROJECT_NAME="$PROJECT_NAME"
export MODEL_API_ENABLED="${MODEL_API_ENABLED:-false}"
export MODEL_API_URL="${MODEL_API_URL:-https://api.openai.com/v1/chat/completions}"
export MODEL_NAME="${MODEL_NAME:-gpt-4o-mini}"
export LOG_LEVEL="${LOG_LEVEL:-info}"

log "Project: $PROJECT_NAME"
log "CORS_ALLOWED_ORIGINS: $CORS_ALLOWED_ORIGINS"
log "MODEL_API_ENABLED: $MODEL_API_ENABLED"

log "Installing frontend dependencies"
npm install

log "Building React + Vite frontend"
npm run build

log "Initializing project if needed"
esa-cli project list >/dev/null 2>&1 || esa-cli init || true

if [[ -n "$ESA_DOMAIN" ]]; then
  log "Ensuring domain is attached: $ESA_DOMAIN"
  esa-cli domain add "$ESA_DOMAIN" || true
fi

if [[ -n "$ESA_ROUTE" ]]; then
  log "Ensuring route is attached: $ESA_ROUTE"
  esa-cli route add "$ESA_ROUTE" || true
fi

log "Committing current project version"
esa-cli commit

log "Deploying to ESA production POPs"
esa-cli deploy

log "Deployment finished"
esa-cli deployments list || true
