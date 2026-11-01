#!/usr/bin/env bash
# Runs on the server after the latest code is pulled: builds both apps, applies
# database migrations and (re)starts them in PM2. Safe to run by hand too.
set -euo pipefail
cd "$(dirname "$0")"

# Non-interactive SSH sessions don't read ~/.bashrc, so load nvm if Node came from it.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then set +u; . "$NVM_DIR/nvm.sh"; set -u; fi

[ -f backend/.env ] || { echo "backend/.env is missing (copy backend/.env.example)"; exit 1; }
[ -f frontend/.env.local ] || { echo "frontend/.env.local is missing (copy frontend/.env.local.example)"; exit 1; }

echo "==> Backend"
# --include=dev: TypeScript and Prisma are dev dependencies but needed to build.
(cd backend && npm ci --include=dev && npm run build && npm run db:deploy)

echo "==> Frontend"
(cd frontend && npm ci --include=dev && npm run build)

echo "==> Restarting"
pm2 startOrReload ecosystem.config.js --update-env
pm2 save

echo "==> Deployed $(git rev-parse --short HEAD)"
