#!/usr/bin/env bash
# Creates ./.env with freshly generated secrets for docker compose.
# Nothing secret is committed to the repo.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -f .env ]; then
  echo ".env already exists — leaving it untouched."
  exit 0
fi
gen() { node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" 2>/dev/null || openssl rand -hex 48; }
cat > .env <<ENV
POSTGRES_PASSWORD=$(gen | cut -c1-32)
JWT_ACCESS_SECRET=$(gen)
JWT_REFRESH_SECRET=$(gen)
ENV
echo "Wrote .env with generated secrets."
