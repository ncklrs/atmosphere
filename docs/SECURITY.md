# Local trust boundaries

- Next.js and the gateway bind `127.0.0.1`. The gateway is not an internet service. Do not forward or publicly proxy it.
- Gateway HTTP routes are GET-only health, playback and capability observations. There is no device-control, settings-write, arbitrary URL-fetch, credential or lyric-publish endpoint.
- A fixed `WEB_ORIGIN` is checked on WebSocket upgrades and on browser HTTP requests. HTTP Host is restricted to loopback names. Browser origin checks supplement loopback isolation; they are not authentication for a remote deployment.
- WiiM addresses must be literal RFC1918/loopback IPv4. DNS names, link-local metadata addresses and public IPs are rejected. Discovery only emits private IPv4 candidates and does not fetch advertised URLs. It is an explicit bounded SSDP command, not a background network scanner.
- Device requests have timeouts, bounded response bodies, a small fixed command set and no redirects. TLS verification is enabled by default. `WIIM_ALLOW_SELF_SIGNED=true` affects only this adapter's fixed private device request; it does not change Node's global TLS behavior.
- Artwork accepts only credential-free HTTPS URLs on a fixed Spotify CDN allowlist. The browser loads them with no-referrer policy. No artwork URL proxy or server-side arbitrary image optimizer is used. External art can reveal a browser request to that CDN; the offline demo makes none.
- LRCLIB is opt-in, uses an HTTPS endpoint fixed in source, sends track metadata for matching, has a three-second timeout, and caches in memory. Demo lyrics never call a provider. Missing or mismatched lyrics are not replaced with invented timing.
- WebSocket client count, payload size and outbound buffered bytes are capped. The stream rejects control messages. Stale playback interpolation stops after six seconds. No credentials are required or stored by Atmosphere.
- Browser settings are versioned, validated local storage. Approximate coordinates stay in the local browser. Static album art palettes use curated fallbacks; no external palette service is called.
- Font licenses ship with self-hosted assets. Keep raw household/device observations and `.env` files untracked. Review provider terms before commercial use; no lyric license is implied by API availability.

The current deployment assumes a trusted machine and local user session. Multi-user access, public hosting, remote kiosk control and authenticated configuration APIs require an explicit new design.
