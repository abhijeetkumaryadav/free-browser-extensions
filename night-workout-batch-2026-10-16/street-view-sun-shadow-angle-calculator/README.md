# Sun Shadow Angle Calculator

A fully local browser extension that computes solar position for any date, time,
latitude, and longitude — and from it, the direction and length of shadows.

**What it does**
- Enter date, time, latitude, longitude (and optional UTC offset; blank = your
  browser's local timezone) plus an object height in metres.
- Computes **solar elevation** and **solar azimuth** with standard NOAA-style
  solar-position math (mean longitude, mean anomaly, ecliptic longitude,
  obliquity, right ascension, declination, hour angle).
- Shows **shadow length** = height ÷ tan(elevation), the compass direction the
  shadow points, a sun-position dial, and a **golden-hour hint** (golden hour,
  low sun, twilight, night).
- Saves your last inputs and personal field notes locally (`chrome.storage.local`).

**Honest scope:** solar math only — local, offline. It does not fetch imagery,
does not detect shadows in photos, and is not a Street View integration. The
name is a playful nod to shadow-angle estimation for photography/location
scouting.

**Privacy:** zero network calls, zero permissions beyond `storage`.

## Development install
1. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**.
2. **Load unpacked** → select this folder.
