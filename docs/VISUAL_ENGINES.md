# Visual engines

The lab retains Atmosphere's six custom ambient shaders and adds an optional
Butterchurn renderer. Choose **Milkdrop** in the lab to use it. The existing
Ambient engine remains the default for existing and new preferences.

## Curated Milkdrop library

Twelve bundled presets are organized into Calm, Balanced, and Intense collections.
Their full creator credits are displayed below the selected scene in the lab and
retained in `packages/design-system/milkdrop.ts`. The labels describe the visual
character, not a guarantee that any particular preset has no bright or fast motion.

The client loads Butterchurn only when selected, and imports each preset separately.
Only the allowlisted presets in `milkdrop-loader.ts` can execute. No remote preset
URLs, custom files, or third-party song-title overlays are loaded.

Versions are pinned to Butterchurn **2.6.7** and butterchurn-presets **2.4.7**.
Both packages are MIT licensed; license notices ship at
`/licenses/butterchurn.txt` and `/licenses/butterchurn-presets.txt`.

## Controls

- **Brightness:** dims the final Milkdrop image independently of lyrics.
- **Animation speed:** scales the renderer's frame delta; zero holds the canvas.
  Milkdrop equations also contain frame-based feedback, so not all movement scales
  identically with this control.
- **Pattern energy:** changes the amplitude of the continuous ambient drive.
- **Preset blend:** requests a 0–12 second Milkdrop transition. A still scene switches
  immediately so it cannot become stuck at the beginning of a blend. Blend timing
  follows the animation-speed control.
- **Auto per song:** rotates within the selected collection, once per track identity.
  Seeking, pausing, and enriching artwork/metadata do not advance it. Turning it off
  pins the current preset; manually selecting a preset turns rotation off.

Settings and rotation state persist on each browser/display, independently of the
native shader preferences.

## Ambient animation, not audio analysis

The WiiM adapter provides playback state and metadata, **not PCM samples**.
Milkdrop therefore receives a deterministic, continuously varying mathematical
signal in this version. There is no beat detector or rhythmic amplitude envelope.
No AudioContext, microphone, audio capture, or audio output is created. The lab
labels the result **Ambient animation · no audio capture**.

Ambient adaptation disables each preset's stock volume gate, so wave-based scenes
remain visible without musical loudness transients. The original equations and
creator credits otherwise remain intact. Jelly space is the initial Milkdrop scene.

A future audio-input integration can replace that signal with real time-domain
samples. It must provide an explicitly selected audio source before claiming
music-reactive behavior. Track titles and timing alone cannot supply it.

Milkdrop presets use their own colors. Album-art palette extraction still drives
Atmosphere's original backgrounds and surrounding palette; it does not recolor
third-party Milkdrop shaders.

## Runtime behavior

The engine targets at most 30 frames/second and a 360,000-pixel canvas, with a lower
70,000-pixel / 12 fps budget for detected software rendering and adaptive reductions
when drawing is slow. Hidden pages stop drawing. Sleep unmounts the engine.
Reduced-motion preference uses the existing static ambient renderer. Missing
WebGL2, import/render failures, or context loss also reveal the ambient fallback;
context restoration recreates Milkdrop. The owned WebGL2 context is released on
unmount because Butterchurn 2.x does not expose a destroy method.

Lyrics remain an independent foreground layer. High contrast dims the background
while lyrics are active, and musical breaks retain the full ambient scene without
album cards.
