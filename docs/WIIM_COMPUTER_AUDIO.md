# Free computer audio → WiiM → reactive visuals

No interface, microphone, paid app, or driver installation is needed to try this
route. Play music locally on the Mac, send its output to the WiiM using AirPlay,
and share local audio with Atmosphere through the browser.

The WiiM's network API supplies metadata and position, not a documented raw audio
feed. When Spotify Connect plays directly on the WiiM, the Mac is only a controller;
that music is unavailable to local tab/system capture. Keeping that route means
Atmosphere can still use album colors, synchronized lyrics and ambient motion,
but it cannot measure the song's live waveform from metadata.

## Try it

1. Open `http://127.0.0.1:3210/lab` in desktop Chrome on the Mac. The embedded
   browser may not expose audio sharing. Capture requires localhost or HTTPS.
2. Play music on **this Mac**. In macOS Sound output, select the WiiM via AirPlay.
   Do not select the WiiM through Spotify Connect for this test.
3. Enable **Sound layer**, then press **Use computer audio**. In the browser's
   sharing picker, choose the music tab with audio enabled, or a system-audio
   source if offered. Browser/macOS sharing permission is required each session.
4. Confirm **Live audio · Computer audio**, then navigate to Display in the app.
   Stop disconnects the input; reload, disabling the layer, and sleep also release it.

The browser requires a tab/window/screen selection even for this audio use case.
Atmosphere immediately stops the video track and does not read, render, save or
upload video frames. Audio is analyzed locally without recording, uploading or
playing a second copy through the computer speakers. System capture may include
notifications and other app sounds, so tab audio is preferable when available.

If audio is not included, the app releases the stream and explains how to try
again. Browser support, protected media, and output routing can prevent capture;
actual audio presence must be checked on the live setup. AirPlay adds latency, so
visuals captured before transmission may lead the speakers. This route has not
yet been validated with this user's AirPlay session.

## Implementation and checks

Computer sharing never falls back to microphone capture. Returned audio tracks
are the only input to Waviz's analyzer. Video tracks stop immediately, ended audio
tracks stop the session, and late grants after cancellation release their tracks.
Synthetic browser tests check real FFT response, video/audio cleanup, navigation,
missing audio, denied/cancelled sharing and late-grant cancellation. They do not
establish real AirPlay capture or synchronization.

## Sources

- [WiiM: streaming audio with AirPlay from a Mac](https://faq.wiimhome.com/en/support/solutions/articles/72000584708-how-to-stream-audio-with-airplay-on-wiim-devices)
- [MDN: getDisplayMedia requirements and optional audio](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia)
- [Chrome sharing controls](https://developer.chrome.com/docs/web-platform/screen-sharing-controls)

A specific virtual/line audio device already present on the computer can also be
selected under **Choose another audio input**. No device is auto-selected; the
app requests and verifies its exact ID and stops on mismatch or disconnection.
