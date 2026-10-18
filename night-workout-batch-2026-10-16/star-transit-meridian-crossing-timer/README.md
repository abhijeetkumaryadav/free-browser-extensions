# Star Transit Timer — Meridian Crossing

Enter a star's **right ascension** (hours) plus your **latitude/longitude**, and get the
**next upper-meridian transit** time with a live countdown.

## What it does
- Computes the next upper-meridian crossing from **real sidereal math**:
  Julian date → Greenwich Mean Sidereal Time → Local Sidereal Time → hour angle
- Live countdown to transit (`Xh Ym Zs`)
- Altitude and azimuth **at transit** for your latitude, plus an above/below-horizon verdict
- Optional **notification at transit** (checkbox)
- Save up to 20 favorite stars locally; double-click the result card to save the current star

## Honest scope
**Approximate geometry — educational only.** Not telescope pointing software.
Ignores precession, nutation, refraction, and proper motion. Results are good to
arc-minutes for casual observing, not for precision work.

## Privacy
Everything runs locally. Location, stars, and settings live in
`chrome.storage.local`. Zero network — no analytics, no telemetry.
