# Circadian behavior
Inputs: locally configured approximate lat/lon, IANA timezone, sunrise/sunset via SunCalc or equivalent, offsets, manual override TTL, optional ambient-light sensor.
Suggested configurable defaults: sunrise+30m DAY software intensity 65%; sunset-45m DUSK 35%; sunset+90m NIGHT 12%; 23:30 SLEEP; 06:30 AMBIENT. These are illustrative UI settings, not physical panel nits.
Smooth 15-30min interpolation; correct DST and midnight; fallback schedules when solar events unavailable; deterministic fake-clock tests.
Brightness capability levels: (1) verified hardware DDC/CI/vendor backlight with readback; (2) software darkening/palette adjustment only; (3) verified power control via HDMI-CEC/OS/smart plug with reliable wake. Do not claim a CSS overlay reduces LCD backlight power.
Manual override with expiration; music wake optional; never physically turn panel off before wake testing. Static clock moves subtly to protect OLED; overnight black screen option.
