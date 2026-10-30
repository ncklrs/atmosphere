# Adaptive Hybrid design system
Identity: premium audio equipment meets Swiss editorial type and cinematic title design. Near black #101014; warm ivory #F3F0EA; lavender #C7B4FF; rose #A16C81; copper #D5A28A. Artwork-derived palette with contrast fallback.
Fonts: Geist Sans UI, Instrument Sans Variable lyrics, optional Instrument Serif accent, Geist Mono diagnostics; check licensing, self-host via next/font.
Layouts: Cinema landscape, Canvas square, Portrait vertical, Companion small. Choose by container aspect ratio, not device type. Test 1920x1080, 1920x1200, 1080x1920, 1024x1024, 800x480.
Type: Cinema hero 72-112px; portrait 64-96px; companion 32-52px; fluid clamp and phrase-aware wraps.
Components: AtmosphereRoot, SceneController, ArtworkLayer, PaletteBackdrop, LyricStage, LyricLine, LyricWord, NowPlaying, AmbientClock, IdleArt, SceneTransition, MotionProvider, Settings, Diagnostics.
Tokens: --surface, --foreground, --accent, --album-1, --album-2, --energy, --brightness-overlay.
Accessibility: prefers-reduced-motion, contrast overrides, keyboard settings, no flashes. OLED burn-in mitigation via subtle position shifts and night blanking.
