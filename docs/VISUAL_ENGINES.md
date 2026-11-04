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
- **Use computer audio:** opens the browser sharing picker from a click. Requests
  tab/system audio without getUserMedia or a microphone. The API also supplies
  video; that track is stopped immediately without displaying, recording, or
  transmitting frames. Only the live audio tracks feed the analyzer, with no
  playback to speakers. Sharing without audio produces an actionable error and
  releases all tracks. Support and available audio sources vary by browser/OS.
- **Choose another audio input → Connect wired input:** selects a specific audio-input device, such as a USB
  stereo line-input interface receiving the WiiM AUX output. Enumeration does not
  request capture. Default/communications aliases are excluded and no device is
  auto-selected. Capture requests an exact device ID and verifies the returned
  track; missing/mismatched devices fail instead of falling back to a microphone.
  Echo cancellation, noise suppression, and automatic gain control are disabled.
  The captured feed is analyzed locally and never sent to the computer speakers.
- **Use microphone:** requests audio-only browser permission and analyzes the room.
  It is never routed to speakers, recorded, uploaded, or persisted as a selected
  input. Microphone capture needs localhost/HTTPS and browser support. A phone on
  the plain-HTTP LAN preview may use files/test audio without microphone access.

The WiiM adapter still provides track metadata and position rather than audio
samples. Test/file audio is independent of the WiiM's music and lyric timeline.
The free [computer-audio/AirPlay route](WIIM_COMPUTER_AUDIO.md) captures music
playing on the Mac before it reaches the WiiM. Direct Spotify Connect playback
on the WiiM is not part of that local signal. A separately connected line input
can also supply audio; no hardware purchase is required for computer sharing. Microphone input can observe the actual music playing in the room, with room and
capture latency. No direct Spotify Connect audio capture is claimed.

A root provider keeps an explicitly started audio session alive during navigation
between the lab and display. The persistent Stop control can disconnect it on any
route. Disconnect, disabling the layer, sleep, and provider teardown release audio
nodes, captured audio tracks, object URLs, and the AudioContext. Generation fences stop
late capture grants and discard stale initialization results after cancellation.
A full reload starts disconnected; audio permissions are never requested on reload.

## Rendering

The transparent 2D canvas uses at most 600,000 pixels and targets 30 fps. The native
background keeps its existing GPU budgets and CSS fallback. Hidden pages suspend
the sound draw loop. Reduced motion draws a static idle composition, even if audio
is playing. Sleep unmounts the canvas and disconnects its audio input. Lyrics dim
the layer automatically, with additional attenuation in high contrast; musical
breaks retain the background and layer without album art or filler.

## Song-directed atmosphere

Native visuals now use a shared lyric direction model in addition to the ambient
clock. **Song dynamics** in the lab controls its strength (75% default; zero keeps
independent ambient motion). Existing Whisper/Flow/Pulse settings scale phrase
movement. No capture, microphone permission, audio-context creation, or additional
network service is required; direct Spotify Connect playback stays unchanged.

- Actual lyric line starts create attack/release swells, color filaments, camera
  expansion and shifting focal points. Phrase progress creates a broader ribbon.
- Repeated normalized lyric lines receive extra emphasis. This detects repetition,
  not musical choruses or sound energy.
- Real enhanced-LRC word tags add smaller accents. Line-only lyrics never generate
  invented word timestamps, beats, or FFT samples.
- Empty lines and timed gaps open the field into wider ambient space without art.
  Missing lyrics retain ambient motion and song transitions. Lyric direction also
  works when the user hides the lyric text.
- Track identity changes trigger a soft 4.2-second color sweep and a new procedural
  composition. Duration, album/lyrics enrichment, pauses and seeks do not retrigger
  the sweep. Rapid skips replace its target immediately.
- All three palette colors reach the shader; the dominant fixed blue tint is removed.
  Album colors settle faster, while preset transitions retain a visible background.
  Original presets, auto-per-song rotation and artwork cache fencing are retained.

Phrase/word values derive from playback position, including lyric calibration.
Pauses freeze that direction and seeks reproduce it. Shader uniforms and the
optional sound-layer canvas share the same model without per-frame React state.
The sound layer gently changes scale even with no audio input and keeps its ambient
label. CSS fallback receives phrase glow/expansion. High contrast keeps its existing
lyric protection; reduced motion suppresses all new movement. Prism's zero-motion
control also suppresses shader direction and song sweeps. GPU pixel/frame budgets,
hidden-page suspension, context recovery and sleep teardown remain in effect.
