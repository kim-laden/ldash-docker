# ldash-docker

The Docker stack for Ldash, the ops dashboard by Laden AS. By default it runs **standalone on localhost** with its own demo account API — no laden.no dependency.

| Service (default) | Role | URL / port |
|---------|------|------------|
| `api` | Demo / local account server | Internal `8741`; proxied as `/docker/ldash/ldash/` |
| `web` | Browser board | Host `127.0.0.1:18084` → [http://127.0.0.1:18084/docker/ldash/](http://127.0.0.1:18084/docker/ldash/) |

Optional VPS override (`compose.vps.yml`) also starts `api-main` for production accounts on `127.0.0.1:8742` (Apache `/ldash/`). A plain Kali/Debian install should **not** use that file.

Live Docker demo: [https://laden.no/docker/ldash/](https://laden.no/docker/ldash/). Desktop installers: [https://laden.no/downloads/dash/](https://laden.no/downloads/dash/).

Copyright Laden AS (Org.nr. 937 285 833). MIT License — see [LICENSE](LICENSE). The Laden name, mark and brand are trademarks of Laden AS.

## Install on Kali / Debian

```bash
sudo apt update
sudo apt install -y docker.io docker-compose git
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"
# log out and back in (or: newgrp docker) so the docker group applies
```

Kali/Debian ship `docker.io` and the `docker-compose` package. The Compose **plugin** (`docker compose`) is optional. This repo works with both:

```bash
docker compose version      # plugin, if installed
docker-compose version      # apt package
```

## Run it (fresh machine)

```bash
git clone https://github.com/kim-laden/ldash-docker.git
cd ldash-docker
cp .env.example .env   # optional
docker compose up -d --build
# If the plugin is missing:
docker-compose up -d --build
```

Or from the v1.0 release tarball:

```bash
curl -sL -o ldash-docker-1.0.tar.gz \
  https://github.com/kim-laden/ldash-docker/archive/refs/tags/v1.0.tar.gz
tar -xzf ldash-docker-1.0.tar.gz
cd ldash-docker-1.0
docker compose up -d --build || docker-compose up -d --build
```

Open [http://127.0.0.1:18084/docker/ldash/](http://127.0.0.1:18084/docker/ldash/) (`/` redirects there).

- Port: `18084` on `127.0.0.1`. Change `HOST_PORT` / `BIND_ADDR` in `.env` if needed.
- API health: [http://127.0.0.1:18084/docker/ldash/ldash/v1/health](http://127.0.0.1:18084/docker/ldash/ldash/v1/health)
- Containers use `restart: unless-stopped`, so they return after reboot once Docker is enabled.

Stop: `docker compose down` (or `docker-compose down`). Add `-v` to delete the `ldash_data` volume.

## VPS main + demo (optional)

Only for the Laden VPS. Keeps the live `/ldash` main service separate from the `/docker/ldash` demo.

```bash
docker compose -f docker-compose.yml -f compose.vps.yml up -d --build
```

| Service | Role | URL / port |
|---------|------|------------|
| `api-main` | Main account server (production data **copy**) | Host `127.0.0.1:8742` → `https://laden.no/ldash/` |
| `api` | Demo sandbox | Used by `web` only |
| `web` | Browser demo | `127.0.0.1:18084` → `https://laden.no/docker/ldash/` |

Production data lives in volume `ldash_data_main` (a copy of `/var/lib/ldash`, not a bind-mount). The demo uses `ldash_data` and never shares real accounts.

### Standby (systemd)

The old `ldash-account` unit can stay on `127.0.0.1:8741` with `/var/lib/ldash` as standby. A timer can sync from `ldash_data_main` every 10 minutes. Failover back to systemd:

```bash
sed -i 's#127.0.0.1:8742/#127.0.0.1:8741/#g' /etc/apache2/sites-enabled/000-default-le-ssl.conf \
  && apache2ctl configtest && systemctl reload apache2
```

Switch Apache back to Docker main (`8742`) the same way. Only touch `/ldash/` ProxyPass lines — not `/docker/ldash/`.

## What is here

- `api/server.py` — Ldash account service (Python 3.12, stdlib + SQLite).
- `web/board/` — board as in the desktop app.
- `web/demo/` — browser bridge on top (`demo-bridge.js` rewrites `https://laden.no/ldash` to this stack's `/docker/ldash/ldash/`).
- `web/nginx.conf` — serves `/docker/ldash/`; `/` redirects there.

## Browser demo notes

Works: account create/login, calendar, sticky, journal, economy, weather, vault in localStorage, web-link programs.

Desktop-only (shows "–" / disabled in the browser): live CPU/GPU metrics, launching local programs, device PAM lock, PDF export, Caleb AI chat, global shortcut.

Use test data only. No secrets are stored in this repo.

## Host proxy

`web` speaks plain HTTP on localhost. Put Nginx/Apache/Caddy in front for HTTPS. Do not publish to `0.0.0.0` without a proxy. Allow ~9 MB request bodies.

## Not in this repo

No `.env`, no `vault.conf`, no `ldash.sqlite`, no live vaults. `.env.example` only names the port, bind address and public URL.
