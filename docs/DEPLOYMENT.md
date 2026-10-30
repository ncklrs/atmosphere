# Local kiosk deployment

## 1. Prepare the Lenovo Tiny

Use a supported Linux desktop, Node.js 22 LTS, pnpm 9.12.0, Chromium, and curl. Keep the machine and Mini on a trusted LAN. Start with the existing monitor. Clone this repository into a stable directory such as `~/atmosphere`, install dependencies and build:

```sh
git clone https://github.com/ncklrs/atmosphere.git
cd atmosphere
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Open `http://127.0.0.1:3000/display` on that machine. First verify the offline demo, then stop the processes and restart with `WIIM_HOST` set. Settings → Local gateway switches the browser to the stream. Do not forward ports 3000 or 8787 to the internet.

## 2. Configure process startup

`scripts/atmosphere.service.example` is a **user-service template**, not an installer. Change its working directory and PATH to match the actual Node/pnpm installation. An interactive version manager's shell setup is not automatically loaded by systemd. The optional `~/.config/atmosphere.env` file uses plain assignments, without `export`:

```ini
WIIM_HOST=192.168.1.42
WEB_ORIGIN=http://127.0.0.1:3000
# WIIM_ALLOW_SELF_SIGNED=true
# LYRICS_PROVIDER=lrclib
```

After reviewing the template, copy it to `~/.config/systemd/user/atmosphere.service`, then:

```sh
systemctl --user daemon-reload
systemctl --user enable --now atmosphere
journalctl --user -u atmosphere -f
```

The service runs the gateway and Next.js together and restarts on process failure. This example starts at user login; unattended boot behavior depends on your OS login/session configuration. Verify the service on your machine before relying on it. No system service or login policy has been installed by this implementation.

## 3. Start Chromium after desktop login

Run `scripts/kiosk.sh` from the graphical desktop session. Set `CHROMIUM_BIN` if the executable is named `chromium-browser` or installed elsewhere. It waits up to 60 seconds for the local app and opens an isolated Chromium profile in kiosk mode. It never uses `--no-sandbox`.

For desktop autostart, review `scripts/atmosphere-kiosk.desktop.example`, replace `/home/YOUR_USER/atmosphere/` with your actual checkout path, and copy it to `~/.config/autostart/atmosphere-kiosk.desktop`. The Chromium profile is distinct from your everyday browsing profile. Exit kiosk with your window manager's close shortcut; the page's fullscreen button is also available in a normal browser session.

On macOS, run `pnpm start` and open the display in the browser. The Linux service/autostart templates do not apply.

## 4. Verify sleep and recovery

The app paints black during sleep and can resume its picture when music starts, if enabled. It does not send DDC/CI, CEC, DPMS or smart-plug commands. OS screen locking, monitor standby and HDMI wake are separate settings and must be tested physically. Do not enable physical power-off automation until reliable wake has been observed repeatedly.

Complete the power-cycle, Wi-Fi outage and browser restart tests in HARDWARE_VALIDATION.md. Keep a keyboard available during initial kiosk testing. Verify no taskbar, browser dialog or login prompt interrupts the display.

## Troubleshooting

| Observation                | Check                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Another app appears        | Port 3000 is occupied; use `PORT=3210 WEB_ORIGIN=http://127.0.0.1:3210 pnpm start` and the matching browser URL |
| Gateway reconnects forever | Confirm process is running on 8787 and browser origin exactly matches WEB_ORIGIN                                |
| Device unavailable         | Check private IPv4, LAN routing, Mini firmware, and self-signed TLS opt-in                                      |
| No lyrics                  | Confirm opt-in provider, internet, duration/metadata match; missing coverage is an expected fallback            |
| No album art               | Only approved HTTPS Spotify CDN hosts are allowed; failed/other hosts use original local art                    |
| Very dark picture          | Check circadian timezone, scene override, sleep times and the lab's contrast override                           |
| Service cannot find pnpm   | Set PATH to the actual installed Node and pnpm executable directories                                           |
| Browser tests cannot start | Stop your running app/gateway; tests require dedicated ports 3210 and 8787                                      |

Public cloud hosting is outside this local kiosk design. A remote browser's `127.0.0.1` points to that browser's own machine. Do not change bind addresses to solve this without designing authentication, transport and network access deliberately.
