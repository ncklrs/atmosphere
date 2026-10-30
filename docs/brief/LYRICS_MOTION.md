# Lyrics and motion
Spotify's public Web API does not offer synchronized lyrics. LRCLIB is a prototype candidate for timestamped LRC; check terms and attribution. Commercial word-level coverage requires licensed provider or authorized alignment.
Match lyrics by artist, title, duration tolerance, optional album; reject low confidence. Parse LRC offsets, multiple timestamps, tags, UTF-8. Words are highlighted only if actual word-level timing exists; never fabricate word timing.
Timeline motion = pure function of playback position and cues; event motion handles track change; ambient motion is independent.
Whisper 0-25%, Flow 25-70%, Pulse 70-100%. Word emphasis 120-240ms; line entry 350-650ms; exit 300-500ms; track transition 900-1400ms; palette 1800-3000ms; idle 3000-5000ms.
Pause freezes timeline. Seek immediately recomputes active cue. Instrumental gaps emphasize artwork. Missing lyrics means artwork-only.
