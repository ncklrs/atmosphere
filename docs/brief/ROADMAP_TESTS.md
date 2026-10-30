# Implementation and tests
M0: pnpm repo, shared contracts, fixture generator, offline mock /display and /lab, lint/typecheck/build.
M1: complete visual system and four compositions, original synthetic demo lyrics, visual snapshots, reduced motion.
M2: WiiM discovery/IP probe, status normalization, WS, real Spotify Connect two-account handoff, pause/seek/reboot diagnostics. Never mark hardware compatibility verified without logs.
M3: lyric provider interface, LRC parser, matching, cache rules, timeline synchronization and fallback.
M4: solar scene scheduler, manual override, brightness adapter capability discovery, kiosk autostart, reliable wake.
M5: performance, packaging, security, deployment guide, documentation.
Tests: unit normalization/hex/LRC/seek/DST/solar/overrides; integration mock WiiM/WS/reconnect/lyric outages; Playwright screenshots for 5 viewports; actual hardware capability matrix.
Definition of done: demo works offline; real Mini observations documented; two-account handoff; lyrics never invented; night dim and sleep/wake validated; no public unauthenticated control API.
Risks: WiiM undocumented API, lyric licensing/coverage, OLED burn-in, DDC/CI unsupported, physical wake failure, glare.
