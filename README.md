# Atmosphere

A local music display: an ambient art object at rest, cinematic line lyrics while music plays. Built for a WiiM Mini, a Lenovo Tiny, and an existing monitor. No Spotify OAuth or music playback service is needed.

## Run the offline demo

Use Node.js 22 LTS and pnpm 9.12.0. Install once while online; the demo runs entirely on local assets afterward.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open [the display](http://127.0.0.1:3000/display). The visual lab, settings, and diagnostics are available from the navigation. The demo includes three original synthetic tracks/lyric sequences and original procedural ambient visuals. It does not play audio. Pause, seek, previous and next controls affect this simulation only.

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

TLS verification is never disabled globally. Firmware requiring mutual TLS is not implemented. Unsupported firmware or sources show unavailable metadata/artwork instead of fabricated information. This household WiiM Mini has been checked with read-only playback and synchronized lyrics; additional firmware still needs validation. Follow [the hardware checklist](docs/HARDWARE_VALIDATION.md).

## Lyrics and timing

The offline demo uses original timestamped line cues. Live synchronized lyrics are disabled by default. LRCLIB is an opt-in prototype provider; review its terms, coverage, attribution and suitability for your use before enabling it:

```sh
WIIM_HOST=192.168.1.42 LYRICS_PROVIDER=lrclib pnpm dev
```

The provider requires matching artist/title and duration within three seconds, and checks album when both sides supply it. It accepts actual LRC timestamps, never estimates word timings, and keeps the ambient backdrop on no match, instrumental material, timeout or outage while lyric mode is enabled. Positive lyric calibration in the lab advances the lyric clock. Lyrics are cached in memory for one hour (misses for one minute), bounded to 100 entries; no lyric files or commercial redistribution service are created.

Gateway position is extrapolated before transmission and anchored to the browser's own monotonic clock on receipt. Small drift is smoothed; pause, seek and new-track observations snap immediately. Interpolation stops after six seconds without a fresh sample. Timing accuracy still depends on device observations, network latency and the actual audio output delay.

## Display behavior

- Cinema, Canvas, Portrait and Companion follow the display container's shape; explicit choices in the lab preview their proportions.
- Lyrics use five full-canvas compositions: cascading phrases, split corners, monument, offset margin and horizon. Phrase scale, alignment and placement change with each cue; no previous/next scrolling list is shown. The demo’s **Next lyric** button lets you compare treatments immediately.
- **Ambient visuals** in the lab offers Bloom (flowing color fields and luminous ribbons), Tide (layered contours), and Orbit (a textured ringed planet, luminous disk, nebula clouds and stars; the default preset). The visual layer continues through instrumental gaps and gets quieter behind lyrics. Whisper / Flow / Pulse also controls its speed and density. Visuals are procedural and independent of audio amplitude; the WiiM connection supplies playback metadata, not a real beat/FFT signal.
- Whisper, Flow and Pulse control the amount of angled entrance, rotation, growth and drift. Reduced motion disables continuous movement. Word emphasis is supported only for real word cues supplied through the provider contract.
- Circadian scenes use optional approximate coordinates and an IANA timezone. Without usable solar events, fallback times are 08:00 / 18:00 / 21:00. Default sleep is 23:30–06:30. Overrides expire in one hour, and music wake is optional.
- Brightness is **software intensity only**. Black sleep does not reduce an LCD's physical backlight or switch panel power. DDC/CI, HDMI-CEC and physical wake are disabled and unverified.
- Lyric mode has no album art, including the footer thumbnail. Musical breaks and unavailable lyrics leave just the ambient backdrop, without filler text or an album card. Disabling lyrics gives an ambient-only view. Idle scenes use the generative visuals and a subtly shifting clock, without an album card.
- Artwork colors come from a small, in-browser sample of the current album image on the fixed HTTPS Spotify CDN allowlist. The extracted palette colors the ambient scene without displaying an album card. Missing art, failed downloads or CORS restrictions use a deterministic curated fallback. Images are cached in memory; a late image from a previous track cannot recolor the current song. High contrast keeps lyric text white.
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

The browser suite owns separate ports 3212 and 8788, forces the offline fixture source, and never stops or replaces the live gateway on 8787. It captures all five requested viewport sizes. It will not reuse another app's server. See [deployment](docs/DEPLOYMENT.md) for Linux desktop autostart and service examples, and [security](docs/SECURITY.md) for the trust boundaries.

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

Live browsers read same-origin `/api/gateway/state` and `/api/gateway/capabilities`; Next forwards only those fixed observations to the loopback gateway. This also works from a trusted same-WiFi phone using the laptop’s web address. Gateway session identifiers let the UI recover immediately after a gateway restart, even when revision counters reset. Track metadata updates independently of lyric and artwork loading.

### Generative renderer

The primary ambient engine is a dependency-free WebGL fragment shader. Orbit produces a galactic vortex with luminous filaments and stars; Bloom produces domain-warped aurora ribbons; Tide produces evolving liquid contours. Album colors interpolate through the renderer, and track identity seeds the field. The clock continues through lyric breaks without React frame renders. Hardware rendering targets roughly 30 fps with a 520k-pixel ceiling; detected software renderers use a 90k-pixel/12 fps budget. Sustained slow frames reduce resolution further. Hidden pages stop drawing, reduced motion uses a static field, and sleep removes the canvas. Context loss or unavailable WebGL reveals the CSS fallback. These are procedural visuals, not beat detection.

### Background library and word entrances

The visual lab now offers six backgrounds: Bloom (layered aurora curtains), Tide (liquid contours and caustics), Orbit (galactic accretion), Nova (stellar corona and plasma), Prism (faceted glass and spectral light), and Voyage (perspective star travel through nebula clouds). Selection fades softly between presets without resetting the ambient clock. Every preset retains a CSS fallback and participates in the existing album palette, intensity, sleep and reduced-motion behavior.

Lyric lines cycle through five word-level entrances: rise, slide, unfold, scatter and reveal. Phrase blocks retain only gentle tilt and drift. For line-timed lyrics, words share a short presentation stagger; these are not invented word timestamps. Real enhanced-LRC timestamps control word entrances when available. All transforms are derived from playback position, so pauses freeze them and seeks reproduce them. Reduced motion shows the whole line immediately.

Prism has independent Light intensity, Motion speed and Facet size sliders in the lab. Defaults are deliberately calmer (55% light, 30% speed, 70% facet size); zero motion freezes its field while lyric playback continues. Controls persist across reloads and preset changes. Temporary LRCLIB/network failures retry after 3 seconds with backoff capped at 15 seconds, while confirmed misses remain cached for a minute.

Enable **Auto per song** in the visual lab to cycle through all six backgrounds on track changes. Rotation stays fixed during lyric updates, pauses, seeks, missing lyrics and duration/artwork enrichment. The current background survives reloads and navigation. Turning the setting off holds the current background; choosing a preset manually also turns auto off. Existing settings keep manual mode until you opt in.

### Waviz sound-layer prototype

The lab's optional **sound layer** adds Halo, Ribbons, or Stardust over the six
original backgrounds. Auto pairs the treatment with the background. Presence,
size, response, and placement controls persist locally; lyrics dim the layer.
Milkdrop and its dependencies have been removed.

Choose **Play test audio** for a quiet original loop, **Choose audio file** for local
playback, **Use computer audio** for shared tab/system sound, or **Use microphone**
for room audio. The [free Mac/AirPlay setup](docs/WIIM_COMPUTER_AUDIO.md) explains
how computer playback can feed the WiiM and the visuals without extra hardware. Audio starts only when you choose an
input. Files and microphone audio stay local; microphone input never plays through
the speakers. The Stop control disconnects all input resources. Audio persists
between Lab and Display navigation but never automatically reconnects on reload.
The WiiM connection still supplies metadata only; its music/lyrics are separate
from test/file audio. See [sound-layer architecture and audio boundaries](docs/VISUAL_ENGINES.md).
