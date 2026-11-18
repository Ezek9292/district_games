# Deploying to your own server

Every push to `main` runs the CI builds; if both pass, GitHub Actions SSHes into the server and runs
`git pull` + [`deploy.sh`](deploy.sh), which builds both apps, applies database migrations and reloads them
in PM2. Everything below is one-time setup on an Ubuntu/Debian VPS.

```
browser ─► Cloudflare ─► Nginx :443 ─┬─ districtgames-api.edonkor.dev ─► backend  (PM2, 127.0.0.1:4000)
                                     └─ districtgames.edonkor.dev     ─► frontend (PM2, 127.0.0.1:3000)
```

So `NEXT_PUBLIC_API_URL=https://districtgames-api.edonkor.dev` and `FRONTEND_ORIGIN=https://districtgames.edonkor.dev`.

## Quick setup (edonkor.dev server)

The app runs on the portfolio server (`37.27.34.194`), next to the portfolio. That server already has Nginx,
the firewall, the `deploy` user with the GitHub Actions key, and the Cloudflare certificate for
`*.edonkor.dev`. From the repo folder in the VS Code terminal:

```powershell
powershell -ExecutionPolicy Bypass -File server\setup-server.ps1
```

1. The first run creates `backend\.env.production` from your local `backend\.env`, with a new
   `JWT_SECRET`, and stops. This is the live site's settings file. It stays on your PC (git ignores it).
   Check every value is right for the live site, then run the script again.
2. It logs in with `~/.ssh/edonkor_admin` (asks for its passphrase), uploads
   [`server/setup-church-games.sh`](server/setup-church-games.sh) with the settings, and runs it. That
   installs Node 22 and PM2, clones the repo to `/home/deploy/church-games`, runs `deploy.sh` and the seed as
   `deploy`, and adds the Nginx config for both domains.
3. It checks both sites and prints the GitHub secrets to add (step 5): `SSH_HOST=37.27.34.194`,
   `SSH_USER=deploy`, `APP_DIR=/home/deploy/church-games`, and `SSH_PRIVATE_KEY` = the portfolio's
   `~/.ssh/github_deploy`.

To change a setting on the live site later, edit `backend\.env.production` and run the script again.

The manual steps below are for any other server.

## 1. Install Node, PM2, Nginx

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx
sudo npm install -g pm2
pm2 startup          # run the command it prints, so apps come back after a reboot
```

The Next.js build needs about 1.5 GB of memory. On a 1 GB server, add swap first:
`sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`
(and add `/swapfile none swap sw 0 0` to `/etc/fstab`).

## 2. Clone the repo and add the env files

```bash
git clone https://github.com/Ezek9292/district_games.git ~/church-games
cd ~/church-games
cp backend/.env.example backend/.env           # fill in real values, see below
cp frontend/.env.local.example frontend/.env.local
```

- `backend/.env`: the Supabase URLs, a fresh `JWT_SECRET`, `ORGANIZER_EMAILS`, SMTP and Cloudinary, plus
  `NODE_ENV=production` and `FRONTEND_ORIGIN=https://districtgames.edonkor.dev`.
- `frontend/.env.local`: `NEXT_PUBLIC_API_URL=https://districtgames-api.edonkor.dev`.

These files stay on the server only; git ignores them and deploys never touch them.

## 3. First deploy by hand

```bash
bash deploy.sh
(cd backend && npm run db:seed)    # once: event row, organizers, games
pm2 status                          # both apps should be "online"
```

## 4. Nginx and HTTPS

`/etc/nginx/sites-available/church-games`:

```nginx
server {
    server_name districtgames-api.edonkor.dev;
    client_max_body_size 6m;    # player photos are up to 5 MB

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Live updates (/api/stream) are a long-lived Server-Sent Events connection.
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}

server {
    server_name districtgames.edonkor.dev;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/church-games /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx && sudo certbot --nginx -d districtgames.edonkor.dev -d districtgames-api.edonkor.dev
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable   # optional: apps already listen on 127.0.0.1 only
```

## 5. Give GitHub Actions SSH access

On the server, as the user that owns `~/church-games`:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/github_actions -N "" -C "github-actions"
cat ~/.ssh/github_actions.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github_actions          # copy this private key, then you can delete the file
```

In GitHub → the repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `SSH_HOST` | server IP or hostname |
| `SSH_USER` | the user above (e.g. `ubuntu`) |
| `SSH_PRIVATE_KEY` | the whole private key, including the `-----BEGIN`/`END` lines |
| `APP_DIR` | full path of the clone, e.g. `/home/ubuntu/church-games` |
| `SSH_PORT` | only if SSH isn't on port 22 |

## 6. Check it

Push to `main` (or re-run the latest workflow in the **Actions** tab). The **Deploy to server** job shows the
output of `deploy.sh`. CI has already built the same commit, so a failed build on the server is rare; if a
step does fail, the job turns red and PM2 is not restarted. Fix it and push again, or run `bash deploy.sh` on
the server to see the error.

If the server's working copy has local edits, the deploy stops at `git merge --ff-only` instead of
overwriting them. Run `git status` there and discard or commit them.

## 7. Nightly database backups

[`backup.yml`](.github/workflows/backup.yml) dumps the app's tables every night at 02:17 UTC, encrypts the
file and keeps it under **Actions → Database backup → (run) → Artifacts** for 30 days. Add two more secrets:

| Secret | Value |
|---|---|
| `BACKUP_DATABASE_URL` | the same value as `DIRECT_URL` in `backend/.env` (session pooler, port 5432) |
| `BACKUP_PASSPHRASE` | a long random password, e.g. `openssl rand -base64 32`. **Store it in your password manager too**: without it the backups can't be opened |

Then run it once by hand (**Actions → Database backup → Run workflow**) and check that it goes green.

To restore (this replaces the current data):

```bash
gpg --decrypt church-games-YYYY-MM-DD.dump.gpg > backup.dump      # asks for BACKUP_PASSPHRASE
pg_restore --clean --if-exists --no-owner --no-privileges -d "$DIRECT_URL" backup.dump
```

GitHub pauses scheduled workflows in a repo with no commits for 60 days; if that happens, it emails you and
**Actions → Database backup → Enable workflow** turns it back on.

## 8. Uptime alerts

[`uptime.yml`](.github/workflows/uptime.yml) checks the site and `/health` (which also checks the database)
every 10 minutes; a failing run makes GitHub email you. Scheduled runs can be a few minutes late, so for
faster alerts also add a free monitor at [uptimerobot.com](https://uptimerobot.com):
**New monitor → HTTP(s) → `https://districtgames-api.edonkor.dev/health`**, interval 5 minutes, with an email
or Telegram alert. Add a second one for `https://districtgames.edonkor.dev`.

## 9. Cloudflare settings

- **SSL/TLS → Overview → Full (strict)**, so traffic is encrypted between Cloudflare and the server too. This
  needs a valid certificate on the server: either the Let's Encrypt one from step 4, or a free
  **SSL/TLS → Origin Server → Create certificate** installed in Nginx. If the site shows error 526 after
  switching, the server's certificate is missing or expired.
- **SSL/TLS → Edge Certificates → Always Use HTTPS: on**.
- Keep both DNS records **proxied** (orange cloud). The API's sign-in rate limit trusts Cloudflare's
  `CF-Connecting-IP` header to tell visitors apart. To stop anyone bypassing Cloudflare and faking that header,
  only let Cloudflare reach ports 80/443 (allow the ranges at <https://www.cloudflare.com/ips/> in `ufw` or your
  provider's firewall).
