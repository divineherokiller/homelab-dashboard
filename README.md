##  HomeLab Dashboard

```
new project/
├── config.yaml          ← you edit this (services + bookmarks)
├── docker-compose.yml   ← how it runs on the Pi
├── Dockerfile
├── requirements.txt
└── app/
    ├── main.py          ← API + health checks
    ├── health.py
    └── static/          ← UI (modular widgets)
```

The dashboard is **config-driven**: you mostly change `config.yaml`, not code.

---

## Step 1: Copy the project to your Pi

On your Pi, create a folder and copy the whole project there. Common options:

**Option A — USB / network share**  
Copy the `new project` folder to e.g. `/home/pi/homelab-dashboard`.

**Option B — `scp` from Windows (PowerShell)**  
```powershell
scp -r "C:\Users\munta\OneDrive\Desktop\Toodles\new project" pi@192.168.1.XX:/home/pi/homelab-dashboard
```
Replace `192.168.1.XX` with your Pi’s IP.

---

## Step 2: Install Docker on the Pi (if not already)

SSH into the Pi:
```bash
ssh pi@192.168.1.XX
```

Install Docker + Compose (Raspberry Pi OS):
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```
Log out and back in so the `docker` group applies, then:
```bash
docker compose version
```

---

## Step 3: Customize `config.yaml`

Edit `config.yaml` on the Pi to match **your** setup.

### Pi-local services
Use `127.0.0.1` because Docker runs with `network_mode: host` (the container shares the Pi’s network):

```yaml
services:
  - id: jellyfin
    name: Jellyfin
    url: http://127.0.0.1:8096      # link you click
    section: media
    check:
      type: http
      url: http://127.0.0.1:8096/health   # up/down check
      timeout_ms: 3000
```

### Services on other devices
Use their LAN IP:

```yaml
  - id: homeassistant
    name: Home Assistant
    url: http://192.168.1.50:8123
    section: infra
    check:
      type: http
      url: http://192.168.1.50:8123
      timeout_ms: 3000
```

### Non-HTTP services (SSH, databases, etc.)
Use TCP instead of HTTP:

```yaml
    check:
      type: tcp
      host: 192.168.1.60
      port: 22
      timeout_ms: 3000
```

### Bookmarks
These don’t get health checks — they’re just quick links:

```yaml
bookmarks:
  - title: Router
    url: http://192.168.1.1
    section: infra
    pinned: true
```

Remove any sample services you don’t run (Jellyfin, Portainer, etc.) so you’re not flooded with red “down” badges.

---

## Step 4: Build and start on the Pi

```bash
cd /home/pi/homelab-dashboard
docker compose up -d --build
```

First build on a Pi 3B can take **5–15 minutes** — that’s normal.

Check it’s running:
```bash
docker compose ps
docker compose logs -f
```

---

## Step 5: Open the dashboard

In a browser on your LAN:

```
http://<pi-ip>:8080
```

Example: `http://192.168.1.25:8080`

You should see:
- Service cards grouped by section (Media, Infra, etc.)
- Green/red dots for up/down
- Bookmarks below
- Search at the top (`/` focuses search)

---

## Step 6: Day-to-day use

| Task | How |
|------|-----|
| Add a service | Add an entry under `services:` in `config.yaml` |
| Add a bookmark | Add under `bookmarks:` |
| Apply config changes | Click **Reload config** in the UI, or run `docker compose restart` |
| View logs | `docker compose logs -f` |
| Stop dashboard | `docker compose down` |
| Auto-start on boot | Already set via `restart: unless-stopped` |

Health checks refresh every **90 seconds** by default (`refresh_seconds` in config).

---

## How modularity works (so one part doesn’t break everything)

| Piece | If it fails… |
|-------|----------------|
| **Services widget** | Shows an error card; bookmarks still work |
| **Bookmarks widget** | Shows an error card; services still work |
| **Status checks** | Cards still open links; dots show unknown/down |
| **One bad service URL** | Only that service shows down, not the whole page |

Backend APIs are separate too:
- `/api/services` — launcher data
- `/api/bookmarks` — links only
- `/api/status` — up/down only

So a slow or broken health check doesn’t block the rest of the dashboard.

---

## Troubleshooting cheatsheet

| Problem | Likely fix |
|---------|------------|
| Page won’t load | `docker compose ps` — is it running? Firewall blocking 8080? |
| Pi service always “down” | Use `127.0.0.1`, not `localhost`, and keep `network_mode: host` |
| Remote device always “down” | Wrong IP/port, or device blocks the Pi |
| HTTP check fails but site works | Try `url: http://ip:port/` instead of `/health` |
| Build very slow / OOM on Pi 3B | Close other containers; build when Pi is idle |

Test a check manually from the Pi:
```bash
curl -I http://127.0.0.1:8096/health
```

---

## Optional next steps (when MVP works)

1. **Static IP or local DNS** — e.g. `dashboard.lan` via Pi-hole
2. **Boot service** — Docker already restarts the container; ensure Docker starts on boot: `sudo systemctl enable docker`
3. **Backup** — keep `config.yaml` in git or copy it somewhere safe
4. **Icons** — `icon` field exists in config; UI doesn’t use it yet (easy future add)
5. **Run without Docker** — for testing on Windows:
   ```powershell
   cd "C:\Users\munta\OneDrive\Desktop\Toodles\new project"
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8080
   ```
   On Windows, use your Pi’s LAN IPs in config instead of `127.0.0.1` for remote services.

---

## Suggested order for you

1. Copy project → Pi  
2. Edit `config.yaml` with **2–3 real services** first  
3. `docker compose up -d --build`  
4. Open `http://<pi-ip>:8080` and confirm up/down  
5. Add bookmarks and remaining services one section at a time  

If you want, I can help you draft a `config.yaml` tailored to your actual services — share what you run (names, ports, Pi vs other devices) and we can fill it in together.
