# Atmosphere implementation plan

## Scope and decisions

Build a local-first display for a WiiM Mini and Lenovo Tiny, with a complete offline demo. The supplied Markdown files are preserved in `docs/brief` as requirements/reference material. Implementation decisions and observed evidence live here and in IMPLEMENTATION_STATUS.md. No hardware purchase, Spotify login, lyric scraping, public deployment, or physical panel control is required to build the software.

Use Next.js 16 App Router, React 19, TypeScript, Tailwind 4 and Motion in a pnpm workspace. Keep the always-running Node gateway separate from Next.js. Shared source packages contain playback contracts, WiiM normalization, lyrics, motion, circadian logic, fixtures, and design tokens. Pin resolved dependencies and commit the lockfile. Self-host licensed fonts and original procedural art so the demo has no external requests.

## Architecture and trust boundaries

WiiM read-only HTTP/HTTPS probes → playback normalization/monotonic anchor → gateway lyric resolution → sequenced WebSocket snapshots → browser receipt-time anchor → pure lyric timeline → adaptive scene. The same-machine kiosk connects directly to a fixed loopback gateway WebSocket; the gateway binds loopback and validates the configured browser origin. No Next.js WebSocket proxy is required. Browser settings configure the local view only; device address is process configuration. Device discovery is an explicit bounded SSDP probe, with manual private IPv4 as the reliable fallback. No arbitrary URL proxy; artwork uses a fixed HTTPS Spotify CDN allowlist in the browser, with original local fallback. A bounded provider cache stores lyrics only in memory. LRCLIB is opt-in pending review of terms/coverage; original demo fixtures remain the default.

The browser and gateway have different monotonic clocks. Send current extrapolated position on every snapshot, then establish a fresh browser anchor on receipt. Reject old revisions; cap interpolation at a staleness threshold. Small device drift is smoothed; seeks, new tracks, pause and resume snap to the new observation. Lyrics are selected from position, never chained timers. Word emphasis is allowed only for actual supplied word cues.

## Delivery sequence

1. **M0 foundation:** workspace, strict TypeScript, lint/build/unit/browser commands, shared state and deterministic synthetic tracks. Acceptance: clean install, lint, typecheck, tests and production build.
2. **M1 visual product:** `/display`, `/lab`, `/settings`, `/diagnostics`; premium editorial art/lyric compositions; Cinema, Canvas, Portrait and Companion chosen by container aspect ratio; Whisper/Flow/Pulse; pause/seek/skip in demo; artwork-only and instrumental gaps; offline assets; keyboard/focus/reduced-motion handling. Acceptance: five requested viewports, route navigation, visual captures and browser behavior tests.
3. **M2 gateway:** bounded WiiM probes with command/transport fallbacks, UTF-8 hex normalization, serial adaptive polling, health/state/capabilities, WS heartbeat/reconnect/stale state, explicit discovery and diagnostics. Acceptance: mock device integration with timeout/outage/recovery and revision tests. Real Mini compatibility remains a hardware gate.
4. **M3 lyrics:** provider contract, robust LRC parser (offsets/multiple timestamps/metadata/UTF-8), strict metadata and duration match, timeouts, bounded cache and negative cache; pure timeline; calibration offset. Acceptance: parser, confidence, seek, pause, gap and provider outage tests. Do not generate word timings for line-only sources.
5. **M4 circadian:** timezone-aware solar scheduling with SunCalc, local fallback times, midnight/DST handling, smooth intensity transitions, expiring overrides, optional music wake and black sleep scene. Software-only brightness capability is explicit. Acceptance: fake-clock solar/polar/DST/override tests. Physical backlight and wake remain unsupported until measured.
6. **M5 delivery:** local kiosk launch scripts and systemd examples; security and deployment docs; hardware checklist; CI; implementation evidence and limitations; publish work to the requested repository. Acceptance: full software checks pass, no invented hardware evidence, reproducible startup instructions.

## Verification strategy

Unit-test contracts, clock interpolation and drift, normalization/hex, LRC/provider matching, timeline selection, solar/fallback schedules, DST, midnight and overrides. Integration-test actual HTTP/WS transport against a mock WiiM, gateway behavior during outages, and lyric timeouts. Playwright exercises display/lab/settings/diagnostics, demo transport, persistence, gateway mode, offline/reduced motion and screenshots at 1920×1080, 1920×1200, 1080×1920, 1024×1024 and 800×480. Review captures for clipping and legibility. Run installation, lint, typecheck, unit/integration tests, production build and browser suite; report observed results, not expected results.

## Hardware validation gates and residual risks

On the actual LAN, record firmware and redacted status/meta observations for Spotify Connect; switch between two household accounts; measure track changes (<3s target), calibrated drift (<250ms median target), pause/seek/skip, reboot and network recovery. Confirm field units and encoding from observations. Probe discovery separately; manual IP always remains available. On the existing monitor, measure night luminance and distinguish a software black overlay from backlight power. Test OS/kiosk restart, standby and reliable wake before enabling any physical sleep. Verify mounting, cable depth, glare and OLED warranty before choosing a new monitor. No candidate prices or specifications in the brief are treated as verified current buying advice.

## Completion boundary

Software implementation can complete with mock evidence. Real-device handoff, drift, 60fps performance on the Lenovo Tiny, physical brightness and sleep/wake cannot be certified without hardware observations. Keep these clearly marked unverified with exact procedures instead of claiming the brief's hardware-dependent definition of done has been met.
