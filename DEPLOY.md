# Deploying to your own server

Every push to `main` runs the CI builds; if both pass, GitHub Actions SSHes into the server and runs
`git pull` + [`deploy.sh`](deploy.sh), which builds both apps, applies database migrations and reloads them
in PM2. Everything below is one-time setup on an Ubuntu/Debian VPS.

```
browser ──► Nginx :443 ──┬─ /api, /health ──► backend  (PM2, :4000)
          (your domain)  └─ everything else ─► frontend (PM2, :3000)
```

Both apps share one domain, so `NEXT_PUBLIC_API_URL` and `FRONTEND_ORIGIN` are both `https://your-domain`.

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
  `NODE_ENV=production` and `FRONTEND_ORIGIN=https://your-domain`.
- `frontend/.env.local`: `NEXT_PUBLIC_API_URL=https://your-domain`.

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
    server_name your-domain;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # Live updates (/api/stream) are a long-lived Server-Sent Events connection.
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 1h;
        client_max_body_size 6m;    # player photos are up to 5 MB
    }

    location /health {
        proxy_pass http://127.0.0.1:4000;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/church-games /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx && sudo certbot --nginx -d your-domain
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable   # keeps :3000/:4000 private
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
