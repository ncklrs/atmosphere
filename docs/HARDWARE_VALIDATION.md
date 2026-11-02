# Hardware validation record

Status: **WiiM Mini discovery and read-only HTTPS identity/playback probes verified on 2026-11-02 from the user's Mac.** Full playback, account-handoff, audio-sync and monitor tests remain pending. Mock HTTP/WS tests remain separate software evidence. Do not fill PASS for unobserved checks.

## Record the setup

| Item                                             | Observation                                                    |
| ------------------------------------------------ | -------------------------------------------------------------- |
| Date / tester                                    | 2026-11-02 / read-only local observation                       |
| WiiM model / firmware / source mode              | Muzo_Mini / Linkplay.4.6.833047 / source mode not yet recorded |
| Lenovo model / OS / Node / Chromium              | Pending                                                        |
| Monitor model / input / cable / mount            | Pending                                                        |
| Network connection / approximate polling latency | Pending                                                        |
| DDC/CI and HDMI-CEC readback                     | Unverified, disabled                                           |
| Physical brightness / minimum night luminance    | Unverified                                                     |

Keep raw responses and personal track/account data in a local, untracked observation folder. Do not commit SSIDs, MAC addresses, private device details or account identifiers to the public repository. A redacted summary should record field names, encoding and units, not household identity.

## WiiM tests

1. Run the gateway with `WIIM_HOST` set, enable Local gateway in settings, and inspect `/diagnostics` plus `http://127.0.0.1:8787/health`, `/state`, `/capabilities`.
2. Record which transport and status command responded. If HTTPS needs a self-signed certificate, enable the explicit per-device option and repeat. Record unsupported commands. Metadata is sampled independently; verify title, artist, album, duration and position units against WiiM Home.
3. Play from household account A through Spotify Connect, then hand off to account B without signing into Atmosphere. Repeat five times. Confirm the title/artist update each time. Record change-to-display latency; target is less than three seconds on a healthy LAN.
4. Pause for 30 seconds. Confirm the lyric timeline stays frozen. Resume, seek forward 30 seconds, seek backward 20 seconds, skip next and previous. Confirm immediate cue reselection after the next observation. Do not expect Atmosphere's demo transport to control the device.
5. Calibrate lyric offset against audible line starts. Measure at least 20 matched cues across three tracks, including after seek and resume. Report median absolute error; target is under 250 ms after calibration. Do not infer precision from animation alone.
6. Try unavailable lyrics and instrumental tracks. Confirm ambient-only musical gaps/missing-lyrics fallback in lyric mode, no fabricated timestamps, and no stale lyrics from the preceding song.
7. Disconnect the Mini from Wi-Fi; confirm unavailable/stale diagnostics and bounded interpolation. Reconnect; confirm automatic recovery. Reboot Mini, gateway, browser, and Lenovo individually. Record recovery times.
8. Run `pnpm discover` explicitly. Confirm candidate private IPs and manual IP fallback. SSDP silence is not proof the device is incompatible; discovery can be filtered by the network. mDNS browsing is not implemented.

## Monitor and kiosk tests

1. Start on the existing monitor. Check all five reference viewport sizes and the actual viewing distance. Confirm lyrics are readable, static chrome is hidden in fullscreen, cables are concealed and mount/cable depth is acceptable.
2. Record browser performance while changing lines, skipping tracks and transitioning scenes. Use Chromium Performance tools and real frame data; 60fps on the Lenovo is a target, not a result from this development machine.
3. Test day/dusk/night/sleep overrides, override expiry, music wake enabled/disabled, midnight, and the configured timezone. Verify local wall-clock time. Software intensity is not a measurement in nits.
4. Measure minimum usable luminance and glare. On LCD, verify physical backlight separately; a CSS overlay does not prove energy savings. On OLED, inspect static-image protection, panel compensation behavior and burn-in warranty.
5. Test monitor standby, HDMI disconnect/reconnect, OS lock/restart, cold boot, and user login. Verify Chromium kiosk autostart and absence of prompts. Repeat every proposed physical sleep/wake path at least ten times before implementing power control.
6. Leave the setup overnight with a reversible software-black sleep scene. Confirm the clock shifts subtly when shown and playback can restore the picture. OS/monitor standby must remain a separate observed result.

## Purchase gate

No hardware purchase is part of this implementation. Before choosing a compact OLED or framed wall display, verify exact current model, ports, mounting hardware, cable depth, minimum luminance, glare, DDC/CI readback, CEC/wake, power consumption and warranty directly with the manufacturer. The candidate models and prices in `docs/brief/HARDWARE.md` are supplied reference notes and have not been validated for a purchase.

## Observed WiiM evidence — 2026-11-02

- Bounded SSDP discovery found the user's confirmed Mini on the local Wi-Fi. The private address is retained only in local runtime configuration.
- `getStatusEx` identified model `Muzo_Mini`, firmware `Linkplay.4.6.833047`.
- HTTPS responded with the adapter's per-device self-signed certificate option. Default certificate verification rejected this certificate; HTTP port 80 refused connections. Global TLS settings were not changed.
- `getPlayerStatusEx` and `getMetaInfo` responded. The gateway and browser received actual track metadata and a paused playback position.
- Stopped metadata contained the literal vendor placeholder `unknow`; normalization now discards placeholder metadata and can fall back to useful metadata fields. A regression test covers this observation.
- Browser Local gateway selection and Diagnostics showed source `wiim`, Gateway connected, and actual playback observations. No device playback-control commands were sent.
- Live lyric lookup remains disabled pending explicit approval to send track metadata to LRCLIB. Raw household track observations remain outside the repository.
- Not yet verified: controlled pause/resume/seek/skip, two-account handoff, calibrated lyric drift, reboot/reconnect on the real device, Lenovo rendering and monitor power/wake.
