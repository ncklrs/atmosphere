# Implementation status

## Delivery boundary

The local software implementation covers M0–M4 and the software portion of M5. The hardware-dependent definition of done remains **unverified**. On 2026-11-02 the actual WiiM Mini was discovered and its identity, read-only playback and metadata endpoints were verified from the Mac. Account handoff, calibrated audio timing, the Lenovo Tiny, monitor brightness and wake remain unverified. No hardware was purchased and no public service was deployed.

The supplied nine Markdown specifications are preserved in `docs/brief`. They were treated as project reference material. The comprehensive plan was written before implementation in `IMPLEMENTATION_PLAN.md`.

## Implemented

| Milestone   | Delivered                                                                                                                                                                                                                                                                                                            |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0          | pnpm workspace; Next.js 16.4.3 / React 19 / TypeScript / Tailwind 4 / Motion; shared packages; deterministic original fixtures; lint/typecheck/build/test commands                                                                                                                                                   |
| M1          | `/display`, `/lab`, `/settings`, `/diagnostics`; four adaptive compositions; original abstract art; self-hosted fonts and license texts; three intensity presets; reduced motion; contrast override; keyboard controls; demo pause/seek/skip; missing-lyric and instrumental fallback                                |
| M2          | Separate loopback Node gateway; read-only HTTP and WebSocket observations; fixed-origin checks; bounded protocol/command fallback; per-device self-signed TLS opt-in; private IPv4 validation; metadata normalization; explicit SSDP candidate discovery; adaptive serial polling; reconnect and stale-data behavior |
| M3          | Provider contract; opt-in LRCLIB; strict artist/title/album/duration matching; LRC metadata/multiple timestamps/offsets/UTF-8; actual enhanced-LRC word cues; bounded memory cache and negative cache; pure timeline; calibration; no invented word timings                                                          |
| M4          | Timezone-aware solar and fallback scenes; adjacent-day solar offsets across midnight; DST-aware local time; smooth intensity interpolation; one-hour manual overrides; optional music wake; software-black sleep; subtle ambient-clock shifting; explicit software-only brightness adapter                           |
| M5 software | Linux user-service and desktop autostart examples; kiosk launcher; security/deployment/hardware-validation documentation; GitHub Actions workflow; reproducible browser captures                                                                                                                                     |

## Verification evidence

Development host: macOS, Node.js 23.7.0, pnpm 9.12.0, local Playwright Chromium. Node 22 LTS is the documented target and CI configuration; the remote CI result is not implied by local checks.

- Dependency installation completed; the lockfile is committed. A `tslib` override selects available version 2.8.1 because the selected dependency graph initially requested an unavailable registry tarball.
- Typecheck and lint passed. Next.js and the separate ESM gateway production bundle built successfully.
- Unit/integration suite verifies playback drift/seek/pause/reanchoring/staleness; malformed snapshot rejection; WiiM hex and metadata fallbacks; private addresses, redirects, timeouts and safe art hosts; actual HTTP/WS streaming and device outage/recovery; LRC offsets/word timing/provider mismatch/cache; solar/DST/midnight/polar fallback/overrides/settings validation.
- Browser suite verifies five display viewports (1920×1080, 1920×1200, 1080×1920, 1024×1024, 800×480), demo pause/seek/skip/gaps, persistence, reduced motion, sleep/wake override, diagnostics, gateway connection/reconnect, and offline demo interaction. Screenshots are written to `test-results/screenshots` and uploaded as CI artifacts when CI runs.
- Desktop, portrait, compact and lab captures have been visually inspected. The lab adjusts the preview's aspect ratio for forced Portrait/Canvas compositions.
- CodeRabbit CLI is installed but signed out; no external CodeRabbit review was performed. Local lint, type checking, tests and source review remain the evidence for this delivery.

Final local results: **41 unit/integration tests passed across 7 files; 29 Playwright browser tests passed.** Installation with the frozen lockfile also succeeded entirely from the package cache. CI is configured but is only verified when GitHub reports a run result.

## Unverified or deferred

| Item                                              | Boundary / next action                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WiiM compatibility                                | Read-only HTTPS verified on Muzo_Mini / Linkplay.4.6.833047; remaining source/transport tests are in `docs/HARDWARE_VALIDATION.md`; mutual TLS is unsupported |
| Two-account Spotify Connect handoff               | Must be observed on the household LAN; no Atmosphere OAuth is required                                                                                        |
| Under-3s track changes / under-250ms median drift | Targets only; collect physical timing measurements after calibration                                                                                          |
| 60fps on Lenovo Tiny                              | Requires browser performance traces on the actual kiosk                                                                                                       |
| Physical brightness / DDC/CI / power / wake       | Disabled; software darkening and black sleep do not establish panel backlight or power savings                                                                |
| Live lyric coverage and rights                    | LRCLIB remains opt-in; no claim of commercial lyric licensing or universal coverage                                                                           |
| Arbitrary album artwork / extracted palettes      | Fixed HTTPS Spotify CDN allowlist only; browser canvas palette extraction with curated fallback; no arbitrary URL proxy                                       |
| mDNS discovery                                    | Deferred; explicit SSDP probe and manual private-IP fallback implemented                                                                                      |
| Ambient light sensor                              | Optional extension point in the brief; no sensor hardware or driver implemented                                                                               |
| Unattended OS boot/login and autostart            | Reviewed example files provided; not installed or exercised on the user's Lenovo                                                                              |
| Hardware buying comparisons                       | Brief prices/model claims remain unverified; validate exact current manufacturer specs before purchase                                                        |

## Reproduce

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
pnpm start
```

Browser tests own isolated ports 3212 and 8788 and do not reuse another server. Gateway tests bind temporary loopback ports. Restricted execution environments may require permission for these local listeners. Browser mode is offline demo by default; select Local gateway to observe a configured Mini.

## Lyric choreography refinement

Replaced the fixed previous/current/next stack with five deterministic, full-canvas lyric compositions. Phrase grouping changes scale and placement without assigning or inventing word timestamps. Typography enters, grows and drifts from a pure playback-position function; Motion values update on animation frames without React frame renders. Pause freezes those transforms and seek recomputes them directly. Reduced motion keeps a static centered reading composition. Lyric mode never shows an album card or footer thumbnail. During musical gaps or missing lyrics the words clear, leaving the ambient backdrop without filler text. Disabling lyrics leaves the generative ambient scene; idle scenes use the same visuals with a clock, without an album card. Browser assertions cover art-free lyric scenes at all six viewport sizes and the ambient musical-break transition. The demo includes a phone-accessible Next lyric control. Added unit coverage for grouping, layout selection, density, frame determinism and reduced motion; browser checks cover all five treatments at the original five viewports plus 390×844, pause/seek equivalence and reduced motion.

## First real-device connection — 2026-11-02

Read-only device identity, extended playback status and metadata now respond through the live local gateway. Browser source is set to Local gateway. The actual Mini requires the existing per-device self-signed HTTPS option and refuses HTTP. A real-device placeholder (`unknow`) is now filtered instead of appearing as a confident track. The user subsequently approved transmitting track metadata to LRCLIB, and the local test gateway now has live lookup enabled. The live gateway matched 36 timestamped line cues to the playing track. Device positions advanced at approximately normal playback speed, and actual browser rendering of changing lyric cues was verified. Audible calibration and drift remain unmeasured. See the hardware validation record for the observed/remaining boundary.

## Continuous ambient visuals

Added three procedural ambient presets to the visual lab: Bloom (moving light fields), Tide (layered contours), and Orbit (sculptural orbital forms and particles). Their CSS transform animations continue independently of the playback timeline, including through instrumental gaps; the same layers become quieter under lyric text. Existing Whisper/Flow/Pulse preferences control motion speed/density. Reduced motion disables the animations; high contrast suppresses them behind lyrics while allowing full ambient-only visuals; sleep unmounts the engine. Demo palettes and missing-art fallbacks are selected deterministically from track identity; live album images now supply a browser-extracted palette when available. No beat detection, audio capture or FFT signal is claimed. Disabling lyrics during playback now leaves ambient visuals without an album card. Idle scenes use the generative engine and clock instead of an album card. Existing playback source, lyric calibration and scheduling preferences are preserved.

## Angled typography and deeper cosmic visuals

Lyric phrases enter from alternating sides and above/below the canvas, rotate in opposite directions, and retain a slight angle while holding. Rotation uses the same pure playback clock as translation and scale, so pause freezes it and seeks reproduce it. Reduced motion removes all lyric transforms. Orbit now includes luminous nebula layers, a textured ringed planet, a rotating accretion disk, a moon, and 72 drifting stars. Bloom gains luminous color ribbons; Tide has brighter contours and deeper color fields. Continuous layers animate transforms and opacity without per-frame React renders or external assets. High contrast keeps a dimmed cosmic scene behind shadowed white text and full visuals in ambient breaks. Unit tests verify entry direction, angular settling, seek determinism, and reduced motion; browser tests verify actual rendered angle changes and the six existing viewport bounds. Build, lint, typecheck, 38 unit/integration tests and 26 browser tests pass.

## Album colors and live song transitions

The live scene now samples allowlisted album artwork in a 48×48 browser canvas and derives an accent, dominant color and dark shade. Light fields, nebula and ring colors use that palette; no album card is shown. Bounded memory caching, CORS/timeouts and curated fallback keep missing artwork nonblocking. Late image results cannot recolor a different current song.

Removed initial demo playback from the live view. Browser observations now use fixed same-origin Next routes, which work on the same-WiFi phone preview without browser loopback addresses or cross-origin gateway failures. A gateway session identifier resets revision fencing safely after restarts. Status and metadata requests run in parallel; the gateway polls at 500 ms during playback, independently of lyric resolution. Regression tests cover rapid switches with slow old lyric lookups, clearing previous cues, gateway restarts with lower revision counters, artwork changes and failed artwork loads. The browser suite now runs on isolated ports 3212/8788 with WiiM/provider environment cleared, preventing test demo snapshots from replacing the household display’s live source. The user also confirmed a quick live switch was picked up.
