# Atmosphere experience upgrade

Implement in order, retaining direct Spotify Connect, no required purchases or
microphone, all current native visuals, reduced motion and art-free lyric breaks.

1. **Display and lab:** default clean viewing with idle controls that return on
   touch/mouse/keyboard, optional clock/progress and brief/always/hidden song info.
   Put backgrounds, energy, lyrics and brightness first; collapse detailed effects
   and audio experiments. Add visual tiles, favorites and safe visual reset.
2. **Lyrics:** choose composition from phrase length, punctuation and reading time;
   reuse a stable visual signature for repeated text. Keep fast/dense passages
   steadier and short statements prominent. Add bounded per-song timing offsets,
   local/shared wrong-lyrics suppression and clear loading/missing status in controls.
3. **Ambients:** add Ink (fluid pigment), Architecture (light and shadow), and
   Landscape (soft organic terrain), each with its own GPU scene and CSS fallback.
   Integrate album colors, song direction, rotation/favorites and existing budgets.
4. **Phone controls:** centralize validated room settings in the loopback gateway,
   with same-Wi-Fi web proxy, explicit owner enablement and short-code pairing.
   Keep tokens in HttpOnly cookies, limit pairing attempts, reject cross-origin
   writes, bound payloads and persist settings atomically. Support live background,
   energy, lyric timing, brightness and favorites changes across browsers; never
   send WiiM transport commands or request audio capture. Show connection/errors
   and provide owner revocation. Keep local operation when room sharing is off.
5. **Verification and delivery:** unit checks for lyric decisions, settings bounds,
   scene registry and room authorization/persistence; browser checks for idle
   chrome recovery, phone layout, all scenes, per-song corrections and two-client
   synchronization. Run applicable regression/build/lint/type checks, visually
   inspect, restart local and LAN demos, commit and push to ncklrs/atmosphere.

Completion criteria: the display reads as a room experience, common lab actions
are easy to reach, lyrics adapt to content, new scene families look distinct, and a
paired phone actually changes the laptop display. Physical-phone GPU behavior will
be reported separately from automated two-browser verification.

## Delivery status

All four implementation stages are complete. Core validation passed 61 unit and
integration checks. The browser regression pass covered all 60 cases; after the
SPA-navigation test wait was corrected, the final focused suite passed all 23
experience, renderer, audio-lifecycle and paired-controller checks. Lint, typecheck
and production build pass. Native scenes and the reorganized lab were visually
inspected. Physical phone GPU performance remains a separate live-device check.
