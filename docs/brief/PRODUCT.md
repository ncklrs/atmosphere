# Product requirements
Vision: a beautiful ambient art object at rest, cinematic lyric choreography during music.
MVP: household handoff without separate Spotify OAuth; WiiM read-only metadata; synced line lyrics, optional word timing when legitimately available; album art; four layouts; three intensity presets; pause/seek/skip; graceful no-lyrics mode; circadian clock/art/brightness scheduling; offline demo; kiosk.
Scenes: ACTIVE, PAUSED, AMBIENT_DAY, AMBIENT_DUSK, AMBIENT_NIGHT, SLEEP. Music should wake display unless disabled.
Non-goals: music playback, Spotify scraping, cloud login, hardware fabrication, public commercial lyric redistribution.
Goals to test: track change under 3 seconds on LAN; drift under 250ms median after calibration; smooth 60fps; robust reconnect.
