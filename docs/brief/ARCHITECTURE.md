# Architecture
Spotify accounts -> Spotify Connect -> WiiM Mini -> local HTTP/UPnP -> Node gateway -> normalized playback -> lyric resolver -> WebSocket -> Next.js kiosk -> display.
pnpm monorepo: apps/web (App Router /display /lab /settings /diagnostics), apps/gateway; packages/playback-core, adapter-wiim, lyrics, motion-engine, design-system, circadian, fixtures.
WiiM probe: /httpapi.asp?command=getPlayerStatusEx, fallback getPlayerStatus, plus getMetaInfo; try compatible HTTP/HTTPS with timeouts. Firmware and source may change field availability. Hex-decode fields as needed. Poll ~1s while active, slower idle. Manual IP fallback to mDNS/SSDP.
State contract: {sourceId, trackKey, title, artist, album, artworkUrl, durationMs, positionMs, sampledAtMonotonicMs, state:'playing'|'paused'|'stopped'|'unknown', confidence, revision}.
Timing: anchor device-reported position to monotonic clock, interpolate during play, smooth small drift, snap on seek/new track, handle stale data. No chained lyric timeouts.
API: GET /health /state /capabilities and WS /events. Bind settings to loopback or authenticate; prevent artwork SSRF; no exposed public gateway.
