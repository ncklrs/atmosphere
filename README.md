# Atmosphere

A local music display: an ambient art object at rest, cinematic line lyrics while music plays. Built for a WiiM Mini, a Lenovo Tiny, and an existing monitor. No Spotify OAuth or music playback service is needed.

## Run the offline demo

Use Node.js 22 LTS and pnpm 9.12.0. Install once while online; the demo runs entirely on local assets afterward.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open [the display](http://127.0.0.1:3000/display). The visual lab, settings, and diagnostics are available from the navigation. The demo includes three original synthetic tracks/lyric sequences and original procedural artwork. It does not play audio. Pause, seek, previous and next controls affect this simulation only.

If port 3000 is occupied:

```sh
PORT=3210 WEB_ORIGIN=http://127.0.0.1:3210 pnpm dev
```

Use the exact `127.0.0.1` URL matching `WEB_ORIGIN`. The gateway intentionally rejects other browser origins. Both processes bind loopback; this is a kiosk running on the same machine as the browser.

## Connect your WiiM

Find the Mini's private IPv4 in WiiM Home, or run the bounded, read-only SSDP discovery command:

```sh
pnpm discover
WIIM_HOST=192.168.1.42 pnpm dev
```

Select **Settings → Local gateway** in the browser. No device address or credentials are accepted through a browser API. Playback remains controlled through Spotify Connect or your music app; Atmosphere only observes it. The gateway polls `getPlayerStatusEx`, falls back to `getPlayerStatus`, and supplements with `getMetaInfo`. HTTPS is tried first, followed by HTTP. If your Mini uses a self-signed certificate, explicitly opt in for this one configured device:

```sh
WIIM_HOST=192.168.1.42 WIIM_ALLOW_SELF_SIGNED=true pnpm dev
```

TLS verification is never disabled globally. Firmware requiring mutual TLS is not implemented. Unsupported firmware or sources show unavailable metadata/artwork instead of fabricated information. Real hardware compatibility has not been verified; follow [the hardware checklist](docs/HARDWARE_VALIDATION.md).

## Lyrics and timing

The offline demo uses original timestamped line cues. Live synchronized lyrics are disabled by default. LRCLIB is an opt-in prototype provider; review its terms, coverage, attribution and suitability for your use before enabling it:

```sh
WIIM_HOST=192.168.1.42 LYRICS_PROVIDER=lrclib pnpm dev
```

The provider requires matching artist/title and duration within three seconds, and checks album when both sides supply it. It accepts actual LRC timestamps, never estimates word timings, and falls back to artwork with contextual copy on no match, instrumental material, timeout or outage. Positive lyric calibration in the lab advances the lyric clock. Lyrics are cached in memory for one hour (misses for one minute), bounded to 100 entries; no lyric files or commercial redistribution service are created.

Gateway position is extrapolated before transmission and anchored to the browser's own monotonic clock on receipt. Small drift is smoothed; pause, seek and new-track observations snap immediately. Interpolation stops after six seconds without a fresh sample. Timing accuracy still depends on device observations, network latency and the actual audio output delay.

## Display behavior

- Cinema, Canvas, Portrait and Companion follow the display container's shape; explicit choices in the lab preview their proportions.
- Whisper, Flow and Pulse change line entrances. Reduced motion disables continuous movement. Word emphasis is supported only for real word cues supplied through the provider contract.
- Circadian scenes use optional approximate coordinates and an IANA timezone. Without usable solar events, fallback times are 08:00 / 18:00 / 21:00. Default sleep is 23:30–06:30. Overrides expire in one hour, and music wake is optional.
- Brightness is **software intensity only**. Black sleep does not reduce an LCD's physical backlight or switch panel power. DDC/CI, HDMI-CEC and physical wake are disabled and unverified.
- Album art accepts HTTPS URLs from a small fixed Spotify CDN allowlist. The browser loads these directly, without a gateway URL proxy. Other URLs and failed downloads use local artwork. The current palette uses curated original-art colors, with a contrast override; arbitrary album-derived palette extraction is deferred.
- Settings stay in this browser's local storage. Demo assets and fonts have no runtime third-party dependency. Live WiiM needs the LAN; opt-in lyrics and live CDN art need internet access.

## Verify and run a production kiosk

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm start
```

The browser suite owns port 3210 and gateway port 8787; stop a manually running gateway before running it. It captures all five requested viewport sizes. It will not reuse another app's server. See [deployment](docs/DEPLOYMENT.md) for Linux desktop autostart and service examples, and [security](docs/SECURITY.md) for the trust boundaries.

## Repository map

| Path                                          | Responsibility                                            |
| --------------------------------------------- | --------------------------------------------------------- |
| `apps/web`                                    | Next.js 16 / React 19 / Tailwind 4 / Motion kiosk and lab |
| `apps/gateway`                                | Long-running Node HTTP/WebSocket service and SSDP probe   |
| `packages/playback-core`                      | Playback contracts, monotonic clock, safe artwork URLs    |
| `packages/adapter-wiim`                       | Bounded read-only device probes and normalization         |
| `packages/lyrics`                             | Provider contract, LRC parser, confidence, cache          |
| `packages/motion-engine`                      | Pure cue/word selection and layout choice                 |
| `packages/circadian`                          | Solar/timezone schedule, overrides, brightness interface  |
| `packages/design-system`, `packages/fixtures` | Original palettes and demo material                       |
| `tests`                                       | Unit, HTTP/WS integration, and Playwright browser tests   |
| `docs/brief`                                  | The supplied brief, preserved as reference material       |

Read [the comprehensive implementation plan](IMPLEMENTATION_PLAN.md) and [the evidence/status report](IMPLEMENTATION_STATUS.md). Software checks do not establish real Mini handoff, audio drift, Lenovo rendering performance or monitor power compatibility.

## Reference sources

- [Next.js installation and supported runtime](https://nextjs.org/docs/app/getting-started/installation)
- [Motion React accessibility](https://motion.dev/docs/react-accessibility)
- [WiiM Mini official HTTP API](https://www.wiimhome.com/pdf/HTTP%20API%20for%20WiiM%20Mini.pdf)
- [Community WiiM field observations](https://github.com/gthibo/wiim-universal-remote/blob/main/docs/WIIM-API.md) — firmware-specific evidence, not a guarantee for this Mini
- [LRCLIB documentation](https://lrclib.net/docs)
- [SunCalc](https://github.com/mourner/suncalc)

Font binaries are self-hosted using `next/font/local`; their OFL license texts are included in `apps/web/fonts`. The synthetic demo material is original to this project. Hardware descriptions/prices in the supplied brief are unverified reference material, not current purchasing advice.
