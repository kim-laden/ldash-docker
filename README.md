# ldash-docker

The Docker stack for Ldash, the ops dashboard by Laden AS. It runs the Ldash web board as a browser demo, with its own copy of the Ldash account and vault service behind it. Two containers and one named volume:

- `api`: the Ldash account service (`api/server.py`, Python 3.12, standard library only, SQLite). It keeps its database and the sealed `vault.conf` copies in the named volume `ldash_data`. It listens on `8741` inside the Compose network only and is not published.
- `web`: nginx 1.27 alpine. It serves the board under `/docker/ldash/` and proxies `/docker/ldash/ldash/` to the `api` container.

Live Docker demo: [https://laden.no/docker/ldash/](https://laden.no/docker/ldash/). The desktop app (Windows, macOS, Linux, Android) is at [https://laden.no/downloads/dash/](https://laden.no/downloads/dash/).

Copyright Laden AS (Org.nr. 937 285 833). The code is open source under the MIT License. See [LICENSE](LICENSE). The Laden name, mark and brand are trademarks of Laden AS and are not given away by that licence.

## Run it

```bash
cp .env.example .env   # optional, only to change the port or the public URL
docker compose up -d --build
```

Open [http://127.0.0.1:18084/docker/ldash/](http://127.0.0.1:18084/docker/ldash/).

- Port: `18084` on `127.0.0.1` (the `web` container listens on `80` inside). Change `HOST_PORT` and `BIND_ADDR` in `.env` to use something else.
- API health: [http://127.0.0.1:18084/docker/ldash/ldash/v1/health](http://127.0.0.1:18084/docker/ldash/ldash/v1/health) returns `{"ok": true}`.
- `LDASH_PUBLIC_URL` is the base of the `vault.conf` links the API hands back. Set it to the public address of `/docker/ldash/ldash` when the stack sits behind a proxy (the live stack uses `https://laden.no/docker/ldash/ldash`).
- Both containers have health checks, so `docker compose ps` shows `healthy` once they are up.

Stop it with `docker compose down`. Add `-v` to also delete the `ldash_data` volume (all demo accounts and vaults).

## What is here

- `api/server.py` is the Ldash account service exactly as it runs on the Laden VPS. `api/Dockerfile` runs it as an unprivileged user with `/data` as its store.
- `web/board/` is the board exactly as it ships inside the desktop app (`app.js`, `vault.js`, `journal.js`, `economy.js`, `styles.css`, `index.html`).
- `web/demo/` is copied over it in the image: `index.html` loads `demo-bridge.js` before the board and adds a one-line demo note, and `demo.css` styles that note.
- `web/nginx.conf` serves only `/docker/ldash/`. Every other path returns 404.

## The browser demo

In the desktop app, the board talks to a host bridge (`host.py`, `window.laden.call`) that can run programs, read system stats and write to disk. A web page cannot have that, so `web/demo/demo-bridge.js` stands in for it with browser-only versions. It never runs anything on the visitor's machine, and it never calls the live Laden cloud: the board's fixed cloud address `https://laden.no/ldash` is rewritten to this stack's own `/docker/ldash/ldash/`.

Works in the browser:

- First-run setup: create an account, log in, or "This device only". Accounts and sealed `vault.conf` copies go to the demo `api`, not the live service.
- Logging in from another browser pulls the sealed copy back from the demo `api` and opens it with the account password.
- Calendar, Sticky, Q-due, Monthly subs, the journal and economy views, and the board layout and Control settings.
- Weather (the browser calls open-meteo.com directly).
- The vault: unlock, folders, notes and uploaded files. They are kept in this browser's localStorage, so they are small (a few MB) and stay on that one browser.
- Export downloads `vault.conf` as a file. Import reads one from disk.
- Programs that are web links open in a new tab. The demo offers web links (laden.no, Maps, Mail, Notes) as its default programs.
- API monitors work when the target URL allows cross-origin requests (CORS).

Desktop only, and switched off in the demo:

- Live CPU, memory, load and GPU numbers. The system call returns ok with null metrics, so the board shows "–" and a short "Not available in the browser" note instead of an error. Process and window pickers stay empty for the same reason.
- Launching programs or commands, opening folders, and the terminal button.
- The local password check. With no device password, the vault uses the account password, or the username `demo` as the fallback, like the desktop app does without PAM.
- PDF export for cases and budgets.
- AI chat (Caleb's thoughts in the journal). Your API key would have to pass through the page, so the demo does not offer it.
- The global shortcut and pause mode. The settings are saved but do nothing in a browser.

The demo keeps the open `vault.conf` in localStorage in plain text, the same way the desktop app keeps it on disk. Use the demo with test data only. The demo `api` is public on the live stack, so treat it as a sandbox that can be wiped.

## Host proxy

The `web` container speaks plain HTTP and only listens on localhost. In production the host web server (Apache on the Laden VPS) owns the domain and the HTTPS certificate and proxies `https://laden.no/docker/ldash/` to `http://127.0.0.1:18084/docker/ldash/`. Put your own Nginx, Apache or Caddy in front the same way. Do not publish the port to `0.0.0.0` without a proxy in front. Allow request bodies of about 9 MB, since sealed vault copies can be large.

## Not in this repo

No secrets and no user data. The stack needs no keys or passwords: `.env.example` only names the port, the bind address and the public URL. There is no `.env`, no `vault.conf`, no `ldash.sqlite` and no sealed vaults from the live service. The demo volume starts empty.
