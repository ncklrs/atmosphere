# Atmosphere backgrounds and sound layer

Atmosphere retains its six native ambient shaders: Bloom, Tide, Orbit, Nova,
Prism, and Voyage. They use album colors, continue through lyric breaks, and
support the existing intensity, Prism, contrast, reduced-motion, and sleep controls.
The previous Milkdrop/Butterchurn experiment has been removed, including its
packages, preset assets, runtime components, and controls. Legacy settings are
ignored during validation, preserving the original background and playback source.

## Waviz prototype

The optional **sound layer** adds transparent Halo, Ribbons, or Stardust treatments
above the native background and behind the lyrics. Auto pairs Halo with Orbit and
Prism, Ribbons with Bloom and Tide, and Stardust with Nova and Voyage. Presence,
size, response, and placement are adjustable and saved on this browser. With no
input connected, it shows a clearly labeled ambient preview with no audio analysis.

The prototype uses **Waviz 1.0.0 Core**: its AudioAnalyzer receives real Web Audio
samples, and its Visualizer supplies polar/rectangular transforms, waveform paths,
frequency bars, and particles. Atmosphere owns the draw loop, composition, palette,
controls, and lifecycle, rather than using the stock self-scheduling React presets.
The library is loaded only when the layer/input is used. Its MIT notice ships at
`/licenses/waviz.txt`.

## Audio inputs

Audio starts only from an explicit user action. Enabling the layer never starts
an AudioContext, file playback, or microphone capture automatically.

- **Play test audio:** synthesizes a quiet original eight-second chord/pluck/beat
  loop locally. This is audible test audio analyzed by Waviz, not a simulated FFT.
- **Choose audio file:** plays a local file through Web Audio, with pause/resume and
  volume controls. The file is not uploaded. Its object URL is revoked on disconnect.
- **Use microphone:** requests audio-only browser permission and analyzes the room.
  It is never routed to speakers, recorded, uploaded, or persisted as a selected
  input. Microphone capture needs localhost/HTTPS and browser support. A phone on
  the plain-HTTP LAN preview may use files/test audio without microphone access.

The WiiM adapter still provides track metadata and position rather than audio
samples. Test/file audio is independent of the WiiM's music and lyric timeline.
Microphone input can observe the actual music playing in the room, with room and
capture latency. No direct Spotify Connect audio capture is claimed.

A root provider keeps an explicitly started audio session alive during navigation
between the lab and display. The persistent Stop control can disconnect it on any
route. Disconnect, disabling the layer, sleep, and provider teardown release audio
nodes, microphone tracks, object URLs, and the AudioContext. Generation fences stop
late microphone grants and discard stale initialization results after cancellation.
A full reload starts disconnected; audio permissions are never requested on reload.

## Rendering

The transparent 2D canvas uses at most 600,000 pixels and targets 30 fps. The native
background keeps its existing GPU budgets and CSS fallback. Hidden pages suspend
the sound draw loop. Reduced motion draws a static idle composition, even if audio
is playing. Sleep unmounts the canvas and disconnects its audio input. Lyrics dim
the layer automatically, with additional attenuation in high contrast; musical
breaks retain the background and layer without album art or filler.
