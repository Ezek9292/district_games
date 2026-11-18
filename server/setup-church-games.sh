#!/usr/bin/env bash
# Server-side setup for District Games (districtgames.edonkor.dev + districtgames-api.edonkor.dev).
# Runs ON the server as root. You don't run this yourself: server/setup-server.ps1 uploads and runs it.
# Safe to run again: every step checks whether it is already done.
#
# The server is the portfolio server, already prepared by the portfolio's setup-portfolio.sh: Nginx, ufw,
# fail2ban, the 'deploy' user with the GitHub Actions key, and the Cloudflare certificate for *.edonkor.dev.
# This script adds Node, PM2 and the two apps, which run as 'deploy' on 127.0.0.1 behind Nginx.
#
# Usage: bash setup-church-games.sh [ENV_FILE]
#   ENV_FILE  production backend env, installed as backend/.env (uploaded from backend/.env.production)
set -euo pipefail

DEPLOY_USER=deploy
APP_DIR=/home/$DEPLOY_USER/church-games
REPO_URL=https://github.com/Ezek9292/district_games.git
SITE_DOMAIN=districtgames.edonkor.dev
API_DOMAIN=districtgames-api.edonkor.dev
CERT=/etc/ssl/cloudflare/edonkor.dev.pem
CERT_KEY=/etc/ssl/cloudflare/edonkor.dev.key
ENV_FILE=${1:-}

[ "$(id -u)" -eq 0 ] || { echo "Run this as root"; exit 1; }
id "$DEPLOY_USER" >/dev/null 2>&1 || { echo "User '$DEPLOY_USER' is missing: run the portfolio setup first"; exit 1; }
[ -f "$CERT" ] && [ -f "$CERT_KEY" ] || { echo "$CERT is missing: run the portfolio setup first"; exit 1; }
as_deploy() { sudo -u "$DEPLOY_USER" -H bash -c "$1"; }

echo "==> Swap (the Next.js build needs about 1.5 GB of memory)"
if [ -z "$(swapon --noheadings)" ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "Added 2 GB swap"
else
  echo "Swap already on"
fi

echo "==> Node 22, git, PM2"
export DEBIAN_FRONTEND=noninteractive
node_major=$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || true)
if [ -z "$node_major" ] || [ "$node_major" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
fi
apt-get install -y -q nodejs git >/dev/null
command -v pm2 >/dev/null || npm install -g pm2 >/dev/null
# Start the deploy user's PM2 apps when the server boots.
pm2 startup systemd -u "$DEPLOY_USER" --hp "/home/$DEPLOY_USER" >/dev/null
echo "node $(node -v), pm2 $(pm2 -v)"

echo "==> Code in $APP_DIR"
if [ -d "$APP_DIR/.git" ]; then
  echo "Already cloned (GitHub Actions keeps it up to date)"
else
  as_deploy "git clone -q '$REPO_URL' '$APP_DIR'"
fi

echo "==> Env files"
if [ -n "$ENV_FILE" ]; then
  # Strip Windows line endings from the uploaded file.
  sed 's/\r$//' "$ENV_FILE" > "$APP_DIR/backend/.env"
  rm -f "$ENV_FILE"
  echo "Installed the uploaded backend/.env"
fi
[ -f "$APP_DIR/backend/.env" ] || { echo "backend/.env is missing: fill in backend/.env.production on your PC"; exit 1; }
# These two must match the domains, whatever the uploaded file says.
sed -i -E '/^(NODE_ENV|FRONTEND_ORIGIN|HOST|PORT)=/d' "$APP_DIR/backend/.env"
printf 'NODE_ENV="production"\nFRONTEND_ORIGIN="https://%s"\nHOST="127.0.0.1"\nPORT=4000\n' "$SITE_DOMAIN" >> "$APP_DIR/backend/.env"
printf 'NEXT_PUBLIC_API_URL=https://%s\n' "$API_DOMAIN" > "$APP_DIR/frontend/.env.local"
chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR/backend/.env" "$APP_DIR/frontend/.env.local"
chmod 600 "$APP_DIR/backend/.env"

echo "==> Build, migrate and start (deploy.sh, as $DEPLOY_USER; takes a few minutes)"
as_deploy "cd '$APP_DIR' && bash deploy.sh"

echo "==> Seed: event, organizers, default games (skips what already exists)"
as_deploy "cd '$APP_DIR/backend' && npm run --silent db:seed"

echo "==> Waiting for the apps"
for i in $(seq 1 20); do
  if curl -fsS -o /dev/null http://127.0.0.1:4000/health && curl -fsS -o /dev/null http://127.0.0.1:3000/; then
    echo "API and frontend answer locally"; break
  fi
  [ "$i" -eq 20 ] && { echo "Apps did not start. Check: sudo -u $DEPLOY_USER pm2 logs --lines 50"; exit 1; }
  sleep 3
done

echo "==> Nginx"
cat > /etc/nginx/sites-available/church-games <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $SITE_DOMAIN $API_DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $SITE_DOMAIN;
    ssl_certificate     $CERT;
    ssl_certificate_key $CERT_KEY;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name $API_DOMAIN;
    ssl_certificate     $CERT;
    ssl_certificate_key $CERT_KEY;
    client_max_body_size 6m;    # player photos are up to 5 MB

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        # Live updates (/api/stream) are a long-lived Server-Sent Events connection.
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/church-games /etc/nginx/sites-enabled/church-games
nginx -t
systemctl reload nginx

echo "==> Firewall"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null

echo "==> District Games setup done"
as_deploy "cd '$APP_DIR' && git log -1 --format='Running %h %s' && pm2 ls"
