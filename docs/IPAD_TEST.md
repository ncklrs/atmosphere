# iPad display and microphone test

Use the existing host, WiiM and iPad on the same Wi-Fi. No new hardware is needed.
Spotify Connect continues playing directly on the WiiM. The iPad microphone drives
only its own sound layer; song metadata and lyrics still come from the host.

## On the iPad

Use Safari on iPadOS 16.4 or newer. For the current local test, open
**http://192.168.0.162:3211/ipad**. The page guides these steps:

1. Download the **Atmosphere iPad HTTPS Test** certificate profile.
2. In Settings → General → VPN & Device Management, install that profile if you
   choose to trust this local test authority.
3. In Settings → General → About → Certificate Trust Settings, enable full trust
   for **Atmosphere iPad Local Test CA**. This additional step is required for a
   manually installed certificate: [Apple instructions](https://support.apple.com/en-us/102390).
4. Return to Safari and open **https://192.168.0.162:3443/ipad** using the setup
   page's secure link. If Safari still warns about the certificate, finish the
   trust steps before continuing.
5. Enter the six-digit Phone controls code shown in Settings on the host.
6. Tap **Start iPad microphone**, allow Safari microphone access, and check that
   the input meter responds. Tap **Enter display** to retain capture while moving
   into the display.

The certificate fingerprint is displayed on the setup page. The test authority
adds trust on the iPad; its private key remains on the host. Remove the
**Atmosphere iPad HTTPS Test** profile under VPN & Device Management when finished
if it is no longer needed. The host's system trust store is never modified.

Keep Safari in the foreground and the iPad awake. Reloading, locking or reopening
may require starting the microphone again. Add to Home Screen is optional; open
that installed app's `/ipad` setup and start capture there rather than expecting
Safari's active microphone to transfer into a separate app session.

Microphone sound is analyzed locally, never recorded, uploaded or played back.
The global Stop control releases capture. Real permission prompts, GPU speed and
room response still need checking on the physical iPad. Automated tests use a
synthetic stream, not a physical microphone.

## Host setup

The test uses a loopback owner on port 3210, a non-owner LAN web server on 3211,
and a small HTTPS proxy on 3443. Keep `ROOM_OWNER=0` on the LAN web server.
Enable Phone controls on the loopback owner before pairing the iPad.

Generate a dedicated local test authority and leaf certificate once:

```sh
pnpm ipad:cert 192.168.0.162
```

Set these environment variables on both web processes before starting them:

```sh
export IPAD_CA_CERT="$PWD/.data/ipad-tls/atmosphere-ipad-ca.cer"
export IPAD_HTTPS_ORIGIN=https://192.168.0.162:3443
```

Start the usual gateway and loopback web process with the WiiM settings, then
start the LAN web process from `apps/web`:

```sh
ROOM_OWNER=0 pnpm exec next start --hostname 0.0.0.0 --port 3211
```

From the repository root, start HTTPS:

```sh
pnpm ipad:https
```

The proxy forwards only to loopback port 3211, preserves the HTTPS scheme for
same-origin checks and secure pairing cookies, and restricts Host names to the
certificate's names. Optional ports: `IPAD_WEB_PORT` and `IPAD_HTTPS_PORT`.

Certificates and keys live only in ignored `.data/ipad-tls` (directory mode 0700,
keys 0600). The authority lasts 30 days; the leaf lasts seven days. Renew the leaf
with `pnpm ipad:cert 192.168.0.162 --renew` and restart HTTPS. This reuses the
installed authority; it does not extend its expiry. If Wi-Fi assigns a new host
IP, renew with that address and update `IPAD_HTTPS_ORIGIN`. After authority expiry,
remove the old iPad profile and explicitly set up a new authority.

Older Safari uses AbortController deadlines rather than newer AbortSignal static
helpers. iPads, including Safari desktop mode, automatically use a 260k-pixel
ambient canvas, 200k-pixel sound canvas and 24 fps target. DOM lyric text remains
full resolution. These are initial budgets, not a guarantee of frame rate on an
older GPU; existing slow-frame adaptation and CSS fallbacks remain available.
