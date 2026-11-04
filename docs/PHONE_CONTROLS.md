# Paired phone controls

The display computer remains the music observer. Spotify Connect playback stays
in Spotify. A paired controller changes room presentation, never WiiM transport
or audio capture. A phone on the same Wi-Fi needs no microphone, HTTPS capture,
USB interface or paid app.

## Start the two surfaces

From the repository root, build once and start the loopback owner:

```sh
pnpm build
ROOM_OWNER=1 ROOM_STATE_FILE=.data/room.json ROOM_LAN_PORT=3211 WIIM_HOST=192.168.0.33 WIIM_ALLOW_SELF_SIGNED=true LYRICS_PROVIDER=lrclib PORT=3210 WEB_ORIGIN=http://127.0.0.1:3210 pnpm start
```

In a second terminal, start the LAN controller surface. It uses the same loopback
gateway; do not set `ROOM_OWNER=1` on this server:

```sh
cd apps/web
ROOM_OWNER=0 pnpm exec next start --hostname 0.0.0.0 --port 3211
```

On the computer open `http://127.0.0.1:3210/settings`, enable **Phone controls**, and
read the six-digit code and suggested local-network controller URL. Open that
`http://<computer-wifi-address>:3211/remote` URL on the phone and enter the code.
If no URL is detected, use the computer's current Wi-Fi IPv4 address. The computer
must remain awake and both devices must be on the same reachable LAN.

The controller changes backgrounds/favorites, per-song rotation, energy, brightness,
lyrics, display information and per-song lyric corrections. Changes normally
arrive within one second. Native browser fullscreen still requires a gesture on
the display computer; clean viewing can be controlled remotely.

## State and access

Settings become shared only after explicit owner enablement. They are validated
by the gateway and saved atomically when `ROOM_STATE_FILE` is configured. The file
contains presentation preferences and per-song identifiers, no Spotify credentials
or audio. `.data/` is Git-ignored. When sharing is off, each browser keeps its local
preferences. Re-enabling adopts the owner's current preferences.

Pairing returns an opaque token in an HttpOnly, SameSite=Strict cookie. LAN pages
cannot enable/revoke the room or read its pairing code. Cross-origin writes are
rejected, payloads are bounded, and pairing attempts are limited. Disabling Phone
controls revokes all controller tokens and rotates the code. After a gateway
restart, room preferences survive but controllers must pair again. The owner
reconnects to the new room session automatically.

This is a household LAN feature over HTTP; cookies are Secure when using HTTPS.
Do not port-forward it or expose it to the public internet. The owner capability
belongs only on a loopback-bound web server. Audio permissions and sessions remain
local to the browser that started them and are never started by a room update.

Updates send only the changed top-level settings. Different controls merge at the
server; simultaneous changes to one setting use the last accepted write. Clients
queue overlapping changes, retry interrupted writes, ignore older revisions and
show connection failures. The controller URL contains no pairing credential.
