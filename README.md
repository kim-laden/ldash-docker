# ldash-docker

Docker stack for [Ldash](https://laden.no/portfolio) account API + browser demo.

## Services

| Service | Role | URL / port |
|---------|------|------------|
| `api-main` | **Main** account server (production data copy) | Host `127.0.0.1:8742` → Apache `https://laden.no/ldash/` |
| `api` | Demo sandbox (empty DB, own volume) | Internal only; used by `web` |
| `web` | Browser demo UI | Host `127.0.0.1:18084` → Apache `https://laden.no/docker/ldash/` |

Production account data lives in Docker volume `ldash_data_main` (a **copy** of `/var/lib/ldash`, not a bind-mount). The demo uses volume `ldash_data` and never shares real accounts.

## Standby (systemd)

The old `ldash-account` systemd unit stays enabled on `127.0.0.1:8741` with data under `/var/lib/ldash`. It is a standby only: Apache `/ldash/` points at Docker `api-main` (`8742`).

A systemd timer `ldash-sync-standby.timer` runs every 10 minutes:

1. SQLite `.backup` from `ldash_data_main`
2. rsync vaults from the main volume
3. briefly stop `ldash-account`, replace `/var/lib/ldash`, start it again

So the two writers never touch the same files at once. Docker main is the live writer; systemd only serves after a manual failover.

### One-line failover (back to systemd)

```bash
sed -i 's#127.0.0.1:8742/#127.0.0.1:8741/#g' /etc/apache2/sites-enabled/000-default-le-ssl.conf && apache2ctl configtest && systemctl reload apache2
```

Switch Apache back to Docker main:

```bash
sed -i 's#127.0.0.1:8741/#127.0.0.1:8742/#g' /etc/apache2/sites-enabled/000-default-le-ssl.conf && apache2ctl configtest && systemctl reload apache2
```

(Only the `/ldash/` ProxyPass lines — not `/docker/ldash/`.)

## URLs (unchanged for clients)

- Health: `https://laden.no/ldash/v1/health`
- Vault: `https://laden.no/ldash/vault/<id>/vault.conf`
- Demo: `https://laden.no/docker/ldash/`

## Deploy (VPS)

```bash
cd /opt/ldash-docker
docker compose up -d --build
```

Create the main data volume before first start if it does not exist:

```bash
docker volume create ldash_data_main
# copy production sqlite + vaults into the volume (uid 1000), then:
docker compose up -d
```

`api-main` and `api` both use `restart: unless-stopped` and the image `HEALTHCHECK` on `/v1/health`.

## Env

See `.env.example`. Demo public URL defaults to the `/docker/ldash/ldash` path. Main hardcodes `https://laden.no/ldash`.

## Security

- No secrets or real account databases in this repo
- Containers run as uid 1000, read-only rootfs, `no-new-privileges`
